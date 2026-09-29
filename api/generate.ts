import { generationIdentity } from './_lib/generationIdentity.js';
import { generationQuota, quotaConfigured, validRequestId, QuotaError } from './_lib/generationQuota.js';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { validatePreflight } from '../src/domain/validation.js';
import { isProject } from '../src/services/persistence.js';
import { matchesPlanGuide } from '../src/services/planGuide.js';
import {
  buildGenerationPrompt, GENERATION_MODEL, GENERATION_QUALITY,
  GENERATION_SIZE, MAX_GENERATION_BODY_BYTES, MAX_GENERATION_IMAGES,
  MAX_GENERATION_IMAGE_BYTES, referenceSheetGroups, matchesReferenceSheet,
  matchesReferencePreparation, referencePreparationFor,
  type GenerationImage, type GenerationRequest,
} from '../src/services/generationContract.js';

/** Image edits can take longer than ordinary JSON functions. */
export const maxDuration = 180;

type BodyRequest = IncomingMessage & { body?: unknown };

class RequestError extends Error {
  constructor(message: string, public status: number, public outcomeUnknown = false) { super(message); }
}

function send(response: ServerResponse, status: number, body: object): void {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.end(JSON.stringify(body));
}

function sameOrigin(request: IncomingMessage): boolean {
  const origin = request.headers.origin;
  if (!origin) return false;
  try {
    const url = new URL(origin);
    const host = request.headers['x-forwarded-host'] ?? request.headers.host;
    return url.host === host && (url.protocol === 'https:' || url.protocol === 'http:');
  } catch {
    return false;
  }
}

async function readBody(request: BodyRequest): Promise<unknown> {
  let parsedBody: unknown;
  try { parsedBody = request.body; }
  catch { throw new RequestError('요청 내용을 읽지 못했습니다.', 400); }
  if (parsedBody !== undefined) {
    const raw = typeof parsedBody === 'string' ? parsedBody : JSON.stringify(parsedBody);
    if (Buffer.byteLength(raw) > MAX_GENERATION_BODY_BYTES) throw new RequestError('이미지 요청 크기가 너무 큽니다. 등록 이미지를 줄여 주세요.', 413);
    try { return JSON.parse(raw); } catch { throw new RequestError('요청 내용을 읽지 못했습니다.', 400); }
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_GENERATION_BODY_BYTES) throw new RequestError('이미지 요청 크기가 너무 큽니다. 등록 이미지를 줄여 주세요.', 413);
    chunks.push(buffer);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new RequestError('요청 내용을 읽지 못했습니다.', 400); }
}

function isImage(value: unknown): value is GenerationImage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const image = value as Record<string, unknown>;
  return ['existing-space', 'floor-plan', 'inspiration', 'product', 'reference-sheet'].includes(String(image.role)) &&
    typeof image.sourceId === 'string' && typeof image.dataUrl === 'string';
}

function decodeImage(dataUrl: string): Buffer {
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match) throw new RequestError('생성 입력은 JPEG 이미지로 준비해 주세요.', 400);
  const image = Buffer.from(match[1], 'base64');
  if (!image.length || image.length > MAX_GENERATION_IMAGE_BYTES ||
      image[0] !== 0xff || image[1] !== 0xd8 || image[2] !== 0xff) {
    throw new RequestError('생성 입력 이미지의 형식 또는 용량을 확인해 주세요.', 400);
  }
  return image;
}

