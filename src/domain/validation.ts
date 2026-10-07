import { areaContainsPoint, areaContainsRect, areaContainsSegment, areaIntersectsRect, areaIntersectsSegment, areaIntersectsCircle, outlineBounds, validOutline } from './geometry.js';
import { isDisplaySupport } from './display.js';
import { LIGHT_PLAN_FOOTPRINT } from './layoutDefaults.js';
import type {
  Area,
  DesignElement,
  ElementKind,
  PlacementTarget,
  Point,
  Project,
  Rect,
  Structure,
  StructureGeometry,
  ValidationIssue,
  ValidationResult,
} from './types.js';

export type TargetKind = PlacementTarget['kind'];

function isPartition(structure: Structure): boolean {
  return structure.role === 'partition' || (!structure.role && structure.kind === 'wall' && structure.immutable === false);
}

const TARGETS: Record<ElementKind, readonly TargetKind[]> = {
  'display-product': ['fixture-surface'],
  'other-floor': ['floor-point'],
  'other-wall': ['wall-segment'],
  'other-ceiling': ['ceiling-zone'],
  'other-area': ['whole-space', 'named-area'],
  'freestanding-fixture': ['floor-point', 'floor-area'],
  furniture: ['floor-point', 'floor-area'],
  photozone: ['wall-segment'],
  'wall-graphic': ['wall-segment'],
  'wall-mounted-product': ['wall-segment'],
  'ceiling-light': ['ceiling-zone'],
  'hanging-display': ['ceiling-zone'],
  'wall-light': ['wall-segment'],
  'standing-light': ['floor-point'],
  'ambient-light': ['whole-space', 'named-area'],
  'global-palette': ['whole-space', 'named-area'],
  'floor-material': ['floor-area'],
  'wall-material': ['wall-segment'],
};

/** Plan-display tolerance for a camera point on a wall line; not a measured clearance. */
const CAMERA_WALL_TOLERANCE = 0.008;
/** Drawing-display tolerance only; it does not assert a measured clearance. */
const DRAWING_TOLERANCE = 0.003;

export function allowedTargetKinds(kind: ElementKind): readonly TargetKind[] {
  return TARGETS[kind];
}

function result(issues: ValidationIssue[]): ValidationResult {
  return { valid: !issues.some((issue) => issue.severity === 'error'), issues };
}

function error(code: ValidationIssue['code'], message: string, elementId?: string, structureId?: string): ValidationIssue {
  return { code, message, severity: 'error', elementId, structureId };
}

function isFraction(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function validRect(rect: Rect): boolean {
  return isFraction(rect.x) && isFraction(rect.y) &&
    Number.isFinite(rect.width) && Number.isFinite(rect.height) &&
    rect.width > 0 && rect.height > 0 &&
    rect.x + rect.width <= 1 && rect.y + rect.height <= 1;
}

function containsPoint(rect: Rect, point: Point): boolean {
  return point.x >= rect.x && point.x <= rect.x + rect.width &&
    point.y >= rect.y && point.y <= rect.y + rect.height;
}


function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x &&
    a.y < b.y + b.height && a.y + a.height > b.y;
}

/** Includes a boundary touch: a partition cannot pass through a reserved zone. */
function segmentIntersectsRect(start: Point, end: Point, rect: Rect): boolean {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const p = [-dx, dx, -dy, dy];
  const q = [start.x - rect.x, rect.x + rect.width - start.x,
    start.y - rect.y, rect.y + rect.height - start.y];
  let first = 0;
  let last = 1;
  for (let index = 0; index < p.length; index += 1) {
    if (Math.abs(p[index]) < Number.EPSILON) {
      if (q[index] < 0) return false;
      continue;
    }
    const crossing = q[index] / p[index];
    if (p[index] < 0) first = Math.max(first, crossing);
    else last = Math.min(last, crossing);
    if (first > last) return false;
  }
  return true;
}

/** A passage may end at a wall/entrance boundary, but must not cross a wall inside. */
function segmentIntersectsRectInterior(start: Point, end: Point, rect: Rect): boolean {
  const inset = 1e-9;
  if (rect.width <= inset * 2 || rect.height <= inset * 2) return false;
  return segmentIntersectsRect(start, end, {
    x: rect.x + inset, y: rect.y + inset,
    width: rect.width - inset * 2, height: rect.height - inset * 2,
  });
}

function segmentIntersectsCircle(start: Point, end: Point, circle: { center: Point; radius: number }, width: number, height: number): boolean {
  const dx = (end.x - start.x) * width;
  const dy = (end.y - start.y) * height;
  const distanceSquared = dx * dx + dy * dy;
  const offsetX = (circle.center.x - start.x) * width;
  const offsetY = (circle.center.y - start.y) * height;
  const fraction = distanceSquared ? Math.max(0, Math.min(1, (offsetX * dx + offsetY * dy) / distanceSquared)) : 0;
  const gapX = offsetX - fraction * dx;
  const gapY = offsetY - fraction * dy;
  const radius = circle.radius * Math.min(width, height);
  return gapX * gapX + gapY * gapY <= radius * radius;
}

function floorFootprintRect(target: Extract<PlacementTarget, { kind: 'floor-point' }>, planWidth: number, planHeight: number): Rect {
  const footprint = target.footprint ?? { width: 0.06, height: 0.06 };
  const angle = (target.rotationDegrees ?? 0) * Math.PI / 180;
  const cos = Math.abs(Math.cos(angle));
  const sin = Math.abs(Math.sin(angle));
  const width = Math.max(1, planWidth);
  const height = Math.max(1, planHeight);
  const rotatedWidth = (cos * footprint.width * width + sin * footprint.height * height) / width;
  const rotatedHeight = (sin * footprint.width * width + cos * footprint.height * height) / height;
  return {
    x: target.x - rotatedWidth / 2,
    y: target.y - rotatedHeight / 2,
    width: rotatedWidth,
    height: rotatedHeight,
  };
}

