import type { Project, Result } from '../domain/types';
import { createConditionsSnapshot } from '../domain/revisions';
import { validatePreflight } from '../domain/validation';
import { getImageAssetBlob, putImageAsset } from './assets';
import {
  GENERATION_MODEL, GENERATION_OUTPUT_PRICE_USD, GENERATION_PRICING_NOTE,
  GENERATION_QUALITY, GENERATION_SIZE, MAX_GENERATION_BODY_BYTES,
  MAX_GENERATION_IMAGE_BYTES,
  referenceSheetGroups,
  type SheetSource,
  referencePreparationFor,
  type GenerationImage, type GenerationImageRole, type GenerationRequest,
  type ReferencePreparation,
  type GenerationStatus,
} from './generationContract';

export type { GenerationStatus } from './generationContract';

export const OFFLINE_DEMO_NOTICE =
  '사전 제공된 AURA POP-UP 샘플 이미지입니다. 현재 조건이나 카메라 설정을 반영해 생성한 결과가 아닙니다.';

/** The request may already have reached the paid provider; the caller must not offer an immediate retry. */
export class GenerationOutcomeUnknownError extends Error {
  readonly name = 'GenerationOutcomeUnknownError';
}

const UNKNOWN_GENERATION_OUTCOME =
  '이미지 생성 요청의 결과를 확인하지 못했습니다. 비용이 발생했을 수 있습니다. 결과 이력과 OpenAI 사용량을 확인하기 전에는 즉시 다시 요청하지 마세요.';

export interface ImageProvider {
  mode: 'offline-demo' | 'api';
  provenance: string;
  createResult(project: Project, cameraId: string, existingPhotoId?: string): Promise<Result>;
}

/** Fixed local sample. It does not generate pixels or imply spatial consistency. */
export const offlineDemoProvider: ImageProvider = {
  mode: 'offline-demo',
  provenance: OFFLINE_DEMO_NOTICE,
  async createResult(project, cameraId, existingPhotoId) {
    const preflight = validatePreflight(project, cameraId);
    const firstError = preflight.issues.find((issue) => issue.severity === 'error');
    if (firstError) throw new Error(firstError.message);

    const conditionsSnapshot = createConditionsSnapshot(project, cameraId, existingPhotoId);
    if (!conditionsSnapshot) throw new Error('카메라를 찾을 수 없습니다.');

    return {
      id: crypto.randomUUID(),
      cameraId,
      commonRevision: project.commonRevision,
      createdAt: new Date().toISOString(),
      imageUri: '/sample/result.png',
      origin: 'sample',
      approved: false,
      stale: false,
      conditionsSnapshot,
    };
  },
};

const unavailableStatus: GenerationStatus = {
  available: false,
  requiresAccessCode: false,
  model: GENERATION_MODEL,
  quality: GENERATION_QUALITY,
  size: GENERATION_SIZE,
  outputPriceUsd: GENERATION_OUTPUT_PRICE_USD,
  pricingNote: GENERATION_PRICING_NOTE,
  reason: '이미지 생성 서버에 연결할 수 없습니다. 데모 샘플은 계속 사용할 수 있습니다.',
};

/** A read-only availability check; it never triggers model usage or billing. */
export async function getGenerationStatus(timeoutMs = 8_000): Promise<GenerationStatus> {
  try {
    const response = await fetch('/api/status', { method: 'GET', cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) return unavailableStatus;
    const data: unknown = await response.json();
    if (!data || typeof data !== 'object' || !('available' in data) || typeof data.available !== 'boolean') {
      return unavailableStatus;
    }
    return data as GenerationStatus;
  } catch {
    return unavailableStatus;
  }
}

function appliedReferenceImages(project: Project) {
  const ids = new Set(project.elements.filter((element) => element.status === 'apply').map((element) => element.sourceReferenceId));
  const imageIds = new Set(project.references.filter((reference) => ids.has(reference.id)).map((reference) => reference.imageId));
  return project.sourceImages.filter((image) => imageIds.has(image.id) && image.role !== 'existing-space');
}

async function localImageBlob(uri: string): Promise<Blob> {
  if (uri.startsWith('asset://')) {
    const blob = await getImageAssetBlob(uri);
    if (!blob) throw new Error('등록된 이미지 파일을 찾지 못했습니다. 다시 등록해 주세요.');
    return blob;
  }
  if (!/^\/sample\/[a-z0-9_-]+\.(?:png|jpe?g|webp)$/i.test(uri)) {
    throw new Error('이 이미지의 저장 경로를 확인할 수 없습니다. 다시 등록해 주세요.');
  }
  const response = await fetch(uri, { credentials: 'omit' });
  if (!response.ok) throw new Error('샘플 이미지 파일을 불러오지 못했습니다.');
  return response.blob();
}

function jpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('이미지 용량을 조정하지 못했습니다.')), 'image/jpeg', quality);
  });
}

function blobDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('이미지 파일을 읽지 못했습니다.'));
    reader.onerror = () => reject(new Error('이미지 파일을 읽지 못했습니다.'));
    reader.readAsDataURL(blob);
  });
}

