import type {
  Area,
  ElementKind,
  PlacementTarget,
  Point,
  Project,
  Rect,
  Structure,
  ValidationIssue,
  ValidationResult,
} from './types';

export type TargetKind = PlacementTarget['kind'];

const TARGETS: Record<ElementKind, readonly TargetKind[]> = {
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

function containsRect(outer: Rect, inner: Rect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height;
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
  return !!structure.immutable || structure.protected || project.keeps.some((keep) => keep.structureId === structure.id);
}

/** Validate the proposed geometry, not just whether a partition may be edited. */
export function validatePartitionPlacement(project: Project, start: Point, end: Point): ValidationResult {
  const plan = project.floorPlan;
  if (!plan) return result([error('missing-plan', '가벽을 표시하려면 먼저 도면이 필요합니다.')]);
  if (![start.x, start.y, end.x, end.y].every(isFraction) || Math.hypot(end.x - start.x, end.y - start.y) < 0.02) {
    return result([error('invalid-coordinate', '가벽은 도면 안에 길이를 유지하며 배치해 주세요.')]);
  }

  const issues: ValidationIssue[] = [];
  const floorAreas = plan.areas.filter((area) => area.kind === 'floor');
  if (!floorAreas.some((area) => containsPoint(area.bounds, start) && containsPoint(area.bounds, end))) {
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
    if (segmentIntersectsCircle(start, end,
      { center: camera, radius: CAMERA_WALL_TOLERANCE }, width, height)) {
      issues.push({ ...error('partition-conflict', `가벽이 ${camera.name} 카메라 위치와 겹칩니다. 카메라나 가벽을 옮겨 주세요.`), cameraId: camera.id });
    }
  }
  for (const structure of plan.structures) {
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
    if (area.kind === 'passage' && segmentIntersectsRect(start, end, area.bounds)) {
      issues.push(error('passage-blocked', `가벽이 ${area.name} 동선을 가로지릅니다.`));
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
  if (!validRect(footprintRect) || !floorAreas.some((area) => containsRect(area.bounds, footprintRect))) {
    issues.push(error('outside-floor', '요소의 점유 영역이 사용 가능한 바닥 범위를 벗어납니다.', elementId));
  }

  for (const structure of project.floorPlan!.structures) {
    if (structure.kind === 'wall' && structure.immutable === false && structure.geometry.kind === 'segment' &&
        segmentIntersectsRect(structure.geometry.start, structure.geometry.end, footprintRect)) {
      issues.push(error('partition-conflict', `${structure.name} 가벽과 겹칩니다. 다른 바닥 위치를 선택해 주세요.`, elementId, structure.id));
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
    if (area.kind === 'passage' && intersects(footprintRect, area.bounds)) {
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
    const keep = project.keeps.find((entry) => entry.structureId === wall.id);
    const removable = elementKind === 'photozone' || elementKind === 'wall-graphic';
    if (elementKind === 'wall-material' || (removable && !keep?.allowedSurfaceTreatment)) {
      issues.push(error('keep-conflict', `${wall.name}의 보존 조건과 충돌합니다. 허용된 탈착식 표면 연출만 배치할 수 있습니다.`, elementId, wall.id));
    } else if (elementKind === 'wall-light' || elementKind === 'wall-mounted-product') {
      issues.push({
        code: 'keep-conflict',
        message: `${wall.name}은(는) Keep 대상입니다. 조명·제품의 고정 방식이 벽을 손상하지 않는지 직접 확인해 주세요.`,
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

  switch (target.kind) {
    case 'floor-point':
      return result(validateFloorPoint(project, elementId, target));
    case 'floor-area': {
      const area = areaById(project, target.areaId);
      if (!area) return result([error('missing-area', '선택한 바닥 영역을 찾을 수 없습니다.', elementId)]);
      if (area.kind !== 'floor') return result([error('invalid-area-kind', '바닥 영역만 선택할 수 있습니다.', elementId)]);
      // A material covers the floor itself. A physical fixture assigned to a bounded
      // zone must have the entire zone clear, since its exact footprint is unknown.
      if (element.kind === 'floor-material') return result([]);
      const conflicts: ValidationIssue[] = [];
      for (const structure of project.floorPlan.structures) {
        if (structure.kind === 'wall' && structure.immutable === false && structure.geometry.kind === 'segment' &&
            segmentIntersectsRect(structure.geometry.start, structure.geometry.end, area.bounds)) {
          conflicts.push(error('partition-conflict', `${area.name}이(가) ${structure.name} 가벽과 겹칩니다. 더 작은 바닥 영역을 지정해 주세요.`, elementId, structure.id));
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
        if (intersects(area.bounds, passage.bounds)) conflicts.push(error('passage-blocked', `${area.name}이(가) ${passage.name} 동선과 겹칩니다.`, elementId));
      }
      return result(conflicts);
    }
    case 'wall-segment':
      return result(validateWallSegment(project, elementId, element.kind, target));
    case 'ceiling-zone': {
      const area = areaById(project, target.zoneId);
      if (!area) return result([error('missing-area', '선택한 천장 영역을 찾을 수 없습니다.', elementId)]);
      if (area.kind !== 'ceiling') return result([error('invalid-area-kind', '천장 영역만 선택할 수 있습니다.', elementId)]);
      if (target.offset && (!isFraction(target.offset.x) || !isFraction(target.offset.y))) {
        return result([error('invalid-coordinate', '천장 영역 안의 위치를 지정해 주세요.', elementId)]);
      }
      return result([]);
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
  if (structure.immutable) {
    const keep = project.keeps.find((entry) => entry.structureId === structureId);
    if (operation === 'surface-treatment' && keep?.allowedSurfaceTreatment) return result([]);
    return result([error('keep-conflict', `${structure.name}은(는) 필수 보존 기본 구조입니다. 제거·이동·교체할 수 없습니다.`, undefined, structureId)]);
  }
  if (!isPreserved(project, structure)) return result([]);
  const keep = project.keeps.find((entry) => entry.structureId === structureId);
  if (operation === 'surface-treatment' && keep?.allowedSurfaceTreatment) return result([]);
  return result([error('keep-conflict', `${structure.name}은(는) Keep으로 보존됩니다. ${operation === 'surface-treatment' ? '표면 연출' : '제거·이동·교체'}을(를) 적용할 수 없습니다.`, undefined, structureId)]);
}

export function validateCamera(project: Project, cameraId: string): ValidationResult {
  const camera = project.cameras.find((item) => item.id === cameraId);
  if (!camera) return result([{ ...error('invalid-camera', '카메라를 찾을 수 없습니다.'), cameraId }]);
  if (!project.floorPlan) return result([{ ...error('missing-plan', '카메라를 놓으려면 도면이 필요합니다.'), cameraId }]);
  const plan = project.floorPlan;
  const floorAreas = plan.areas.filter((area) => area.kind === 'floor');
  if (!isFraction(camera.x) || !isFraction(camera.y) || !Number.isFinite(camera.directionDegrees) ||
      !floorAreas.some((area) => containsPoint(area.bounds, camera))) {
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
    const physical = element.kind === 'freestanding-fixture' || element.kind === 'furniture' || element.kind === 'standing-light';
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
    issues.push(error('plan-alignment-pending', '새 도면에 맞춰 구조·영역·Keep·배치 위치를 확인해 주세요.'));
  }
  for (const keep of project.keeps) {
    if (!structureById(project, keep.structureId)) {
      issues.push(error('missing-structure', 'Keep 대상 구조물이 도면에 없습니다. Keep 설정을 확인해 주세요.', undefined, keep.structureId));
    }
  }
  for (const structure of project.floorPlan?.structures ?? []) {
    if (structure.kind === 'wall' && structure.immutable === false && structure.geometry.kind === 'segment') {
      issues.push(...validatePartitionPlacement(project, structure.geometry.start, structure.geometry.end).issues);
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
    const reference = project.references.find((item) => item.id === element.sourceReferenceId);
    if (!reference || !project.sourceImages.some((image) => image.id === reference.imageId && image.role !== 'existing-space')) {
      issues.push(error('missing-reference', `${element.label}의 분위기·제품 레퍼런스를 확인해 주세요.`, element.id));
    }
    issues.push(...validatePlacement(project, element.id, element.target).issues);
  }
  return result(issues);
}