function circleIntersectsRect(circle: { center: Point; radius: number }, rect: Rect, planWidth: number, planHeight: number): boolean {
  const width = Math.max(1, planWidth);
  const height = Math.max(1, planHeight);
  const centerX = circle.center.x * width;
  const centerY = circle.center.y * height;
  const nearestX = Math.max(rect.x * width, Math.min(centerX, (rect.x + rect.width) * width));
  const nearestY = Math.max(rect.y * height, Math.min(centerY, (rect.y + rect.height) * height));
  const radius = circle.radius * Math.min(width, height);
  return (nearestX - centerX) ** 2 + (nearestY - centerY) ** 2 < radius ** 2;
}

function circleContainsPoint(circle: { center: Point; radius: number }, point: Point, planWidth: number, planHeight: number): boolean {
  const width = Math.max(1, planWidth);
  const height = Math.max(1, planHeight);
  const dx = (point.x - circle.center.x) * width;
  const dy = (point.y - circle.center.y) * height;
  const radius = circle.radius * Math.min(width, height);
  return dx * dx + dy * dy <= radius * radius;
}

function areaById(project: Project, areaId: string): Area | undefined {
  return project.floorPlan?.areas.find((area) => area.id === areaId);
}

function structureById(project: Project, structureId: string): Structure | undefined {
  return project.floorPlan?.structures.find((structure) => structure.id === structureId);
}

function isPreserved(project: Project, structure: Structure): boolean {
  return !!structure.preservationRequired || !!structure.immutable || structure.protected || project.keeps.some((keep) => keep.structureId === structure.id);
}

export function physicalFloorBounds(project: Project, element: DesignElement, target = element.target): Rect | undefined {
  if (!project.floorPlan || !target || !['freestanding-fixture', 'furniture', 'standing-light', 'other-floor'].includes(element.kind)) return;
  if (target.kind === 'floor-point') return floorFootprintRect(target, project.floorPlan.width, project.floorPlan.height);
  if (target.kind === 'floor-area') return areaById(project, target.areaId)?.bounds;
}

function sameRect(a: Rect, b: Rect): boolean {
  return (['x', 'y', 'width', 'height'] as const).every((key) => Math.abs(a[key] - b[key]) <= DRAWING_TOLERANCE);
}

function spanOverlap(a: { start: number; end: number }, b: { start: number; end: number }): boolean {
  return Math.min(a.end, b.end) - Math.max(a.start, b.start) > DRAWING_TOLERANCE;
}

function segmentsOverlap(a: Extract<Structure['geometry'], { kind: 'segment' }>, b: Extract<Structure['geometry'], { kind: 'segment' }>): boolean {
  const dx = a.end.x - a.start.x, dy = a.end.y - a.start.y;
  const length = Math.hypot(dx, dy);
  if (!length) return false;
  const onLine = (point: Point) => Math.abs(dx * (point.y - a.start.y) - dy * (point.x - a.start.x)) / length <= DRAWING_TOLERANCE;
  if (!onLine(b.start) || !onLine(b.end)) return false;
  const project = (point: Point) => ((point.x - a.start.x) * dx + (point.y - a.start.y) * dy) / (length * length);
  const first = project(b.start), last = project(b.end);
  return (Math.min(1, Math.max(first, last)) - Math.max(0, Math.min(first, last))) * length > DRAWING_TOLERANCE;
}

/** Junctions at segment ends are valid; crossing through a wall's interior is not. */
function segmentsCross(a: Extract<Structure['geometry'], { kind: 'segment' }>, b: Extract<Structure['geometry'], { kind: 'segment' }>): boolean {
  const ax = a.end.x - a.start.x, ay = a.end.y - a.start.y;
  const bx = b.end.x - b.start.x, by = b.end.y - b.start.y;
  const cross = ax * by - ay * bx;
  if (Math.abs(cross) < Number.EPSILON) return false;
  const dx = b.start.x - a.start.x, dy = b.start.y - a.start.y;
  const at = (dx * by - dy * bx) / cross;
  const bt = (dx * ay - dy * ax) / cross;
  return at > DRAWING_TOLERANCE && at < 1 - DRAWING_TOLERANCE && bt >= 0 && bt <= 1;
}

function geometryOverlaps(project: Project, a: Structure['geometry'], b: Structure['geometry']): boolean {
  const plan = project.floorPlan!;
  if (a.kind === 'segment') {
    if (b.kind === 'segment') return segmentsOverlap(a, b);
    if (b.kind === 'rect') return segmentIntersectsRect(a.start, a.end, b.bounds);
    return segmentIntersectsCircle(a.start, a.end, b, plan.width, plan.height);
  }
  if (a.kind === 'rect') {
    if (b.kind === 'rect') return intersects(a.bounds, b.bounds);
    if (b.kind === 'circle') return circleIntersectsRect(b, a.bounds, plan.width, plan.height);
    return segmentIntersectsRect(b.start, b.end, a.bounds);
  }
  if (b.kind === 'rect') return circleIntersectsRect(a, b.bounds, plan.width, plan.height);
  if (b.kind === 'segment') return segmentIntersectsCircle(b.start, b.end, a, plan.width, plan.height);
  const radius = (a.radius + b.radius) * Math.min(plan.width, plan.height);
  return Math.hypot((a.center.x - b.center.x) * plan.width, (a.center.y - b.center.y) * plan.height) < radius;
}

function geometryIntersectsRect(project: Project, geometry: Structure['geometry'], rect: Rect): boolean {
  if (geometry.kind === 'rect') return intersects(geometry.bounds, rect);
  if (geometry.kind === 'segment') return segmentIntersectsRect(geometry.start, geometry.end, rect);
  return circleIntersectsRect(geometry, rect, project.floorPlan!.width, project.floorPlan!.height);
}

/** Positioned lights occupy a schematic footprint; unpositioned legacy fixtures
 * still reserve their zone because their location/extent is unknown. */
