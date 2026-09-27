import type { DesignElement, PlacementTarget, Project, StructureGeometry } from '../domain/types';

/** One low-quality draft, with no automatic variants or hidden model calls. */
export const GENERATION_MODEL = 'gpt-image-1-mini' as const;
export const GENERATION_QUALITY = 'low' as const;
export const GENERATION_SIZE = '1536x1024' as const;
export const GENERATION_OUTPUT_PRICE_USD = 0.006;
export const MAX_REFERENCE_IMAGES = 3;
export const MAX_GENERATION_IMAGES = 5;
export const MAX_GENERATION_IMAGE_BYTES = 550_000;
export const MAX_GENERATION_BODY_BYTES = 4_000_000;
/** A shorter legacy code is treated as unconfigured after credential rotation. */
export const MIN_GENERATION_ACCESS_CODE_LENGTH = 48;

export type GenerationImageRole = 'existing-space' | 'floor-plan' | 'inspiration' | 'product';

export interface GenerationImage {
  role: GenerationImageRole;
  sourceId: string;
  dataUrl: string;
}

export interface GenerationRequest {
  project: Project;
  cameraId: string;
  images: GenerationImage[];
}

export interface GenerationStatus {
  available: boolean;
  requiresAccessCode: boolean;
  reason?: string;
  model: typeof GENERATION_MODEL;
  quality: typeof GENERATION_QUALITY;
  size: typeof GENERATION_SIZE;
  /** Published output example for a single landscape draft. Inputs are charged separately. */
  outputPriceUsd: typeof GENERATION_OUTPUT_PRICE_USD;
  pricingNote: string;
}

export const GENERATION_PRICING_NOTE =
  '공식 예시 기준 낮은 품질 1536×1024 출력 1장의 가격은 약 $0.006입니다. 입력 문장·사진 토큰 비용이 별도로 추가됩니다. 현재 모델은 2026-12-01 종료 예정입니다.';

function boundedText(value: string, length = 240): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, length);
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function geometryText(geometry: StructureGeometry): string {
  if (geometry.kind === 'segment') {
    return `segment (${percent(geometry.start.x)}, ${percent(geometry.start.y)}) to (${percent(geometry.end.x)}, ${percent(geometry.end.y)})`;
  }
  if (geometry.kind === 'circle') {
    return `circle center (${percent(geometry.center.x)}, ${percent(geometry.center.y)}), radius ${percent(geometry.radius)}`;
  }
  return `rectangle (${percent(geometry.bounds.x)}, ${percent(geometry.bounds.y)}), width ${percent(geometry.bounds.width)}, height ${percent(geometry.bounds.height)}`;
}

function targetText(project: Project, target: PlacementTarget | null): string {
  if (!target) return 'unplaced';
  switch (target.kind) {
    case 'floor-point':
      return `floor point (${percent(target.x)}, ${percent(target.y)}), rotation ${Math.round(target.rotationDegrees ?? 0)} degrees, footprint ${percent(target.footprint?.width ?? 0.06)} by ${percent(target.footprint?.height ?? 0.06)}`;
    case 'floor-area':
      return `floor area ${boundedText(project.floorPlan?.areas.find((area) => area.id === target.areaId)?.name ?? target.areaId)}`;
    case 'wall-segment':
      return `wall ${boundedText(project.floorPlan?.structures.find((item) => item.id === target.wallId)?.name ?? target.wallId)}, span ${percent(target.start)} to ${percent(target.end)} along wall`;
    case 'ceiling-zone':
      return `ceiling zone ${boundedText(project.floorPlan?.areas.find((area) => area.id === target.zoneId)?.name ?? target.zoneId)}`;
    case 'whole-space':
      return 'whole space';
    case 'named-area':
      return `area ${boundedText(project.floorPlan?.areas.find((area) => area.id === target.areaId)?.name ?? target.areaId)}`;
  }
}

function elementText(project: Project, element: DesignElement, images: GenerationImage[]): string {
  const reference = project.references.find((item) => item.id === element.sourceReferenceId);
  const imageNumber = images.findIndex((image) => image.sourceId === reference?.imageId) + 1;
  return `${boundedText(element.label)} [${element.kind}] from ${imageNumber > 0 ? `input image ${imageNumber}` : 'saved reference conditions'} at ${targetText(project, element.target)}. ` +
    `Appearance: ${boundedText(element.appearance ?? 'not specified')}. ` +
    `Conditions: ${boundedText(element.conditions ?? 'none')}.`;
}

