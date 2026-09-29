import type { DesignElement, PlacementTarget, Point, Project, Rect, Structure, StructureGeometry } from '../domain/types.js';
import { elementPlanPosition, type PlanGuideManifest } from './planGuide.js';

/** One low-quality draft, with no automatic variants or hidden model calls. */
export const GENERATION_MODEL = 'gpt-image-1-mini' as const;
export const GENERATION_QUALITY = 'low' as const;
export const GENERATION_SIZE = '1536x1024' as const;
export const GENERATION_OUTPUT_PRICE_USD = 0.006;
// Input slots after the room photo and saved plan guide; applied source count is unrestricted.
export const REFERENCE_IMAGE_SLOTS = 3;
export const MAX_REFERENCE_REGIONS_PER_IMAGE = 4;
export const MAX_GENERATION_IMAGES = 5;
export const MAX_GENERATION_IMAGE_BYTES = 550_000;
export const MAX_GENERATION_BODY_BYTES = 4_000_000;

export type GenerationImageRole = 'existing-space' | 'floor-plan' | 'inspiration' | 'product' | 'reference-sheet';
export interface SheetSource { sourceId: string; referencePreparation?: ReferencePreparation }

export interface GenerationImage {
  role: GenerationImageRole;
  sourceId: string;
  dataUrl: string;
  /** Which saved revision/view the manually rendered plan guide represents. */
  planGuide?: PlanGuideManifest;
  /** The pixels in dataUrl were prepared from these user-selected source regions. */
  referencePreparation?: ReferencePreparation;
  sheet?: SheetSource[];
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
  quota?: { totalLimit: number; used: number; remaining: number; dailyLimit: number; dailyRemaining: number; busy: boolean; resetsAt?: string };
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
  const elements = project.elements.filter((element) => element.status === 'apply' && element.origin !== 'basic-support' &&
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

/** Unlimited applied sources are packed into at most three sheets, without extra model calls. */
export function referenceSheetGroups(project: Project): SheetSource[][] {
  const ids = new Set(project.elements.filter(item => item.status === 'apply').map(item => item.sourceReferenceId));
  const sources = new Set(project.references.filter(item => ids.has(item.id)).map(item => item.imageId));
  const images = project.sourceImages.filter(image => sources.has(image.id) && image.role !== 'existing-space');
  if (images.length <= REFERENCE_IMAGE_SLOTS) return [];
  const size = Math.ceil(images.length / REFERENCE_IMAGE_SLOTS);
  return Array.from({length:Math.ceil(images.length/size)}, (_, i) => images.slice(i*size,(i+1)*size).map(image => ({sourceId:image.id, ...(referencePreparationFor(project,image.id) ? {referencePreparation:referencePreparationFor(project,image.id)} : {})})));
}
export function matchesReferenceSheet(expected: SheetSource[] | undefined, actual: unknown): boolean {
  return !!expected && Array.isArray(actual) && actual.length === expected.length && actual.every((item, i) => item && typeof item === 'object' && item.sourceId === expected[i].sourceId && matchesReferencePreparation(expected[i].referencePreparation, item.referencePreparation) && Object.keys(item).every(key => ['sourceId','referencePreparation'].includes(key)));
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
    case 'fixture-surface':
      return `on top of display support ${boundedText(project.elements.find(item => item.id === target.fixtureElementId)?.label ?? target.fixtureElementId)}, relative surface position (${percent(target.offset.x)}, ${percent(target.offset.y)}); product and support overlap intentionally, never place this product directly on the floor`;
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
  const imageNumber = images.findIndex((image) => image.sourceId === reference?.imageId || image.sheet?.some(source => source.sourceId === reference?.imageId)) + 1;
  const sheet = images[imageNumber - 1]?.sheet;
  const panel = sheet?.findIndex(source => source.sourceId === reference?.imageId);
  const preparation = sheet && panel !== undefined ? sheet[panel]?.referencePreparation : images.find((image) => image.sourceId === reference?.imageId)?.referencePreparation;
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
  if (sheet && panel !== undefined) sourceScope = `Use only numbered panel ${panel + 1} in this input image. This panel is the reference image described below, never the whole sheet. ` + sourceScope;
  return `${boundedText(element.label)} [${element.kind}] from ${imageNumber > 0 ? `input image ${imageNumber}` : 'saved reference conditions'} at ${targetText(project, element.target)}. ` +
    (element.origin === 'basic-support' ? 'This is a basic display support explicitly added by the user, not an object extracted from the product photograph. ' : sourceScope) +
    `Appearance: ${boundedText(element.appearance ?? 'not specified')}. ` +
    `Conditions: ${boundedText(element.conditions ?? 'none')}. ` + transferIntent(element) + relativeToCamera(project, element) + installationContext(project, element);
}

function installationContext(project: Project, element: DesignElement): string {
  const target = element.target, camera = project.cameras[0], plan = project.floorPlan;
  if (!target || !camera || !plan) return '';
  if (target.kind === 'floor-point') {
    const floor = plan.areas.find(area => area.kind === 'floor');
    if (!floor || !target.footprint) return '';
    return `Its footprint occupies approximately ${percent(target.footprint.width / floor.bounds.width)} of the registered floor width and ${percent(target.footprint.height / floor.bounds.height)} of its depth, not a room-filling counter. Keep the surrounding aisle gaps shown in the plan. `;
  }
  if (target.kind !== 'wall-segment') return '';
  return wallPlaneContext(project, target.wallId);
}

function wallPlaneContext(project: Project, wallId: string, openingId?: string): string {
  const camera = project.cameras[0], plan = project.floorPlan;
  if (!camera || !plan) return '';
  const wall = plan.structures.find(item => item.id === wallId);
  if (wall?.geometry.kind !== 'segment') return '';
  const x = (wall.geometry.end.x - wall.geometry.start.x) * plan.width, y = (wall.geometry.end.y - wall.geometry.start.y) * plan.height;
  const radians = camera.directionDegrees * Math.PI / 180;
  const alongSight = Math.abs(x * Math.cos(radians) + y * Math.sin(radians)) / Math.max(1, Math.hypot(x, y));
  const orientation = alongSight < .35 ? 'This wall runs across the view, perpendicular to the sight line; do not transfer this element to a side wall.' : alongSight > .85 ? 'This is a side wall running along the sight line, not the wall across the room.' : 'Keep this element on this angled wall plane.';
  const openings = plan.structures.filter(item => item.id !== openingId && item.parentWallId === wall.id && ['window', 'door', 'entrance'].includes(item.kind));
  return `${orientation} ${openings.length ? `It shares the SAME wall plane with ${openings.map(item => `${boundedText(item.name)}${item.wallSpan ? ` at wall span ${percent(item.wallSpan.start)}–${percent(item.wallSpan.end)}` : ''}`).join(', ')}; preserve these openings and keep the design at its own saved span. ` : ''}`;
}

function transferIntent(element: DesignElement): string {
  if (element.kind === 'ambient-light') return 'Transfer illumination only: light warmth, softness, direction, falloff and indirect bounce within the specified target. Keep the existing paint, material albedo, room geometry and neutral whites. A warm light reference is NOT a yellow wall/floor color reference or a global yellow image filter. Use plausible concealed strips, coves or wall wash where appropriate; do not copy unrelated furniture or the reference room. ';
  if (['ceiling-light', 'wall-light', 'standing-light'].includes(element.kind)) return 'Transfer the selected light fixture and its localized illumination, mounted on the specified ceiling/wall/floor target. Preserve unrelated room materials and avoid a global color cast. ';
  if (['global-palette', 'floor-material', 'wall-material'].includes(element.kind)) return 'Transfer only the deliberately selected color/material treatment to its saved area or surface; do not import the reference room layout or unrelated objects. ';
  if (element.kind === 'wall-graphic') return 'Transfer this graphic as a removable print/lettering treatment on the saved wall plane. Architectural curves, arches, niches, sculpted walls and room corners in its reference photo are NOT part of this graphic and must not become room geometry. Keep the underlying wall plane intact. ';
  if (['freestanding-fixture', 'furniture', 'display-product', 'photozone', 'wall-mounted-product', 'wall-graphic'].includes(element.kind)) return 'Transfer only this named object/graphic, not the reference background or room layout. Preserve its recognizable form/material; use physical support, contact shadows and a plausible installed scale. ';
  return 'Transfer only the named design attribute within its saved target, never the reference room geometry. ';
}

function relativeToCamera(project: Project, element: DesignElement): string {
  const point = elementPlanPosition(project, element);
  return point ? `Relative to this camera: ${cameraRelation(project, point)}. ` : '';
}

function cameraRelation(project: Project, point: Point): string {
  const camera = project.cameras[0], plan = project.floorPlan;
  if (!camera || !point || !plan) return '';
  // The caller narrows cameras to the chosen output view. Directions use physical
  // plan aspect, rather than treating a portrait plan as a square.
  const radians = camera.directionDegrees * Math.PI / 180;
  const x = (point.x - camera.x) * plan.width, y = (point.y - camera.y) * plan.height;
  const forward = x * Math.cos(radians) + y * Math.sin(radians);
  const right = -x * Math.sin(radians) + y * Math.cos(radians);
  const tolerance = Math.min(plan.width, plan.height) * .025;
  return `${forward >= 0 ? 'in front' : 'behind the camera; do not force it into view'}, ${Math.abs(right) < tolerance ? 'near the sight line' : right > 0 ? 'camera-right' : 'camera-left'}`;
}

/** Translate saved 2D relationships into view-specific instructions, never inferred geometry. */
function structureViewText(project: Project, structure: Structure): string {
  const geometry = structure.geometry;
  const point = geometry.kind === 'segment' ? { x: (geometry.start.x + geometry.end.x) / 2, y: (geometry.start.y + geometry.end.y) / 2 }
    : geometry.kind === 'circle' ? geometry.center
      : { x: geometry.bounds.x + geometry.bounds.width / 2, y: geometry.bounds.y + geometry.bounds.height / 2 };
  let instruction = '';
  if (structure.kind === 'pillar') {
    instruction = geometry.kind === 'rect' ? 'Rectangular column cross-section: flat faces and sharp corners, never a cylindrical column.'
      : geometry.kind === 'circle' ? 'Circular column cross-section: preserve its round form, not a rectangular column.'
        : 'Preserve the column cross-section drawn in the saved plan.';
  } else {
    const wall = project.floorPlan?.structures.find(item => item.id === structure.parentWallId);
    if (wall) {
      instruction = `Attached to the saved wall ${boundedText(wall.name)}${structure.wallSpan ? ` at wall span ${percent(structure.wallSpan.start)}–${percent(structure.wallSpan.end)}` : ''}. ` +
        wallPlaneContext(project, wall.id, structure.id);
    }
    instruction += 'Do not relocate this opening to another wall, enlarge it, cover it or replace it with a graphic.';
  }
  return `- ${boundedText(structure.name)} [${structure.kind}]: ${cameraRelation(project, point)}. ${instruction}`;
}

function hasRectangularRoomShell(project: Project): boolean {
  const plan = project.floorPlan;
  const floors = plan?.areas.filter(area => area.kind === 'floor') ?? [];
  if (!plan || plan.kind !== 'schematic' || floors.length !== 1 || floors[0].outline) return false;
  const bounds = floors[0].bounds;
  const corners = [{ x: bounds.x, y: bounds.y }, { x: bounds.x + bounds.width, y: bounds.y },
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height }, { x: bounds.x, y: bounds.y + bounds.height }];
  const walls = plan.structures.filter(item => item.kind === 'wall' && item.role !== 'partition');
  const same = (a: typeof corners[number], b: typeof corners[number]) => Math.abs(a.x - b.x) < .001 && Math.abs(a.y - b.y) < .001;
  return walls.length === 4 && corners.every((start, index) => {
    const end = corners[(index + 1) % corners.length];
    return walls.some(wall => wall.geometry.kind === 'segment' &&
      (same(wall.geometry.start, start) && same(wall.geometry.end, end) || same(wall.geometry.start, end) && same(wall.geometry.end, start)));
  });
}

/** Builds model guidance from user-saved conditions; it does not claim geometric guarantees. */
export function buildGenerationPrompt(project: Project, cameraId: string, images: GenerationImage[]): string {
  const camera = project.cameras.find((entry) => entry.id === cameraId);
  if (!camera || !project.floorPlan) throw new Error('카메라와 도면을 확인해 주세요.');
  const plan = project.floorPlan;
  for (const image of images) {
    if (image.role === 'reference-sheet') { const index = Number(image.sourceId.replace('reference-sheet-', '')); if (!matchesReferenceSheet(referenceSheetGroups(project)[index], image.sheet)) throw new Error('레퍼런스 모음과 적용 자료가 일치하지 않습니다.'); continue; }
    if (image.role !== 'product' && image.role !== 'inspiration') continue;
    if (!matchesReferencePreparation(referencePreparationFor(project, image.sourceId), image.referencePreparation)) {
      throw new Error('선택한 이미지 영역과 생성 입력이 일치하지 않습니다.');
    }
  }
  const imageLines = images.map((image, index) => {
    const source = project.sourceImages.find((entry) => entry.id === image.sourceId);
    const label = image.role === 'floor-plan' ? 'saved top-down plan guide with the selected camera arrow (registered plan background included when uploaded)' : boundedText(source?.name ?? image.role);
    const sheetDescription = image.sheet ? ` numbered panels: ${image.sheet.map((source, i) => `${i + 1} = ${boundedText(project.sourceImages.find(item => item.id === source.sourceId)?.name ?? source.sourceId)}`).join('; ')}` : '';
    const prepared = image.referencePreparation?.mode === 'crop' ? ' (user-selected crop)' :
      image.referencePreparation?.mode === 'grid' ? ` (${image.referencePreparation.regions.length} user-selected crops in reading-order grid panels)` : '';
    return `${index + 1}. ${image.role}: ${label}${prepared}${sheetDescription}`;
  });
  const fixed = plan.structures.filter((item) => item.immutable || item.protected);
  const editable = plan.structures.filter((item) => !item.immutable && !item.protected);
  const applied = project.elements.filter((item) => item.status === 'apply');
  const excluded = project.elements.filter((item) => item.status === 'exclude');
  const rectangularRoom = hasRectangularRoomShell(project);
  const prompt = [
    'Create ONE photorealistic interior concept photograph of an installed pop-up retail/VMD space from the selected camera, not a top-down plan, isometric dollhouse, diagram, collage or reference-room copy.',
    'Color fidelity: match the existing-space photo paint and material colors. With warm indirect lighting, use balanced daylight/neutral general illumination and exposure; show warmth locally around light emitters and nearby bounce, while white walls and unlit surfaces remain neutral white. Do not give the entire room an amber, brown or sepia wash. An explicit saved palette/material element may change only its own target.',
    'Input image roles, in order:',
    ...imageLines,
    'The existing-space photograph supplies the current room appearance and visible architectural character. The saved top-down plan guide supplies the authoritative 2D layout: room outline/aspect, wall openings, pillars, fixture footprints and selected camera arrow. Reconcile the photograph with those saved positions. Inspiration and product images supply ONLY the named design attributes and are NEVER spatial geometry. Follow the plan layout before styling; do not substitute any reference-room composition.',
    rectangularRoom ? 'The saved room footprint is a RECTANGLE: preserve four straight vertical wall planes, square room corners and straight floor/ceiling junctions. Do not bow or curve the room walls, round its corners, or turn the room into an oval. A curved display fixture is a separate object inside this rectangular room; its curvature must not deform the room shell.' : 'Preserve the actual registered room outline and its corners from the saved plan guide. Do not simplify a traced irregular/curved outline into a default rectangle or import a new outline from an inspiration image.',
    'All saved straight structural wall segments must remain straight planar surfaces at their registered positions. Add curved architectural geometry only where the saved plan actually specifies it. Keep existing ceiling/wall/floor geometry; lighting and wall graphics do not create new bowed walls, niches, arches or sculpted architectural edges.',
    'Camera-space architecture before styling (positions and cross-sections come from the saved plan, not inspiration images):',
    ...plan.structures.filter(item => ['window', 'door', 'entrance', 'pillar'].includes(item.kind)).map(item => structureViewText({ ...project, cameras: [camera] }, item)),
    `Project: ${boundedText(project.name)}. Space type: ${boundedText(project.spaceType)}. Intended concept: ${boundedText(project.concept, 500)}.`,
    `Plan source: ${plan.kind}. Geometry confidence: ${plan.geometryConfidence}. Plan coordinates are normalized: x increases to the right and y increases downward. Do not invent precise dimensions from a schematic plan or any photograph.`,
    'Preserve structures explicitly marked as protected/Keep. Do not demolish, move, occlude openings or replace protected geometry. Compatible removable decoration may be mounted on a kept wall without changing its geometry. Keep door circulation, windows and pillars clear. Follow the registered plan positions for structures whose preservation lock the user released; releasing a lock is not evidence of construction feasibility.',
    `Protected structures (${fixed.length}):`,
    ...fixed.map((item) => `- ${boundedText(item.name)} [${item.kind}]: ${geometryText(item.geometry)}.${item.lightTone ? ` Existing light tone: ${boundedText(item.lightTone)}.` : ''}`),
    'Saved preservation conditions:',
    ...project.keeps.map((keep) => `- ${boundedText(plan.structures.find((item) => item.id === keep.structureId)?.name ?? keep.structureId)}: ${boundedText(keep.description)}. Keep the underlying structure intact; compatible removable wall decoration is allowed. Never demolish or replace a preserved structure.`),
    'User-editable plan structures (follow these saved positions; do not add an automatic preservation lock):',
    ...editable.map((item) => `- ${boundedText(item.name)} [${item.kind}, ${item.role ?? 'unspecified origin'}]: ${geometryText(item.geometry)}.${item.lightTone ? ` Light tone: ${boundedText(item.lightTone)}.` : ''}`),
    'Registered plan areas and circulation:',
    ...plan.areas.map((area) => area.outline ? `- ${boundedText(area.name)} [${area.kind}] manually traced polygon: ${area.outline.map(p => `(${percent(p.x)}, ${percent(p.y)})`).join(' → ')}.` : `- ${boundedText(area.name)} [${area.kind}] rectangle (${percent(area.bounds.x)}, ${percent(area.bounds.y)}), width ${percent(area.bounds.width)}, height ${percent(area.bounds.height)}.`),
    'Applied design elements and their compatible targets:',
    ...applied.map((element) => `- ${elementText({ ...project, cameras: [camera] }, element, images)}`),
    'Excluded design elements and appearance:',
    ...(excluded.length ? excluded.map((element) => `- Do not add ${boundedText(element.label)}. ${boundedText(element.conditions ?? '')}`) : ['- None specified.']),
    ...project.references.flatMap((reference) => reference.exclusions.map((excludedNote) => `- Do not add ${boundedText(excludedNote)} from reference ${boundedText(project.sourceImages.find((image) => image.id === reference.imageId)?.name ?? reference.imageId)}.`)),
    `Viewpoint: camera at (${percent(camera.x)}, ${percent(camera.y)}), direction ${Math.round(camera.directionDegrees)} degrees, where 0 degrees points right, 90 down, 180 left and 270 up. Field of view: ${camera.fovPreset ?? 'standard'}. Compose from this approximate viewpoint.`,
    'Preserve foreground/background ordering and relative left/right positions from the camera arrow. Render a natural interior photograph with plausible eye-level perspective, realistic commercial display scale, product supports, contact shadows, restrained reflected light and neutral material colors unless a saved color/material element explicitly changes them. Show the proposed elements only at their specified floor, wall, ceiling or room regions. Do not render plan labels, camera markers, passage hatching, technical overlays or multiple panels. The result is a concept visualization, not a verified architectural drawing.',
  ].join('\n');
  if (prompt.length > 16_000) throw new Error('생성 조건이 너무 길어 요청할 수 없습니다. 구조와 조건을 정리해 주세요.');
  return prompt;
}