function ceilingBounds(project: Project, element: DesignElement, target = element.target): Rect | undefined {
  if (target?.kind !== 'ceiling-zone') return;
  const area = areaById(project, target.zoneId);
  if (!area) return;
  if (element.kind !== 'ceiling-light' || !target.offset) return area.bounds;
  return {
    x: area.bounds.x + area.bounds.width * target.offset.x - LIGHT_PLAN_FOOTPRINT.width / 2,
    y: area.bounds.y + area.bounds.height * target.offset.y - LIGHT_PLAN_FOOTPRINT.height / 2,
    ...LIGHT_PLAN_FOOTPRINT,
  };
}

function validateElementOccupancy(project: Project, element: DesignElement, target: PlacementTarget): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const floor = physicalFloorBounds(project, element, target);
  const ceiling = ceilingBounds(project, element, target);
  const wallPhysical = ['photozone', 'wall-graphic', 'wall-mounted-product', 'wall-light', 'other-wall'].includes(element.kind);
  for (const other of project.elements) {
    if (other.id === element.id || other.status !== 'apply' || !other.target) continue;
    let overlap = false;
    const otherFloor = physicalFloorBounds(project, other);
    if (floor && otherFloor && validRect(floor) && validRect(otherFloor)) overlap = intersects(floor, otherFloor);
    if (target.kind === 'wall-segment' && other.target.kind === 'wall-segment' && target.wallId === other.target.wallId) {
      const sameLayer = wallPhysical && ['photozone', 'wall-graphic', 'wall-mounted-product', 'wall-light', 'other-wall'].includes(other.kind) || element.kind === 'wall-material' && other.kind === 'wall-material';
      const wall = structureById(project, target.wallId);
      const differentFaces = wall?.role === 'partition' && target.face && other.target.face && target.face !== other.target.face;
      if (sameLayer && !differentFaces) overlap = spanOverlap(target, other.target);
    }
    const otherCeiling = ceilingBounds(project, other);
    if (ceiling && otherCeiling) overlap = intersects(ceiling, otherCeiling);
    if (element.kind === 'floor-material' && other.kind === 'floor-material' && target.kind === 'floor-area' && other.target.kind === 'floor-area') {
      const area = areaById(project, target.areaId), otherArea = areaById(project, other.target.areaId);
      if (area && otherArea) overlap = intersects(area.bounds, otherArea.bounds);
    }
    if (overlap) issues.push(error('element-overlap', ceiling
      ? `${other.label}과 천장 위치가 겹칩니다. 다른 천장 위치를 선택해 주세요.${element.kind !== 'ceiling-light' || target.kind !== 'ceiling-zone' || !target.offset || other.kind !== 'ceiling-light' || other.target.kind !== 'ceiling-zone' || !other.target.offset ? ' 점유 크기가 없는 천장 요소는 연결한 영역 전체를 사용합니다.' : ''}`
      : `${other.label}이(가) 이미 이 위치를 사용하고 있습니다. 같은 바닥·벽 위치에 두 요소를 겹쳐 배치할 수 없습니다. 다른 위치나 더 작은 영역을 선택해 주세요.`, element.id));
  }
  if (ceiling) {
    for (const fixture of project.floorPlan!.structures.filter((item) => item.kind === 'existing-light')) {
      if (geometryIntersectsRect(project, fixture.geometry, ceiling)) issues.push(error('element-overlap', `${fixture.name}이(가) 있는 천장 위치입니다. 기존 조명을 피해 배치해 주세요.`, element.id, fixture.id));
    }
  }
  return issues;
}

/** Validate the proposed geometry, not just whether a partition may be edited. */
export function validatePartitionPlacement(project: Project, start: Point, end: Point, ignoredStructureId?: string): ValidationResult {
  const plan = project.floorPlan;
  if (!plan) return result([error('missing-plan', '가벽을 표시하려면 먼저 도면이 필요합니다.')]);
  if (![start.x, start.y, end.x, end.y].every(isFraction) || Math.hypot(end.x - start.x, end.y - start.y) < 0.02) {
    return result([error('invalid-coordinate', '가벽은 도면 안에 길이를 유지하며 배치해 주세요.')]);
  }

  const issues: ValidationIssue[] = [];
  const floorAreas = plan.areas.filter((area) => area.kind === 'floor');
  if (!floorAreas.some((area) => areaContainsSegment(area, start, end))) {
    issues.push(error('outside-floor', '가벽의 시작과 끝을 사용 가능한 바닥 영역 안에 놓아 주세요.'));
  }
  for (const element of project.elements) {
    if (element.status !== 'apply' || !element.target) continue;
    const target = element.target;
    const occupied = target.kind === 'floor-point'
      ? floorFootprintRect(target, plan.width, plan.height)
      : target.kind === 'floor-area' && (element.kind === 'freestanding-fixture' || element.kind === 'furniture')
        ? plan.areas.find((area) => area.id === target.areaId && area.kind === 'floor')?.bounds
        : undefined;
    if (occupied && validRect(occupied) && segmentIntersectsRect(start, end, occupied)) {
      issues.push(error('partition-conflict', `가벽이 ${element.label}의 배치 영역을 가로지릅니다. 요소를 옮기거나 가벽 위치를 바꿔 주세요.`, element.id));
    }
  }
  const width = Math.max(1, plan.width);
  const height = Math.max(1, plan.height);
  for (const camera of project.cameras) {
    // Untouched recommendations are provisional, hidden layout helpers.
    // STEP 04 recovers them after geometry edits; manual cameras stay protected.
    if (camera.recommendation === 'automatic') continue;
    if (segmentIntersectsCircle(start, end,
      { center: camera, radius: CAMERA_WALL_TOLERANCE }, width, height)) {
      issues.push({ ...error('partition-conflict', `가벽이 ${camera.name} 카메라 위치와 겹칩니다. 카메라나 가벽을 옮겨 주세요.`), cameraId: camera.id });
    }
  }
  for (const structure of plan.structures) {
    if (structure.id === ignoredStructureId) continue;
    if (structure.kind === 'wall' && structure.geometry.kind === 'segment') {
      const candidate = { kind: 'segment' as const, start, end };
      if (segmentsOverlap(candidate, structure.geometry) || segmentsCross(candidate, structure.geometry)) {
        issues.push(error('structure-overlap', `${structure.name} 벽 선과 겹치거나 가로지릅니다. 다른 위치에 가벽을 그려 주세요.`, undefined, structure.id));
      }
    }
    if (structure.kind === 'pillar') {
      const hit = structure.geometry.kind === 'rect'
        ? segmentIntersectsRect(start, end, structure.geometry.bounds)
        : structure.geometry.kind === 'circle' && segmentIntersectsCircle(start, end, structure.geometry, width, height);
      if (hit) issues.push(error('pillar-collision', `가벽이 ${structure.name}을(를) 가로지릅니다.`, undefined, structure.id));
    }
    if ((structure.kind === 'door' || structure.kind === 'entrance') && structure.clearance &&
        segmentIntersectsRect(start, end, structure.clearance)) {
      issues.push(error('door-clearance', `가벽이 ${structure.name}의 출입·여닫이 공간을 막습니다.`, undefined, structure.id));
    }
  }
  for (const area of plan.areas) {
    if (area.kind === 'passage' && (area.outline ? areaIntersectsSegment(area, start, end) : segmentIntersectsRect(start, end, area.bounds))) {
      issues.push(error('passage-blocked', `가벽이 ${area.name} 동선을 가로지릅니다.`));
    }
  }
  return result(issues);
}