/** Resize, and when selected, crop or tile source pixels before upload. */
export async function compactImage(uri: string, preparation?: ReferencePreparation): Promise<string> {
  const input = await localImageBlob(uri);
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(input.type)) {
    throw new Error('PNG, JPG 또는 WebP 이미지만 이미지 생성에 사용할 수 있습니다.');
  }
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(input); }
  catch { throw new Error('입력 이미지를 열 수 없습니다. 파일을 다시 등록해 주세요.'); }
  try {
    for (const [maxEdge, quality] of [[1024, 0.76], [896, 0.69], [768, 0.62]] as const) {
      const canvas = document.createElement('canvas');
      if (preparation?.mode === 'grid') {
        const edge = Math.min(maxEdge, Math.max(bitmap.width, bitmap.height));
        canvas.width = Math.max(1, Math.round(edge));
        canvas.height = Math.max(1, Math.round(edge * (preparation.regions.length === 2 ? 0.5 : 1)));
      } else {
        const region = preparation?.regions[0];
        const width = bitmap.width * (region?.width ?? 1);
        const height = bitmap.height * (region?.height ?? 1);
        const scale = Math.min(1, maxEdge / Math.max(width, height));
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
      }
      const context = canvas.getContext('2d');
      if (!context) throw new Error('이 브라우저에서 이미지 준비 기능을 사용할 수 없습니다.');
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      if (preparation?.mode === 'grid') {
        const gutter = Math.max(4, Math.round(canvas.width * 0.012));
        const cellWidth = (canvas.width - gutter * 3) / 2;
        const cellHeight = (canvas.height - gutter * (preparation.regions.length === 2 ? 2 : 3)) /
          (preparation.regions.length === 2 ? 1 : 2);
        preparation.regions.forEach((region, index) => {
          const sourceWidth = bitmap.width * region.width;
          const sourceHeight = bitmap.height * region.height;
          const fit = Math.min(cellWidth / sourceWidth, cellHeight / sourceHeight);
          const targetWidth = sourceWidth * fit;
          const targetHeight = sourceHeight * fit;
          const column = index % 2;
          const row = Math.floor(index / 2);
          const left = gutter + column * (cellWidth + gutter) + (cellWidth - targetWidth) / 2;
          const top = gutter + row * (cellHeight + gutter) + (cellHeight - targetHeight) / 2;
          context.drawImage(bitmap, bitmap.width * region.x, bitmap.height * region.y,
            sourceWidth, sourceHeight, left, top, targetWidth, targetHeight);
        });
      } else if (preparation?.mode === 'crop') {
        const region = preparation.regions[0];
        context.drawImage(bitmap, bitmap.width * region.x, bitmap.height * region.y,
          bitmap.width * region.width, bitmap.height * region.height,
          0, 0, canvas.width, canvas.height);
      } else {
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      }
      const output = await jpegBlob(canvas, quality);
      if (output.size <= MAX_GENERATION_IMAGE_BYTES) return blobDataUrl(output);
    }
  } finally {
    bitmap.close();
  }
  throw new Error('이미지 용량을 줄일 수 없습니다. 더 작은 이미지를 등록해 주세요.');
}

export async function compactReferenceSheet(project: Project, sheet: SheetSource[]): Promise<string> {
  const edge = 1536, columns = Math.ceil(Math.sqrt(sheet.length)), rows = Math.ceil(sheet.length / columns);
  const canvas = document.createElement('canvas'); canvas.width = edge; canvas.height = edge;
  const context = canvas.getContext('2d'); if (!context) throw new Error('참고 이미지 모음을 준비할 수 없습니다.');
  context.fillStyle = '#fff'; context.fillRect(0, 0, edge, edge);
  const cellWidth = edge / columns, cellHeight = edge / rows;
  for (let index = 0; index < sheet.length; index++) {
    const part = sheet[index], source = project.sourceImages.find(image => image.id === part.sourceId);
    if (!source) throw new Error('적용한 참고 이미지를 찾을 수 없습니다.');
    const bitmap = await createImageBitmap(await (await fetch(await compactImage(source.uri, part.referencePreparation))).blob());
    try { const fit = Math.min((cellWidth - 12) / bitmap.width, (cellHeight - 36) / bitmap.height); const width = bitmap.width * Math.max(.001,fit), height = bitmap.height * Math.max(.001,fit);
      const x = index % columns * cellWidth, y = Math.floor(index / columns) * cellHeight;
      context.drawImage(bitmap,x+(cellWidth-width)/2,y+30+(cellHeight-30-height)/2,width,height);
      context.fillStyle = '#17191d'; context.font = '20px sans-serif'; context.fillText(String(index+1),x+8,y+24);
    } finally { bitmap.close(); }
  }
  for (const quality of [.76,.64,.5,.36]) { const blob = await jpegBlob(canvas,quality); if(blob.size<=MAX_GENERATION_IMAGE_BYTES) return blobDataUrl(blob); }
  throw new Error('참고 이미지 모음의 용량이 큽니다. 이미지 해상도를 줄여 주세요.');
}