function validateRequest(value: unknown): { body: GenerationRequest; decoded: Buffer[] } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new RequestError('요청 내용을 확인해 주세요.', 400);
  const body = value as Partial<GenerationRequest>;
  if (!isProject(body.project) || typeof body.cameraId !== 'string' || !Array.isArray(body.images) ||
      body.images.length < 1 || body.images.length > MAX_GENERATION_IMAGES || !body.images.every(isImage)) {
    throw new RequestError('프로젝트나 이미지 입력 형식을 확인해 주세요.', 400);
  }
  const project = body.project;
  if (project.results.length ||
      (project.floorPlan?.structures.length ?? 0) > 100) {
    throw new RequestError('생성 요청에 결과 이력을 포함하지 말고 입력 조건을 간결하게 정리해 주세요.', 400);
  }
  const issues = validatePreflight(project, body.cameraId).issues.filter((issue) => issue.severity === 'error');
  if (issues.length) throw new RequestError(issues[0].message, 400);
  const images = body.images;
  if (images[0].role !== 'existing-space' ||
      !project.sourceImages.some((source) => source.id === images[0].sourceId && source.role === 'existing-space')) {
    throw new RequestError('첫 입력은 등록된 기존 공간 사진이어야 합니다.', 400);
  }
  const seen = new Set<string>();
  const appliedReferences = new Set(project.elements.filter((element) => element.status === 'apply').map((element) => element.sourceReferenceId));
  const appliedImageIds = new Set(project.references.filter((reference) => appliedReferences.has(reference.id)).map((reference) => reference.imageId));
  for (const image of images) {
    if (seen.has(image.sourceId)) throw new RequestError('같은 이미지를 여러 번 보낼 수 없습니다.', 400);
    seen.add(image.sourceId);
    if (image.role !== 'floor-plan' && image.planGuide !== undefined) throw new RequestError('도면 정보는 도면 입력에만 지정할 수 있습니다.', 400);
    if (image.role === 'reference-sheet') {
      const index = Number(image.sourceId.replace('reference-sheet-', ''));
      if (!/^reference-sheet-[0-2]$/.test(image.sourceId) || !matchesReferenceSheet(referenceSheetGroups(project)[index], image.sheet) || image.referencePreparation !== undefined) throw new RequestError('레퍼런스 모음과 적용 자료가 일치하지 않습니다.', 400);
      for (const part of image.sheet!) { if (seen.has(part.sourceId)) throw new RequestError('같은 참고 이미지를 여러 번 보낼 수 없습니다.', 400); seen.add(part.sourceId); }
    } else if (image.role === 'floor-plan') {
      if (image.referencePreparation !== undefined || image.sheet !== undefined) throw new RequestError('도면에는 레퍼런스 선택 영역을 지정할 수 없습니다.', 400);
      if (image.sourceId !== 'floor-plan' || !matchesPlanGuide(project, body.cameraId, image.planGuide)) {
        throw new RequestError('현재 도면과 시점의 배치 가이드가 필요합니다. 페이지를 새로고침해 주세요.', 400);
      }
    } else {
      const source = project.sourceImages.find((entry) => entry.id === image.sourceId && entry.role === image.role);
      if (!source || (image.role !== 'existing-space' && !appliedImageIds.has(source.id))) {
        throw new RequestError('프로젝트에 적용된 이미지인지 확인해 주세요.', 400);
      }
      if (image.role === 'existing-space') {
        if (image.referencePreparation !== undefined) throw new RequestError('기존 공간 사진에는 레퍼런스 선택 영역을 지정할 수 없습니다.', 400);
      } else {
        let expected;
        try { expected = referencePreparationFor(project, image.sourceId); }
        catch (error) { throw new RequestError(error instanceof Error ? error.message : '레퍼런스 영역을 확인해 주세요.', 400); }
        if (!matchesReferencePreparation(expected, image.referencePreparation)) {
          throw new RequestError('레퍼런스 선택 영역과 전송 이미지 정보가 일치하지 않습니다.', 400);
        }
      }
    }
  }
  if ([...appliedImageIds].some((id) => !seen.has(id))) {
    throw new RequestError('적용된 레퍼런스 이미지가 생성 입력에서 빠졌습니다.', 400);
  }
  if (images[1]?.role !== 'floor-plan') {
    throw new RequestError('저장한 도면과 선택 시점의 배치 가이드를 두 번째 입력에 포함해 주세요.', 400);
  }
  const decoded = images.map((image) => decodeImage(image.dataUrl));
  return { body: body as GenerationRequest, decoded };
}

function upstreamError(status: number, code?: string): RequestError {
  if (code === 'moderation_blocked') return new RequestError('이미지 안전 기준으로 요청이 중단되었습니다. 사진이나 조건을 수정해 주세요.', 400);
  if (status === 401 || status === 403) return new RequestError('이미지 생성 서버의 OpenAI 키 설정을 확인해 주세요.', 502);
  if (status === 429) return new RequestError('요청 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.', 429);
  if (status === 400 || status === 422) return new RequestError('이미지 입력이나 생성 조건을 확인해 주세요.', 400);
  return new RequestError('이미지 생성 서버가 응답하지 않았습니다. 이전 결과는 그대로 보관됩니다.', 502);
}