/** Validates new structure markings before they become preserved source geometry. */
export function validateStructureDrawing(project: Project, candidate: Structure, ignoredStructureId?: string): ValidationResult {
  const plan = project.floorPlan;
  if (!plan) return result([error('missing-plan', '구조를 그리려면 먼저 도면이 필요합니다.')]);
  const geometry = candidate.geometry;
  const valid = geometry.kind === 'segment'
    ? [geometry.start.x, geometry.start.y, geometry.end.x, geometry.end.y].every(isFraction) && Math.hypot(geometry.end.x - geometry.start.x, geometry.end.y - geometry.start.y) > DRAWING_TOLERANCE
    : geometry.kind === 'rect' ? validRect(geometry.bounds)
      : [geometry.center.x, geometry.center.y].every(isFraction) && Number.isFinite(geometry.radius) && geometry.radius > 0 && validRect({
        x: geometry.center.x - geometry.radius * Math.min(plan.width, plan.height) / plan.width,
        y: geometry.center.y - geometry.radius * Math.min(plan.width, plan.height) / plan.height,
        width: geometry.radius * 2 * Math.min(plan.width, plan.height) / plan.width,
        height: geometry.radius * 2 * Math.min(plan.width, plan.height) / plan.height,
      });
  if (!valid) return result([error('invalid-coordinate', '구조의 전체 표시가 도면 안에 들어오도록 위치와 크기를 지정해 주세요.')]);
  const issues: ValidationIssue[] = [];
  const openings = ['window', 'door', 'entrance'];
  if (openings.includes(candidate.kind)) {
    const wall = structureById(project, candidate.parentWallId ?? '');
    const span = candidate.wallSpan;
    if (!wall || wall.kind !== 'wall' || wall.geometry.kind !== 'segment') return result([error('missing-structure', '창·문·출입구를 붙일 벽을 도면에서 선택해 주세요.')]);
    if (!span || !isFraction(span.start) || !isFraction(span.end) || span.start >= span.end || geometry.kind !== 'segment' || !segmentsOverlap(wall.geometry, geometry)) {
      return result([error('invalid-coordinate', `${wall.name}의 강조된 선을 따라 시작점에서 끝점까지 끌어 주세요.`, undefined, wall.id)]);
    }
    for (const other of plan.structures) {
      if (other.id === ignoredStructureId || other.parentWallId !== wall.id || !other.wallSpan || !openings.includes(other.kind) || !spanOverlap(span, other.wallSpan)) continue;
      // A door and its entrance describe the same opening; two doors/windows do not.
      const sharedDoorOpening = (candidate.kind === 'door' && other.kind === 'entrance' || candidate.kind === 'entrance' && other.kind === 'door') &&
        Math.abs(span.start - other.wallSpan.start) <= DRAWING_TOLERANCE && Math.abs(span.end - other.wallSpan.end) <= DRAWING_TOLERANCE;
      if (!sharedDoorOpening) issues.push(error('opening-overlap', `${other.name}이(가) 이미 이 벽 구간에 있습니다. 비어 있는 벽 구간을 선택해 주세요.`, undefined, other.id));
    }
    for (const pillar of plan.structures.filter(item => item.kind === 'pillar' && item.id !== ignoredStructureId)) {
      if (geometryOverlaps(project, geometry, pillar.geometry) || candidate.clearance && geometryIntersectsRect(project, pillar.geometry, candidate.clearance)) issues.push(error('pillar-collision', `${pillar.name}과 창·문·출입 공간이 겹칩니다. 기둥을 피한 벽 구간을 선택해 주세요.`, undefined, pillar.id));
    }
    for (const element of project.elements) {
      if (element.status === 'apply' && element.target?.kind === 'wall-segment' && element.target.wallId === wall.id && spanOverlap(span, element.target)) {
        issues.push(error('element-overlap', `${element.label}이(가) 배치된 벽 구간입니다. 요소를 먼저 옮기거나 다른 벽 구간을 선택해 주세요.`, element.id));
      }
      const occupied = element.status === 'apply' ? physicalFloorBounds(project, element) : undefined;
      if (candidate.clearance && occupied && intersects(candidate.clearance, occupied)) {
        issues.push(error('door-clearance', `${element.label}이(가) 놓인 바닥과 문 여닫이·출입 공간이 겹칩니다. 요소를 먼저 옮기거나 다른 개구부 위치를 선택해 주세요.`, element.id));
      }
    }
  } else {
    for (const other of plan.structures) {
      if (other.id === ignoredStructureId || other.kind !== candidate.kind) continue;
      if (geometryOverlaps(project, geometry, other.geometry)) issues.push(error('structure-overlap', `${other.name}이(가) 이미 이 위치에 있습니다. 같은 구조를 겹쳐 그릴 수 없습니다.`, undefined, other.id));
    }
  }
  if (candidate.kind === 'wall' && geometry.kind === 'segment') {
    // Original structure may be marked before a usable floor is registered. Its
    // geometry still cannot silently intersect already placed elements/cameras.
    const placementIssues = validatePartitionPlacement(project, geometry.start, geometry.end, ignoredStructureId).issues;
    return result(placementIssues.filter((issue) => isPartition(candidate) || issue.code !== 'outside-floor').map((issue) => ({
      ...issue, message: issue.message.replace(/^가벽이 /, `${candidate.name}이(가) `),
    })));
  }
  if (candidate.kind === 'pillar' || candidate.kind === 'existing-light') {
    for (const element of project.elements) {
      if (element.status !== 'apply') continue;
      const occupied = candidate.kind === 'pillar' ? physicalFloorBounds(project, element) : ceilingBounds(project, element);
      if (occupied && geometryIntersectsRect(project, geometry, occupied)) issues.push(error('element-overlap', `${element.label}이(가) 사용 중인 위치입니다. 요소를 먼저 옮기거나 다른 위치를 선택해 주세요.`, element.id));
    }
    if (candidate.kind === 'pillar') {
      for (const wall of plan.structures) {
        if (wall.kind !== 'wall' || wall.geometry.kind !== 'segment') continue;
        const overlap = geometry.kind === 'rect' ? segmentIntersectsRectInterior(wall.geometry.start, wall.geometry.end, geometry.bounds)
          : geometry.kind === 'circle' && segmentIntersectsCircle(wall.geometry.start, wall.geometry.end, geometry, plan.width, plan.height);
        if (overlap) issues.push(error('structure-overlap', `${wall.name}의 벽 선을 가로질러 기둥을 놓을 수 없습니다. 벽과 겹치지 않는 위치를 선택해 주세요.`, undefined, wall.id));
      }
      for (const area of plan.areas) {
        if (area.kind === 'passage' && geometryIntersectsArea(project, geometry, area)) issues.push(error('passage-blocked', `${area.name} 동선에 기둥을 겹쳐 그릴 수 없습니다. 동선 표시를 먼저 수정해 주세요.`));
      }
      for (const opening of plan.structures) {
        if (opening.clearance && geometryIntersectsRect(project, geometry, opening.clearance)) issues.push(error('door-clearance', `${opening.name}의 여닫이·출입 공간과 겹칩니다.`, undefined, opening.id));
      }
      for (const camera of project.cameras) {
        if (camera.recommendation === 'automatic') continue;
        const inside = geometry.kind === 'rect' ? containsPoint(geometry.bounds, camera)
          : geometry.kind === 'circle' && circleContainsPoint(geometry, camera, plan.width, plan.height);
        if (inside) issues.push({ ...error('invalid-camera', `${camera.name} 카메라가 있는 위치입니다. 카메라를 먼저 옮기거나 다른 위치를 선택해 주세요.`), cameraId: camera.id });
      }
    }
  }
  return result(issues);
}