async function requestImage(project: Project, cameraId: string, existingPhotoId: string | undefined, requestId: string): Promise<string> {
  const existing = project.sourceImages.find((image) => image.role === 'existing-space' &&
    (!existingPhotoId || image.id === existingPhotoId));
  if (!existing) throw new Error(existingPhotoId
    ? '선택한 기존 공간 사진을 찾지 못했습니다. 공간 자료에서 사진을 다시 선택해 주세요.'
    : '기존 공간 사진을 먼저 등록해 주세요.');
  const references = appliedReferenceImages(project);
  const sources: { role: GenerationImageRole; sourceId: string; uri: string; referencePreparation?: ReferencePreparation }[] = [
    { role: 'existing-space', sourceId: existing.id, uri: existing.uri },
  ];
  if (project.floorPlan?.kind === 'uploaded' && project.floorPlan.imageUri) {
    sources.push({ role: 'floor-plan', sourceId: 'floor-plan', uri: project.floorPlan.imageUri });
  }
  const sheets = referenceSheetGroups(project);
  if (!sheets.length) sources.push(...references.map((image) => ({ role: image.role, sourceId: image.id, uri: image.uri,
    referencePreparation: referencePreparationFor(project, image.id) })));
  const images: GenerationImage[] = [];
  for (const source of sources) {
    images.push({ role: source.role, sourceId: source.sourceId,
      dataUrl: await compactImage(source.uri, source.referencePreparation),
      ...(source.referencePreparation ? { referencePreparation: source.referencePreparation } : {}) });
  }
  for (let index = 0; index < sheets.length; index++) images.push({ role: 'reference-sheet', sourceId: `reference-sheet-${index}`, sheet: sheets[index], dataUrl: await compactReferenceSheet(project, sheets[index]) });
  const body: GenerationRequest = { project: { ...project, results: [] }, cameraId, images };
  const serialized = JSON.stringify(body);
  if (new TextEncoder().encode(serialized).length > MAX_GENERATION_BODY_BYTES) {
    throw new Error('입력 이미지가 너무 커서 보낼 수 없습니다. 더 작은 사진을 등록해 주세요.');
  }
  let response: Response;
  try {
    response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Generation-Request-Id': requestId },
      body: serialized,
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch {
    throw new GenerationOutcomeUnknownError(UNKNOWN_GENERATION_OUTCOME);
  }
  let payload: unknown;
  try { payload = await response.json(); }
  catch {
    if (response.ok || response.status >= 500) throw new GenerationOutcomeUnknownError(UNKNOWN_GENERATION_OUTCOME);
    payload = null;
  }
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
      ? payload.error : '이미지 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.';
    if (payload && typeof payload === 'object' && 'outcomeUnknown' in payload && payload.outcomeUnknown === true) throw new GenerationOutcomeUnknownError(message);
    throw new Error(message);
  }
  if (!payload || typeof payload !== 'object' || !('imageDataUrl' in payload) ||
      typeof payload.imageDataUrl !== 'string' || !payload.imageDataUrl.startsWith('data:image/jpeg;base64,')) {
    throw new GenerationOutcomeUnknownError(UNKNOWN_GENERATION_OUTCOME);
  }
  return payload.imageDataUrl;
}

/** The server holds the API key and enforces the shared durable quota. */
export function createApiImageProvider(requestId: string = crypto.randomUUID()): ImageProvider {
  return {
    mode: 'api',
    provenance: 'OpenAI 이미지 API로 생성한 시안입니다. 구조와 배치가 정확히 반영되었는지 결과를 직접 확인해 주세요.',
    async createResult(project, cameraId, existingPhotoId) {
      const preflight = validatePreflight(project, cameraId);
      const firstError = preflight.issues.find((issue) => issue.severity === 'error');
      if (firstError) throw new Error(firstError.message);
      const conditionsSnapshot = createConditionsSnapshot(project, cameraId, existingPhotoId);
      if (!conditionsSnapshot) throw new Error('카메라를 찾을 수 없습니다.');
      const dataUrl = await requestImage(project, cameraId, existingPhotoId, requestId);
      let imageUri: string;
      try {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], `시안-${Date.now()}.jpg`, { type: 'image/jpeg' });
        imageUri = (await putImageAsset(file, 'photo')).uri;
      } catch {
        throw new GenerationOutcomeUnknownError(
          'AI 이미지는 생성됐지만 이 브라우저에 저장하지 못했습니다. 비용이 발생했을 수 있습니다. 저장 공간과 OpenAI 사용량을 확인하기 전에는 다시 생성하지 마세요.');
      }
      return {
        id: crypto.randomUUID(), cameraId, commonRevision: project.commonRevision,
        createdAt: new Date().toISOString(), imageUri, origin: 'ai', approved: false,
        stale: false, conditionsSnapshot,
      };
    },
  };
}
