import type { DesignElement, PlacementTarget, Project, Rect, StructureGeometry } from '../domain/types';

/** One low-quality draft, with no automatic variants or hidden model calls. */
export const GENERATION_MODEL = 'gpt-image-1-mini' as const;
export const GENERATION_QUALITY = 'low' as const;
export const GENERATION_SIZE = '1536x1024' as const;
export const GENERATION_OUTPUT_PRICE_USD = 0.006;
export const MAX_REFERENCE_IMAGES = 3;
export const MAX_REFERENCE_REGIONS_PER_IMAGE = 4;
export const MAX_GENERATION_IMAGES = 5;
export const MAX_GENERATION_IMAGE_BYTES = 550_000;
export const MAX_GENERATION_BODY_BYTES = 4_000_000;

export type GenerationImageRole = 'existing-space' | 'floor-plan' | 'inspiration' | 'product';

export interface GenerationImage {
  role: GenerationImageRole;
  sourceId: string;
  dataUrl: string;
  /** The pixels in dataUrl were prepared from these user-selected source regions. */
  referencePreparation?: ReferencePreparation;
}

export interface ReferencePreparation {
  mode: 'crop' | 'grid';
  /** One crop, or 2–4 crops in reading order: upper-left, upper-right, lower-left, lower-right. */
  regions: Rect[];
}

export interface GenerationRequest {
  project: Project;
  cameraId: string;
  images: GenerationImage[];
}