/** Areas are semantic layers: floor/ceiling and connected passage regions may overlap. */
function geometryIntersectsArea(project: Project, geometry: StructureGeometry, area: Area): boolean {
  if (!area.outline) return geometryIntersectsRect(project, geometry, area.bounds);
  if (geometry.kind === 'rect') return areaIntersectsRect(area, geometry.bounds);
  if (geometry.kind === 'circle') return areaIntersectsCircle(area, geometry.center, geometry.radius, project.floorPlan!.width, project.floorPlan!.height);
  return areaIntersectsSegment(area, geometry.start, geometry.end);
}

export function validateAreaDrawing(project: Project, candidate: Area, ignoredAreaId?: string): ValidationResult {
  const plan = project.floorPlan;
  if (!plan) return result([error('missing-plan', '영역을 그리려면 먼저 도면이 필요합니다.')]);
  if (candidate.outline && (!validOutline(candidate.outline) || !sameRect(outlineBounds(candidate.outline), candidate.bounds))) return result([error('invalid-coordinate', '윤곽은 교차하지 않는 3–100개 점으로 그려 주세요.')]);
  if (!validRect(candidate.bounds)) return result([error('invalid-coordinate', '영역의 전체 표시가 도면 안에 들어오도록 그려 주세요.')]);
  const issues: ValidationIssue[] = [];
  for (const other of plan.areas) {
    if (other.id !== ignoredAreaId && other.kind === candidate.kind && sameRect(candidate.bounds, other.bounds) && JSON.stringify(candidate.outline) === JSON.stringify(other.outline)) issues.push(error('area-overlap', `${other.name}이(가) 같은 위치와 크기로 이미 표시돼 있습니다. 기존 영역을 사용하거나 다른 범위를 그려 주세요.`));
  }
  if (candidate.kind === 'passage') {
    for (const structure of plan.structures) {
      if (structure.kind === 'pillar' && geometryIntersectsArea(project, structure.geometry, candidate)) issues.push(error('pillar-collision', `${structure.name}이(가) 있는 곳은 통행 동선으로 표시할 수 없습니다. 기둥을 피해 그려 주세요.`, undefined, structure.id));
      if (structure.kind === 'wall' && structure.geometry.kind === 'segment' && areaIntersectsSegment(candidate, structure.geometry.start, structure.geometry.end)) {
        issues.push(error(isPartition(structure) ? 'partition-conflict' : 'structure-overlap', `${structure.name} 벽을 가로질러 동선을 표시할 수 없습니다. 벽의 안쪽 바닥에 그려 주세요.`, undefined, structure.id));
      }
    }
    for (const element of project.elements) {
      if (element.status !== 'apply') continue;
      const occupied = physicalFloorBounds(project, element);
      if (occupied && areaIntersectsRect(candidate, occupied)) issues.push(error('element-overlap', `${element.label}이(가) 놓인 바닥은 통행 동선으로 표시할 수 없습니다. 요소를 옮기거나 동선 범위를 바꿔 주세요.`, element.id));
    }
  }
  return result(issues);
}