/** Builds model guidance from user-saved conditions; it does not claim geometric guarantees. */
export function buildGenerationPrompt(project: Project, cameraId: string, images: GenerationImage[]): string {
  const camera = project.cameras.find((entry) => entry.id === cameraId);
  if (!camera || !project.floorPlan) throw new Error('카메라와 도면을 확인해 주세요.');
  const plan = project.floorPlan;
  const imageLines = images.map((image, index) => {
    const source = project.sourceImages.find((entry) => entry.id === image.sourceId);
    const label = image.role === 'floor-plan' ? 'uploaded floor plan' : boundedText(source?.name ?? image.role);
    return `${index + 1}. ${image.role}: ${label}`;
  });
  const fixed = plan.structures.filter((item) => item.immutable || item.protected);
  const applied = project.elements.filter((item) => item.status === 'apply');
  const excluded = project.elements.filter((item) => item.status === 'exclude');
  const prompt = [
    'Create ONE realistic interior spatial concept draft from the provided existing-space photograph and separately labeled references.',
    'Input image roles, in order:',
    ...imageLines,
    'The existing-space photograph shows the current room. Inspiration and product images are visual references only and are NEVER measured spatial geometry. The uploaded floor plan, when provided, is the 2D placement guide.',
    `Project: ${boundedText(project.name)}. Space type: ${boundedText(project.spaceType)}. Intended concept: ${boundedText(project.concept, 500)}.`,
    `Plan source: ${plan.kind}. Geometry confidence: ${plan.geometryConfidence}. Plan coordinates are normalized: x increases to the right and y increases downward. Do not invent precise dimensions from a schematic plan or any photograph.`,
    'Preserve the existing shell, doors, passage, windows, pillars, and other Keep structures. Do not demolish, move, cover, or replace protected geometry. Keep surface decorations are allowed only when the saved condition permits removable treatment.',
    `Protected structures (${fixed.length}):`,
    ...fixed.map((item) => `- ${boundedText(item.name)} [${item.kind}]: ${geometryText(item.geometry)}.${item.lightTone ? ` Existing light tone: ${boundedText(item.lightTone)}.` : ''}`),
    'Saved preservation conditions:',
    ...project.keeps.map((keep) => `- ${boundedText(plan.structures.find((item) => item.id === keep.structureId)?.name ?? keep.structureId)}: ${boundedText(keep.description)}. Removable surface treatment: ${keep.allowedSurfaceTreatment ? 'allowed' : 'not specified'}.`),
    'Registered plan areas and circulation:',
    ...plan.areas.map((area) => `- ${boundedText(area.name)} [${area.kind}] rectangle (${percent(area.bounds.x)}, ${percent(area.bounds.y)}), width ${percent(area.bounds.width)}, height ${percent(area.bounds.height)}.`),
    'Applied design elements and their compatible targets:',
    ...applied.map((element) => `- ${elementText(project, element, images)}`),
    'Excluded design elements and appearance:',
    ...(excluded.length ? excluded.map((element) => `- Do not add ${boundedText(element.label)}. ${boundedText(element.conditions ?? '')}`) : ['- None specified.']),
    ...project.references.flatMap((reference) => reference.exclusions.map((excludedNote) => `- Do not add ${boundedText(excludedNote)} from reference ${boundedText(project.sourceImages.find((image) => image.id === reference.imageId)?.name ?? reference.imageId)}.`)),
    `Viewpoint: camera at (${percent(camera.x)}, ${percent(camera.y)}), direction ${Math.round(camera.directionDegrees)} degrees, where 0 degrees points right, 90 down, 180 left and 270 up. Field of view: ${camera.fovPreset ?? 'standard'}. Compose from this approximate viewpoint.`,
    'Prioritize legible spatial layout and the existing room identity. Show the proposed elements only at their specified floor, wall, ceiling or room regions. Avoid text labels, technical overlays and multiple image panels. The result is a concept visualization, not a verified architectural drawing.',
  ].join('\n');
  if (prompt.length > 16_000) throw new Error('생성 조건이 너무 길어 요청할 수 없습니다. 구조와 조건을 정리해 주세요.');
  return prompt;
}