export default async function handler(request: BodyRequest, response: ServerResponse): Promise<void> {
  if (request.method !== 'POST') { response.setHeader('Allow', 'POST'); send(response, 405, { error: '지원하지 않는 요청입니다.' }); return; }
  if (!sameOrigin(request)) { send(response, 403, { error: '다른 사이트에서 이미지 생성을 요청할 수 없습니다.' }); return; }
  if (!process.env.OPENAI_API_KEY || !quotaConfigured()) {
    send(response, 503, { error: '이미지 생성 서버 또는 전체 호출 상한이 준비되지 않았습니다. 무료 샘플을 이용해 주세요.' }); return;
  }
  const requestId = request.headers['x-generation-request-id'];
  if (!validRequestId(requestId)) {
    send(response, 400, { error: '생성 요청 번호를 확인해 주세요.' }); return;
  }
  if (!request.headers['content-type']?.startsWith('application/json')) {
    send(response, 415, { error: 'JSON 형식의 요청만 받습니다.' }); return;
  }
  let reserved = false, providerAttempted = false;
  const responseDeadline = Date.now() + maxDuration * 1000;
  let responseStatus = 200;
  let responseBody: object = {};
  try {
    const { body, decoded } = validateRequest(await readBody(request));
    const prompt = buildGenerationPrompt(body.project, body.cameraId, body.images);
    const form = new FormData();
    form.set('model', GENERATION_MODEL);
    form.set('prompt', prompt);
    form.set('quality', GENERATION_QUALITY);
    form.set('size', GENERATION_SIZE);
    form.set('n', '1');
    form.set('input_fidelity', 'low');
    form.set('output_format', 'jpeg');
    form.set('output_compression', '72');
    decoded.forEach((bytes, index) => form.append('image[]', new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' }), `reference-${index + 1}.jpg`));
    const userId = generationIdentity(request);
    if (!userId) throw new RequestError('브라우저의 익명 사용자 식별이 필요합니다. 생성 가능 여부를 다시 확인하고 쿠키를 허용해 주세요.', 403);
    await generationQuota.reserve(requestId, userId);
    reserved = true;
    const providerBudget = Math.min(170_000, responseDeadline - Date.now() - 10_000);
    if (providerBudget <= 0) throw new RequestError('생성 준비 시간이 초과되었습니다. 잠시 후 생성 가능 여부를 확인해 주세요.', 503);
    providerAttempted = true;
    const upstream = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: form,
      signal: AbortSignal.timeout(providerBudget),
    });
    const payload: unknown = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      const code = payload && typeof payload === 'object' && 'error' in payload &&
        payload.error && typeof payload.error === 'object' && 'code' in payload.error &&
        typeof payload.error.code === 'string' ? payload.error.code : undefined;
      throw upstreamError(upstream.status, code);
    }
    const image = payload && typeof payload === 'object' && 'data' in payload && Array.isArray(payload.data)
      ? payload.data[0] : null;
    const base64 = image && typeof image === 'object' && 'b64_json' in image && typeof image.b64_json === 'string'
      ? image.b64_json : null;
    if (!base64 || base64.length > 3_800_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
      throw new RequestError('이미지는 생성되었지만 결과 파일을 전달하지 못했습니다. 비용이 발생했을 수 있으니 사용량을 확인한 뒤 다시 시도해 주세요.', 502, true);
    }
    responseBody = { imageDataUrl: `data:image/jpeg;base64,${base64}`, model: GENERATION_MODEL,
      quality: GENERATION_QUALITY, size: GENERATION_SIZE };
  } catch (error) {
    if (error instanceof QuotaError || error instanceof RequestError) {
      responseStatus = error.status;
      responseBody = { error: error.message, outcomeUnknown: error instanceof RequestError && error.outcomeUnknown };
    } else if (error instanceof Error && error.name === 'TimeoutError') {
      responseStatus = 504;
      responseBody = { error: '이미지 생성 시간이 초과되었습니다. 비용이 발생했을 수 있으니 결과와 사용량을 확인한 뒤 다시 시도해 주세요.', outcomeUnknown: providerAttempted };
    } else {
      responseStatus = providerAttempted ? 502 : 503;
      responseBody = { error: providerAttempted ? '생성 결과를 확인하지 못했습니다. 비용이 발생했을 수 있으니 사용량을 확인해 주세요.' : '전체 호출 상한 저장소를 확인하지 못해 생성을 중단했습니다. 무료 샘플은 계속 사용할 수 있습니다.', outcomeUnknown: providerAttempted };
    }
  } finally {
    // The next view starts when the client receives this response. Finish the
    // active lease first; storage failure retains the lease and the paid image.
    if (reserved) {
      // A slow/unavailable ledger must not consume the function's remaining
      // response time and lose an already paid image. The client checks the
      // actual lease before the next view; a retained lease still fails closed.
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          generationQuota.finish(requestId).catch(() => { /* Retain lease; never refund. */ }),
          new Promise<void>(resolve => { timer = setTimeout(resolve, Math.max(1, Math.min(8_000, responseDeadline - Date.now() - 1_000))); }),
        ]);
      } finally { clearTimeout(timer); }
    }
  }
  send(response, responseStatus, responseBody);
}