function validateFloorPoint(project: Project, elementId: string, target: Extract<PlacementTarget, { kind: 'floor-point' }>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const footprint = target.footprint ?? { width: 0.06, height: 0.06 };
  if (!isFraction(target.x) || !isFraction(target.y) ||
      !Number.isFinite(footprint.width) || !Number.isFinite(footprint.height) ||
      footprint.width <= 0 || footprint.height <= 0 ||
      (target.rotationDegrees !== undefined && !Number.isFinite(target.rotationDegrees))) {
    return [error('invalid-coordinate', '위치와 점유 크기를 도면 안의 유효한 값으로 입력해 주세요.', elementId)];
  }

  // Use a conservative enclosing box after rotation, including diagonal poses.
  const footprintRect = floorFootprintRect(target, project.floorPlan!.width, project.floorPlan!.height);
  const floorAreas = project.floorPlan!.areas.filter((area) => area.kind === 'floor');
  if (!validRect(footprintRect) || !floorAreas.some((area) => areaContainsRect(area, footprintRect))) {
    issues.push(error('outside-floor', '요소의 점유 영역이 사용 가능한 바닥 범위를 벗어납니다.', elementId));
  }

  for (const structure of project.floorPlan!.structures) {
    if (structure.kind === 'wall' && structure.geometry.kind === 'segment' &&
        segmentIntersectsRect(structure.geometry.start, structure.geometry.end, footprintRect)) {
      issues.push(error(isPartition(structure) ? 'partition-conflict' : 'structure-overlap', `${structure.name} ${isPartition(structure) ? '가벽' : '벽'}과 겹칩니다. 다른 바닥 위치를 선택해 주세요.`, elementId, structure.id));
    }
    if (structure.kind === 'pillar') {
      const collides = structure.geometry.kind === 'rect'
        ? intersects(footprintRect, structure.geometry.bounds)
        : structure.geometry.kind === 'circle' && circleIntersectsRect(
          structure.geometry, footprintRect, project.floorPlan!.width, project.floorPlan!.height,
        );
      if (collides) {
        issues.push(error('pillar-collision', `${structure.name}과 겹칩니다. 기둥을 피해서 배치해 주세요.`, elementId, structure.id));
      }
    }
    if ((structure.kind === 'door' || structure.kind === 'entrance') && structure.clearance &&
        intersects(footprintRect, structure.clearance)) {
      issues.push(error('door-clearance', `${structure.name}의 여닫이·출입 공간을 가립니다.`, elementId, structure.id));
    }
  }

  for (const area of project.floorPlan!.areas) {
    if (area.kind === 'passage' && areaIntersectsRect(area, footprintRect)) {
      issues.push(error('passage-blocked', `${area.name} 동선을 가립니다.`, elementId));
    }
  }
  return issues;
}

function validateWallSegment(project: Project, elementId: string, elementKind: ElementKind, target: Extract<PlacementTarget, { kind: 'wall-segment' }>): ValidationIssue[] {
  const wall = structureById(project, target.wallId);
  if (!wall || wall.kind !== 'wall' || wall.geometry.kind !== 'segment') {
    return [error('missing-structure', '선택한 벽을 도면에서 찾을 수 없습니다.', elementId, target.wallId)];
  }
  if (!isFraction(target.start) || !isFraction(target.end) || target.start >= target.end) {
    return [error('invalid-coordinate', '벽 구간의 시작과 끝을 올바르게 지정해 주세요.', elementId, wall.id)];
  }

  const issues: ValidationIssue[] = [];
  for (const structure of project.floorPlan!.structures) {
    if (structure.parentWallId === wall.id && structure.wallSpan &&
        (structure.kind === 'window' || structure.kind === 'door' || structure.kind === 'entrance') &&
        target.start < structure.wallSpan.end && target.end > structure.wallSpan.start) {
      issues.push(error('opening-overlap', `${structure.name} 개구부와 겹칩니다. 벽의 다른 구간을 선택해 주세요.`, elementId, structure.id));
    }
  }

  if (isPreserved(project, wall)) {
    if (elementKind === 'wall-material') {
      issues.push(error('keep-conflict', `${wall.name}의 보존 조건과 충돌합니다. 허용된 탈착식 표면 연출만 배치할 수 있습니다.`, elementId, wall.id));
    } else if (elementKind === 'wall-light' || elementKind === 'wall-mounted-product' || elementKind === 'other-wall') {
      issues.push({
        code: 'keep-conflict',
        message: `${wall.name}은(는) 유지할 벽입니다. 조명·제품의 고정 방식이 벽을 손상하지 않는지 직접 확인해 주세요.`,
        severity: 'warning',
        elementId,
        structureId: wall.id,
      });
    }
  }
  return issues;
}