export interface GenerationStatus {
  available: boolean;
  requiresAccessCode: boolean;
  quota?: { totalLimit: number; used: number; remaining: number; dailyLimit: number; dailyRemaining: number; busy: boolean };
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

function sameRegion(left: Rect, right: Rect): boolean {
  return left.x === right.x && left.y === right.y &&
    left.width === right.width && left.height === right.height;
}

/** One reference source remains one transmitted image, even when several elements use it. */
export function referencePreparationFor(project: Project, sourceId: string): ReferencePreparation | undefined {
  const elements = project.elements.filter((element) => element.status === 'apply' &&
    project.references.some((reference) => reference.id === element.sourceReferenceId && reference.imageId === sourceId));
  // A whole-image element needs the original pixels; other elements can still use normalized source coordinates.
  if (elements.some((element) => !element.sourceRegion)) return undefined;
  const regions: Rect[] = [];
  for (const element of elements) {
    const region = element.sourceRegion;
    if (region && !regions.some((saved) => sameRegion(saved, region))) regions.push(region);
  }
  if (!regions.length) return undefined;
  if (regions.length > MAX_REFERENCE_REGIONS_PER_IMAGE) {
    throw new Error(`같은 레퍼런스 이미지에서 서로 다른 선택 영역은 한 번에 최대 ${MAX_REFERENCE_REGIONS_PER_IMAGE}개까지 생성에 사용할 수 있습니다. 적용 요소의 영역을 정리해 주세요.`);
  }
  return { mode: regions.length === 1 ? 'crop' : 'grid', regions };
}

/** Reject client/server disagreements about which source pixels a reference image represents. */
export function matchesReferencePreparation(expected: ReferencePreparation | undefined, actual: unknown): boolean {
  if (!expected) return actual === undefined;
  if (!actual || typeof actual !== 'object' || Array.isArray(actual)) return false;
  const value = actual as Record<string, unknown>;
  if (Object.keys(value).length !== 2 || value.mode !== expected.mode || !Array.isArray(value.regions) ||
      value.regions.length !== expected.regions.length) return false;
  return value.regions.every((region, index) => {
    if (!region || typeof region !== 'object' || Array.isArray(region)) return false;
    const rect = region as Record<string, unknown>;
    return Object.keys(rect).length === 4 && sameRegion(rect as unknown as Rect, expected.regions[index]);
  });
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
  const preparation = images.find((image) => image.sourceId === reference?.imageId)?.referencePreparation;
  let sourceScope: string;
  if (element.sourceRegion && preparation?.mode === 'crop') {
    sourceScope = 'The entire transmitted reference image is the user-selected crop for this element. ';
  } else if (element.sourceRegion && preparation?.mode === 'grid') {
    const slot = preparation.regions.findIndex((region) => sameRegion(region, element.sourceRegion!));
    const positions = ['upper-left', 'upper-right', 'lower-left', 'lower-right'];
    if (slot < 0) throw new Error('선택한 이미지 영역과 생성 입력이 일치하지 않습니다.');
    sourceScope = `Use only the ${positions[slot]} panel of this transmitted reference image for this element. `;
  } else if (element.sourceRegion) {
    sourceScope = `Use only its normalized region x ${percent(element.sourceRegion.x)} to ${percent(element.sourceRegion.x + element.sourceRegion.width)}, y ${percent(element.sourceRegion.y)} to ${percent(element.sourceRegion.y + element.sourceRegion.height)} as the visual reference for this element. `;
  } else {
    sourceScope = 'Use the whole reference image for this element. ';
  }
  return `${boundedText(element.label)} [${element.kind}] from ${imageNumber > 0 ? `input image ${imageNumber}` : 'saved reference conditions'} at ${targetText(project, element.target)}. ` +
    sourceScope +
    `Appearance: ${boundedText(element.appearance ?? 'not specified')}. ` +
    `Conditions: ${boundedText(element.conditions ?? 'none')}.`;
}

/** Builds model guidance from user-saved conditions; it does not claim geometric guarantees. */
export function buildGenerationPrompt(project: Project, cameraId: string, images: GenerationImage[]): string {
  const camera = project.cameras.find((entry) => entry.id === cameraId);
  if (!camera || !project.floorPlan) throw new Error('카메라와 도면을 확인해 주세요.');
  const plan = project.floorPlan;
  for (const image of images) {
    if (image.role !== 'product' && image.role !== 'inspiration') continue;
    if (!matchesReferencePreparation(referencePreparationFor(project, image.sourceId), image.referencePreparation)) {
      throw new Error('선택한 이미지 영역과 생성 입력이 일치하지 않습니다.');
    }
  }
  const imageLines = images.map((image, index) => {
    const source = project.sourceImages.find((entry) => entry.id === image.sourceId);
    const label = image.role === 'floor-plan' ? 'uploaded floor plan' : boundedText(source?.name ?? image.role);
    const prepared = image.referencePreparation?.mode === 'crop' ? ' (user-selected crop)' :
      image.referencePreparation?.mode === 'grid' ? ` (${image.referencePreparation.regions.length} user-selected crops in reading-order grid panels)` : '';
    return `${index + 1}. ${image.role}: ${label}${prepared}`;
  });
  const fixed = plan.structures.filter((item) => item.immutable || item.protected);
  const editable = plan.structures.filter((item) => !item.immutable && !item.protected);
  const applied = project.elements.filter((item) => item.status === 'apply');
  const excluded = project.elements.filter((item) => item.status === 'exclude');
  const prompt = [
    'Create ONE realistic interior spatial concept draft from the provided existing-space photograph and separately labeled references.',
    'Input image roles, in order:',
    ...imageLines,
    'The existing-space photograph shows the current room. Inspiration and product images are visual references only and are NEVER measured spatial geometry. The uploaded floor plan, when provided, is the 2D placement guide.',
    `Project: ${boundedText(project.name)}. Space type: ${boundedText(project.spaceType)}. Intended concept: ${boundedText(project.concept, 500)}.`,
    `Plan source: ${plan.kind}. Geometry confidence: ${plan.geometryConfidence}. Plan coordinates are normalized: x increases to the right and y increases downward. Do not invent precise dimensions from a schematic plan or any photograph.`,
    'Preserve structures explicitly marked as protected/Keep. Do not demolish, move, cover, or replace protected geometry. Keep surface decorations are allowed only when the saved condition permits removable treatment. Follow the registered plan positions for structures whose preservation lock the user released; releasing a lock is not evidence of construction feasibility.',
    `Protected structures (${fixed.length}):`,
    ...fixed.map((item) => `- ${boundedText(item.name)} [${item.kind}]: ${geometryText(item.geometry)}.${item.lightTone ? ` Existing light tone: ${boundedText(item.lightTone)}.` : ''}`),
    'Saved preservation conditions:',
    ...project.keeps.map((keep) => `- ${boundedText(plan.structures.find((item) => item.id === keep.structureId)?.name ?? keep.structureId)}: ${boundedText(keep.description)}. Removable surface treatment: ${keep.allowedSurfaceTreatment ? 'allowed' : 'not specified'}.`),
    'User-editable plan structures (follow these saved positions; do not add an automatic preservation lock):',
    ...editable.map((item) => `- ${boundedText(item.name)} [${item.kind}, ${item.role ?? 'unspecified origin'}]: ${geometryText(item.geometry)}.${item.lightTone ? ` Light tone: ${boundedText(item.lightTone)}.` : ''}`),
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
