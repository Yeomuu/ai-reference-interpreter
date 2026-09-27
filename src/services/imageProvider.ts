import type { Project, Result } from '../domain/types';
import { createConditionsSnapshot } from '../domain/revisions';
import { validatePreflight } from '../domain/validation';
import { getImageAssetBlob, putImageAsset } from './assets';
import {
  GENERATION_MODEL, GENERATION_OUTPUT_PRICE_USD, GENERATION_PRICING_NOTE,
  GENERATION_QUALITY, GENERATION_SIZE, MAX_GENERATION_BODY_BYTES,
  MAX_GENERATION_IMAGE_BYTES,
  MAX_REFERENCE_IMAGES,
  type GenerationImage, type GenerationImageRole, type GenerationRequest,
  type GenerationStatus,
} from './generationContract';

export type { GenerationStatus } from './generationContract';

export const OFFLINE_DEMO_NOTICE =
  '사전 제공된 AURA POP-UP 샘플 이미지입니다. 현재 조건이나 카메라 설정을 반영해 생성한 결과가 아닙니다.';

export interface ImageProvider {
  mode: 'offline-demo' | 'api';
  provenance: string;
  createResult(project: Project, cameraId: string): Promise<Result>;
}

/** Fixed local sample. It does not generate pixels or imply spatial consistency. */
export const offlineDemoProvider: ImageProvider = {
  mode: 'offline-demo',
  provenance: OFFLINE_DEMO_NOTICE,
  async createResult(project, cameraId) {
    const preflight = validatePreflight(project, cameraId);
    const firstError = preflight.issues.find((issue) => issue.severity === 'error');
    if (firstError) throw new Error(firstError.message);

    const conditionsSnapshot = createConditionsSnapshot(project, cameraId);
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
  requiresAccessCode: true,
  model: GENERATION_MODEL,
  quality: GENERATION_QUALITY,
  size: GENERATION_SIZE,
  outputPriceUsd: GENERATION_OUTPUT_PRICE_USD,
  pricingNote: GENERATION_PRICING_NOTE,
  reason: '이미지 생성 서버에 연결할 수 없습니다. 데모 샘플은 계속 사용할 수 있습니다.',
};

/** A read-only availability check; it never triggers model usage or billing. */
export async function getGenerationStatus(): Promise<GenerationStatus> {
  try {
    const response = await fetch('/api/status', { method: 'GET', cache: 'no-store', credentials: 'omit' });
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

/** Resize before upload to bound request size and image-input token use. */
async function compactImage(uri: string): Promise<string> {
  const input = await localImageBlob(uri);
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(input.type)) {
    throw new Error('PNG, JPG 또는 WebP 이미지만 이미지 생성에 사용할 수 있습니다.');
  }
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(input); }
  catch { throw new Error('입력 이미지를 열 수 없습니다. 파일을 다시 등록해 주세요.'); }
  try {
    for (const [maxEdge, quality] of [[1024, 0.76], [896, 0.69], [768, 0.62]] as const) {
      const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('이 브라우저에서 이미지 준비 기능을 사용할 수 없습니다.');
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const output = await jpegBlob(canvas, quality);
      if (output.size <= MAX_GENERATION_IMAGE_BYTES) return blobDataUrl(output);
    }
  } finally {
    bitmap.close();
  }
  throw new Error('이미지 용량을 줄일 수 없습니다. 더 작은 이미지를 등록해 주세요.');
}

async function requestImage(project: Project, cameraId: string, accessCode: string): Promise<string> {
  const existing = project.sourceImages.find((image) => image.role === 'existing-space');
  if (!existing) throw new Error('기존 공간 사진을 먼저 등록해 주세요.');
  const references = appliedReferenceImages(project);
  if (references.length > MAX_REFERENCE_IMAGES) {
    throw new Error(`한 번의 생성에는 적용된 레퍼런스 이미지 최대 ${MAX_REFERENCE_IMAGES}장을 사용할 수 있습니다. 적용 대상을 줄이거나 나누어 시도해 주세요.`);
  }
  const sources: { role: GenerationImageRole; sourceId: string; uri: string }[] = [
    { role: 'existing-space', sourceId: existing.id, uri: existing.uri },
  ];
  if (project.floorPlan?.kind === 'uploaded' && project.floorPlan.imageUri) {
    sources.push({ role: 'floor-plan', sourceId: 'floor-plan', uri: project.floorPlan.imageUri });
  }
  sources.push(...references.map((image) => ({ role: image.role, sourceId: image.id, uri: image.uri })));
  const images: GenerationImage[] = [];
  for (const source of sources) {
    images.push({ role: source.role, sourceId: source.sourceId, dataUrl: await compactImage(source.uri) });
  }
  const body: GenerationRequest = { project: { ...project, results: [] }, cameraId, images };
  const serialized = JSON.stringify(body);
  if (new TextEncoder().encode(serialized).length > MAX_GENERATION_BODY_BYTES) {
    throw new Error('입력 이미지가 너무 커서 보낼 수 없습니다. 더 작은 사진을 등록해 주세요.');
  }
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Generation-Access-Code': accessCode },
    body: serialized,
    credentials: 'omit',
    cache: 'no-store',
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
      ? payload.error : '이미지 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.';
    throw new Error(message);
  }
  if (!payload || typeof payload !== 'object' || !('imageDataUrl' in payload) ||
      typeof payload.imageDataUrl !== 'string' || !payload.imageDataUrl.startsWith('data:image/jpeg;base64,')) {
    throw new Error('이미지 생성 서버의 응답을 확인할 수 없습니다. 다시 시도하기 전에 결과 이력을 확인해 주세요.');
  }
  return payload.imageDataUrl;
}

/** The access code exists in memory only and is sent only on explicit generation. */
export function createApiImageProvider(accessCode: string): ImageProvider {
  return {
    mode: 'api',
    provenance: 'OpenAI 이미지 API로 생성한 시안입니다. 구조와 배치가 정확히 반영되었는지 결과를 직접 확인해 주세요.',
    async createResult(project, cameraId) {
      const preflight = validatePreflight(project, cameraId);
      const firstError = preflight.issues.find((issue) => issue.severity === 'error');
      if (firstError) throw new Error(firstError.message);
      if (!accessCode.trim()) throw new Error('이미지 생성 접근 코드를 입력해 주세요.');
      const conditionsSnapshot = createConditionsSnapshot(project, cameraId);
      if (!conditionsSnapshot) throw new Error('카메라를 찾을 수 없습니다.');
      const dataUrl = await requestImage(project, cameraId, accessCode.trim());
      let imageUri: string;
      try {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], `시안-${Date.now()}.jpg`, { type: 'image/jpeg' });
        imageUri = (await putImageAsset(file, 'photo')).uri;
      } catch {
        throw new Error('이미지는 생성되었지만 이 브라우저에 저장하지 못했습니다. 비용이 발생했을 수 있습니다. 저장 공간을 확인한 뒤 다시 시도해 주세요.');
      }
      return {
        id: crypto.randomUUID(), cameraId, commonRevision: project.commonRevision,
        createdAt: new Date().toISOString(), imageUri, origin: 'ai', approved: false,
        stale: false, conditionsSnapshot,
      };
    },
  };
}