/** Checks a proposed target without changing the project or its previous valid placement. */
export function validatePlacement(project: Project, elementId: string, target: PlacementTarget | null): ValidationResult {
  const element = project.elements.find((item) => item.id === elementId);
  if (!element) return result([error('missing-element', '디자인 요소를 찾을 수 없습니다.', elementId)]);
  if (element.status === 'exclude') return result([error('excluded-element', '제외한 요소는 배치할 수 없습니다.', elementId)]);
  if (!target) return result([error('missing-target', `${element.label}의 배치 위치를 지정해 주세요.`, elementId)]);
  if (!project.floorPlan) return result([error('missing-plan', '배치하려면 먼저 도면을 등록하거나 개략 도면을 만드세요.', elementId)]);
  if (!allowedTargetKinds(element.kind).includes(target.kind)) {
    return result([error('invalid-target-kind', `${element.label}은(는) ${allowedTargetKinds(element.kind).map(targetLabel).join(' 또는 ')}에만 배치할 수 있습니다.`, elementId)]);
  }
  const occupancy = validateElementOccupancy(project, element, target);

  switch (target.kind) {
    case 'fixture-surface': {
      const host = project.elements.find(item => item.id === target.fixtureElementId);
      if (!host || host.id === elementId || !isDisplaySupport(host)) return result([error('missing-element', '제품을 올릴 적용 중인 진열대나 가구를 선택해 주세요.', elementId)]);
      if (!isFraction(target.offset.x) || !isFraction(target.offset.y)) return result([error('invalid-coordinate', '제품은 진열대 표면 안에 놓아 주세요.', elementId)]);
      if (!host.target || !['floor-point', 'floor-area'].includes(host.target.kind)) return result([error('missing-target', `${host.label}의 바닥 위치를 먼저 지정해 주세요.`, elementId)]);
      const checked = validatePlacement(project, host.id, host.target);
      return result(checked.issues.map(issue => ({ ...issue, elementId, message: `${host.label}: ${issue.message}` })));
    }
    case 'floor-point':
      return result([...validateFloorPoint(project, elementId, target), ...occupancy]);
    case 'floor-area': {
      const area = areaById(project, target.areaId);
      if (!area) return result([error('missing-area', '선택한 바닥 영역을 찾을 수 없습니다.', elementId)]);
      if (area.kind !== 'floor') return result([error('invalid-area-kind', '바닥 영역만 선택할 수 있습니다.', elementId)]);
      // A material covers the floor itself. A physical fixture assigned to a bounded
      // zone must have the entire zone clear, since its exact footprint is unknown.
      if (element.kind === 'floor-material') return result(occupancy);
      if (area.outline) return result([error('invalid-area-kind', '불규칙 바닥 전체를 가구의 점유 영역으로 사용할 수 없습니다. 바닥 위치와 폭·깊이를 지정해 주세요.', elementId)]);
      const conflicts: ValidationIssue[] = [];
      for (const structure of project.floorPlan.structures) {
        if (structure.kind === 'wall' && structure.geometry.kind === 'segment' &&
            segmentIntersectsRect(structure.geometry.start, structure.geometry.end, area.bounds)) {
          conflicts.push(error(isPartition(structure) ? 'partition-conflict' : 'structure-overlap', `${area.name}이(가) ${structure.name} 벽과 겹칩니다. 더 작은 바닥 영역을 지정해 주세요.`, elementId, structure.id));
        }
        if (structure.kind === 'pillar' && (
          structure.geometry.kind === 'rect' && intersects(area.bounds, structure.geometry.bounds) ||
          structure.geometry.kind === 'circle' && circleIntersectsRect(
            structure.geometry, area.bounds, project.floorPlan.width, project.floorPlan.height,
          )
        )) {
          conflicts.push(error('pillar-collision', `${area.name}에 ${structure.name}이(가) 포함됩니다. 더 작은 바닥 영역을 지정해 주세요.`, elementId, structure.id));
        }
        if ((structure.kind === 'door' || structure.kind === 'entrance') && structure.clearance && intersects(area.bounds, structure.clearance)) {
          conflicts.push(error('door-clearance', `${area.name}이(가) 출입문 여닫이 공간과 겹칩니다.`, elementId, structure.id));
        }
      }
      for (const passage of project.floorPlan.areas.filter((entry) => entry.kind === 'passage')) {
        if (areaIntersectsRect(passage, area.bounds)) conflicts.push(error('passage-blocked', `${area.name}이(가) ${passage.name} 동선과 겹칩니다.`, elementId));
      }
      return result([...conflicts, ...occupancy]);
    }
    case 'wall-segment':
      return result([...validateWallSegment(project, elementId, element.kind, target), ...occupancy]);
    case 'ceiling-zone': {
      const area = areaById(project, target.zoneId);
      if (!area) return result([error('missing-area', '선택한 천장 영역을 찾을 수 없습니다.', elementId)]);
      if (area.kind !== 'ceiling') return result([error('invalid-area-kind', '천장 영역만 선택할 수 있습니다.', elementId)]);
      if (target.offset && (!isFraction(target.offset.x) || !isFraction(target.offset.y))) {
        return result([error('invalid-coordinate', '천장 영역 안의 위치를 지정해 주세요.', elementId)]);
      }
      const bounds = ceilingBounds(project, element, target);
      if (element.kind === 'ceiling-light' && target.offset && bounds && !areaContainsRect(area, bounds)) {
        return result([error('invalid-coordinate', '조명이 천장 범위 안에 들어오도록 가장자리에서 조금 안쪽에 놓아 주세요.', elementId)]);
      }
      return result(occupancy);
    }
    case 'whole-space':
      return result([]);
    case 'named-area': {
      const area = areaById(project, target.areaId);
      if (!area) return result([error('missing-area', '선택한 공간 영역을 찾을 수 없습니다.', elementId)]);
      return result(area.kind === 'spatial' || area.kind === 'floor' ? [] : [error('invalid-area-kind', '공간 영역을 선택해 주세요.', elementId)]);
    }
  }
}

export function targetLabel(kind: TargetKind): string {
  const labels: Record<TargetKind, string> = {
    'fixture-surface': '진열대·가구 위',
    'floor-point': '바닥 위치',
    'floor-area': '바닥 영역',
    'wall-segment': '벽 구간',
    'ceiling-zone': '천장 영역',
    'whole-space': '공간 전체',
    'named-area': '지정 영역',
  };
  return labels[kind];
}

export function validateStructureOperation(
  project: Project,
  structureId: string,
  operation: 'remove' | 'move' | 'replace' | 'surface-treatment' | 'light-tone',
): ValidationResult {
  const structure = structureById(project, structureId);
  if (!structure) return result([error('missing-structure', '도면에서 구조물을 찾을 수 없습니다.', undefined, structureId)]);
  if (operation === 'light-tone') return result(structure.kind === 'existing-light' ? [] : [error('keep-conflict', '기존 천장 조명에만 색감을 적용할 수 있습니다.', undefined, structureId)]);
  if (operation === 'surface-treatment' && structure.kind === 'wall') return result([]);
  if (structure.preservationRequired) {
    return result([error('keep-conflict', `${structure.name}은 필수 기본 구조여서 위치·형태를 변경하거나 삭제할 수 없습니다. 호환되는 벽면 장식·조명은 적용할 수 있습니다.`, undefined, structureId)]);
  }
  if (structure.immutable) {
    return result([error('keep-conflict', `${structure.name}의 위치 고정이 켜져 있습니다. 유지할 구조에서 끈 뒤 수정해 주세요.`, undefined, structureId)]);
  }
  if (!isPreserved(project, structure)) return result([]);
  return result([error('keep-conflict', `${structure.name}은(는) 보존할 구조입니다. ${operation === 'surface-treatment' ? '표면 연출' : '제거·이동·교체'}을(를) 적용할 수 없습니다.`, undefined, structureId)]);
}

