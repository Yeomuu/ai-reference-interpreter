import type { Project } from '../domain/types';
import { buildPlanGuideSvg, type PlanGuidePalette } from './planGuide';
import { MAX_GENERATION_IMAGE_BYTES } from './generationContract';

/** Only local rendering; this never calls an image model. */
export async function rasterizePlanGuide(project: Project, cameraId: string, background?: string): Promise<string> {
  const style = getComputedStyle(document.documentElement);
  const token = (name: string) => style.getPropertyValue(name).trim();
  const palette: PlanGuidePalette = { paper: token('--surface-base'), ink: token('--text-primary'),
    structure: token('--canvas-structure'), info: token('--state-info-fg'), selected: token('--canvas-selection'),
    subtle: token('--surface-pressed'), border: token('--border-default') };
  if (Object.values(palette).some(value => !value)) throw new Error('도면 표시 설정을 불러오지 못했습니다. 페이지를 새로고침해 주세요.');
  const icon = await fetch('/icons/nucleo/IconCameraOutline18.svg', { credentials: 'omit' });
  if (!icon.ok) throw new Error('시점 표시를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.');
  const cameraIcon = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(await icon.text())}`;
  await document.fonts.ready;
  const svg = buildPlanGuideSvg(project, cameraId, palette, background, cameraIcon);
  const uri = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    // HTMLImageElement decodes SVG with embedded local images; createImageBitmap(SVG)
    // is not supported consistently by browsers.
    const image = new Image(); image.src = uri;
    await image.decode();
    for (const [edge, quality] of [[1536, .86], [1280, .78], [1024, .7]] as const) {
      const scale = Math.min(1, edge / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('이 브라우저에서 도면 이미지를 준비할 수 없습니다.');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('도면 이미지를 준비하지 못했습니다.')), 'image/jpeg', quality));
      if (blob.size > MAX_GENERATION_IMAGE_BYTES) continue;
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('도면 이미지를 읽지 못했습니다.')); reader.readAsDataURL(blob);
      });
    }
    throw new Error('도면 이미지가 너무 큽니다. 도면 파일의 해상도를 줄여 주세요.');
  } finally { URL.revokeObjectURL(uri); }
}