export function validateCamera(project: Project, cameraId: string): ValidationResult {
  const camera = project.cameras.find((item) => item.id === cameraId);
  if (!camera) return result([{ ...error('invalid-camera', '카메라를 찾을 수 없습니다.'), cameraId }]);
  if (!project.floorPlan) return result([{ ...error('missing-plan', '카메라를 놓으려면 도면이 필요합니다.'), cameraId }]);
  const plan = project.floorPlan;
  const floorAreas = plan.areas.filter((area) => area.kind === 'floor');
  if (!isFraction(camera.x) || !isFraction(camera.y) || !Number.isFinite(camera.directionDegrees) ||
      !floorAreas.some((area) => areaContainsPoint(area, camera))) {
    return result([{ ...error('invalid-camera', '카메라는 이동 가능한 바닥 안에 놓고 방향을 지정해 주세요.'), cameraId }]);
  }
  for (const structure of plan.structures) {
    if (structure.kind === 'wall' && structure.geometry.kind === 'segment' &&
        segmentIntersectsCircle(structure.geometry.start, structure.geometry.end,
          { center: camera, radius: CAMERA_WALL_TOLERANCE }, plan.width, plan.height)) {
      return result([{ ...error('invalid-camera', `${structure.name} 벽 선 위에는 카메라를 놓을 수 없습니다. 사용 가능한 바닥 안쪽으로 이동해 주세요.`), cameraId, structureId: structure.id }]);
    }
    if (structure.kind !== 'pillar') continue;
    const pillar = structure.geometry;
    const inside = pillar.kind === 'rect' ? containsPoint(pillar.bounds, camera)
      : pillar.kind === 'circle' && circleContainsPoint(pillar, camera, plan.width, plan.height);
    if (inside) {
      return result([{ ...error('invalid-camera', `${structure.name} 안에는 카메라를 놓을 수 없습니다.`), cameraId, structureId: structure.id }]);
    }
  }
  for (const element of project.elements) {
    if (element.status !== 'apply' || !element.target) continue;
    const physical = element.kind === 'freestanding-fixture' || element.kind === 'furniture' || element.kind === 'standing-light' || element.kind === 'other-floor';
    if (!physical) continue;
    const target = element.target;
    const floorArea = target.kind === 'floor-area' ? areaById(project, target.areaId) : undefined;
    const occupied = target.kind === 'floor-point'
      ? floorFootprintRect(target, plan.width, plan.height)
      : floorArea?.kind === 'floor'
        ? floorArea.bounds
        : undefined;
    if (occupied && containsPoint(occupied, camera)) {
      return result([{ ...error('invalid-camera', `${element.label}의 점유 영역 안에는 카메라를 놓을 수 없습니다.`, element.id), cameraId }]);
    }
  }
  return result([]);
}

/** Blocks preview/generation on missing or incompatible common settings and the chosen view. */
export function validatePreflight(project: Project, previewCameraId?: string): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (!project.sourceImages.some((image) => image.role === 'existing-space')) {
    issues.push(error('missing-existing-photo', '기존 공간 사진을 먼저 등록해 주세요. 분위기 사진은 실제 공간 자료로 사용할 수 없습니다.'));
  }
  if (!project.floorPlan) issues.push(error('missing-plan', '도면을 등록하거나 개략 도면을 만드세요.'));
  if (project.planAlignmentPending) {
    issues.push(error('plan-alignment-pending', '새 도면에 맞춰 구조·영역·보존 상태·배치 위치를 확인해 주세요.'));
  }
  for (const keep of project.keeps) {
    if (!structureById(project, keep.structureId)) {
      issues.push(error('missing-structure', '보존할 구조가 도면에 없습니다. 유지할 구조 설정을 확인해 주세요.', undefined, keep.structureId));
    }
  }
  for (const structure of project.floorPlan?.structures ?? []) {
    if (structure.kind === 'wall' && isPartition(structure) && structure.geometry.kind === 'segment') {
      issues.push(...validatePartitionPlacement(project, structure.geometry.start, structure.geometry.end, structure.id).issues);
    }
  }

  const primary = project.cameras.find((camera) => camera.primary);
  if (!primary) issues.push(error('missing-primary-camera', '기본 카메라 위치와 방향을 설정해 주세요.'));
  else issues.push(...validateCamera(project, primary.id).issues);
  if (previewCameraId !== undefined && previewCameraId !== primary?.id) {
    issues.push(...validateCamera(project, previewCameraId).issues);
  }

  if (!project.elements.some((element) => element.status === 'apply')) {
    issues.push(error('missing-applied-element', '적용할 디자인 요소를 하나 이상 등록하고 위치를 지정해 주세요.'));
  }
  for (const element of project.elements) {
    if (element.status !== 'apply') continue;
    if (element.target?.kind === 'wall-segment') {
      const wall = structureById(project, element.target.wallId);
      if (wall?.role === 'partition' && !element.target.face) {
        issues.push(error('missing-wall-face', `${element.label}이(가) ${wall.name}의 어느 면에 붙는지 선택해 주세요.`, element.id, wall.id));
      }
    }
    const reference = project.references.find((item) => item.id === element.sourceReferenceId);
    if (!(element.origin === 'layout' && !element.sourceReferenceId) && (!reference || !project.sourceImages.some((image) => image.id === reference.imageId && image.role !== 'existing-space'))) {
      issues.push(error('missing-reference', `${element.label}의 분위기·제품 레퍼런스를 확인해 주세요.`, element.id));
    }
    issues.push(...validatePlacement(project, element.id, element.target).issues);
  }
  return result(issues);
}
