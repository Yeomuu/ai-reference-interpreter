import type { Point, Project, Structure, StructureGeometry, ValidationIssue, ValidationResult } from './types';
import { updateCommon } from './revisions';
import { validateCamera, validatePlacement, validateStructureDrawing, validateStructureOperation } from './validation';

export function isStructureLocked(project: Project, structure: Structure): boolean {
  return !!structure.preservationRequired || !!structure.immutable || structure.protected || project.keeps.some((keep) => keep.structureId === structure.id);
}

export function structureMovementReason(project: Project, structure: Structure): string | null {
  if (structure.preservationRequired) return '제공된 공간의 기본 구조는 위치와 형태를 바꿀 수 없습니다. 벽면 장식 등 호환되는 연출은 적용할 수 있습니다.';
  if (isStructureLocked(project, structure)) return '위치 고정이 켜져 있습니다. 유지할 구조에서 끄면 도면 표시를 수정할 수 있습니다.';
  const lockedChild = project.floorPlan?.structures.find((child) => child.parentWallId === structure.id && isStructureLocked(project, child));
  return lockedChild ? `연결된 ${lockedChild.name}의 위치가 고정되어 있습니다. 함께 이동하려면 이 구조의 필수 보존도 꺼 주세요.` : null;
}

export function structurePosition(structure: Structure): Point {
  const geometry = structure.geometry;
  return geometry.kind === 'segment' ? geometry.start : geometry.kind === 'rect' ? geometry.bounds : geometry.center;
}

function translate(geometry: StructureGeometry, delta: Point): StructureGeometry {
  const point = (p: Point) => ({ x: p.x + delta.x, y: p.y + delta.y });
  return geometry.kind === 'segment' ? { ...geometry, start: point(geometry.start), end: point(geometry.end) }
    : geometry.kind === 'rect' ? { ...geometry, bounds: { ...geometry.bounds, ...point(geometry.bounds) } }
      : { ...geometry, center: point(geometry.center) };
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/** Preview preserves shape size and slides openings along their connected wall. */
export function previewStructureTranslation(project: Project, id: string, requested: Point): Structure[] {
  const plan = project.floorPlan;
  const structure = plan?.structures.find((item) => item.id === id);
  if (!plan || !structure) return [];
  let delta = requested;
  let span = structure.wallSpan;
  const wall = plan.structures.find((item) => item.id === structure.parentWallId);
  if (wall?.geometry.kind === 'segment' && span) {
    const dx = wall.geometry.end.x - wall.geometry.start.x;
    const dy = wall.geometry.end.y - wall.geometry.start.y;
    const squared = (dx * plan.width) ** 2 + (dy * plan.height) ** 2;
    const fraction = squared ? (requested.x * dx * plan.width ** 2 + requested.y * dy * plan.height ** 2) / squared : 0;
    const offset = clamp(fraction, -span.start, 1 - span.end);
    span = { start: span.start + offset, end: span.end + offset };
    delta = { x: dx * offset, y: dy * offset };
  } else {
    const geometry = structure.geometry;
    const min = geometry.kind === 'segment' ? { x: Math.min(geometry.start.x, geometry.end.x), y: Math.min(geometry.start.y, geometry.end.y) }
      : geometry.kind === 'rect' ? geometry.bounds : { x: geometry.center.x - geometry.radius * Math.min(plan.width, plan.height) / plan.width, y: geometry.center.y - geometry.radius * Math.min(plan.width, plan.height) / plan.height };
    const max = geometry.kind === 'segment' ? { x: Math.max(geometry.start.x, geometry.end.x), y: Math.max(geometry.start.y, geometry.end.y) }
      : geometry.kind === 'rect' ? { x: geometry.bounds.x + geometry.bounds.width, y: geometry.bounds.y + geometry.bounds.height }
        : { x: 2 * geometry.center.x - min.x, y: 2 * geometry.center.y - min.y };
    delta = { x: clamp(requested.x, -min.x, 1 - max.x), y: clamp(requested.y, -min.y, 1 - max.y) };
  }
  return plan.structures.map((item) => {
    if (item.id !== id && item.parentWallId !== id) return item;
    return { ...item, geometry: translate(item.geometry, delta),
      ...(item.id === id && span ? { wallSpan: span } : {}),
      ...(item.clearance ? { clearance: { ...item.clearance, x: item.clearance.x + delta.x, y: item.clearance.y + delta.y } } : {}),
    };
  });
}

export function moveStructure(project: Project, id: string, delta: Point): { project: Project; validation: ValidationResult } {
  const structure = project.floorPlan?.structures.find((item) => item.id === id);
  const fail = (message: string, code: ValidationIssue['code'] = 'keep-conflict') => ({ project, validation: { valid: false, issues: [{ code, message, severity: 'error' as const, structureId: id }] } });
  if (!project.floorPlan || !structure) return fail('도면에서 구조를 찾을 수 없습니다.', 'missing-structure');
  if (!Number.isFinite(delta.x) || !Number.isFinite(delta.y)) return fail('위치를 숫자로 입력해 주세요.', 'invalid-coordinate');
  const operation = validateStructureOperation(project, id, 'move');
  if (!operation.valid) return { project, validation: operation };
  const reason = structureMovementReason(project, structure);
  if (reason) return fail(reason);
  const structures = previewStructureTranslation(project, id, delta);
  const movedIds = new Set([id, ...structures.filter((item) => item.parentWallId === id).map((item) => item.id)]);
  const candidate = { ...project, floorPlan: { ...project.floorPlan, structures } };
  const issues: ValidationIssue[] = [];
  for (const item of structures.filter((entry) => movedIds.has(entry.id))) {
    // A wall and its attached opening share a boundary. Check its other neighbours.
    const checkingProject = item.kind === 'wall' ? { ...candidate, floorPlan: {
      ...candidate.floorPlan, structures: structures.filter((entry) => entry.parentWallId !== id),
    } } : candidate;
    issues.push(...validateStructureDrawing(checkingProject, item, item.id).issues);
  }
  // Only newly introduced conflicts block this edit; unrelated draft issues may remain.
  const issueKey = (issue: ValidationIssue) => JSON.stringify([issue.code, issue.elementId, issue.structureId, issue.cameraId, issue.message]);
  for (const element of project.elements) {
    if (element.status !== 'apply' || !element.target) continue;
    const previous = new Set(validatePlacement(project, element.id, element.target).issues.map(issueKey));
    issues.push(...validatePlacement(candidate, element.id, element.target).issues.filter((issue) => !previous.has(issueKey(issue))));
  }
  for (const camera of project.cameras) {
    const previous = new Set(validateCamera(project, camera.id).issues.map(issueKey));
    issues.push(...validateCamera(candidate, camera.id).issues.filter((issue) => !previous.has(issueKey(issue))));
  }
  const validation = { valid: !issues.some((issue) => issue.severity === 'error'), issues };
  return { project: validation.valid ? updateCommon(project, { floorPlan: candidate.floorPlan }) : project, validation };
}

/** Correct a released shape without bypassing occupancy or preservation checks. */
export function reshapeStructure(project: Project, id: string, geometry: StructureGeometry): { project: Project; validation: ValidationResult } {
  const structure = project.floorPlan?.structures.find(item => item.id === id);
  const fail = (message: string) => ({ project, validation: { valid: false, issues: [{ code: 'keep-conflict' as const, severity: 'error' as const, message, structureId: id }] } });
  if (!project.floorPlan || !structure) return fail('구조를 찾을 수 없습니다.');
  const reason = structureMovementReason(project, structure);
  if (reason) return fail(reason);
  if (project.floorPlan.structures.some(item => item.parentWallId === id)) return fail('창·문이 연결된 벽입니다. 연결 표시를 먼저 정리한 뒤 벽 방향을 수정해 주세요.');
  const candidate = { ...project, floorPlan: { ...project.floorPlan, structures: project.floorPlan.structures.map(item => item.id === id ? { ...item, geometry } : item) } };
  const issues = validateStructureDrawing(candidate, { ...structure, geometry }, id).issues;
  const key = (issue: ValidationIssue) => JSON.stringify(issue);
  for (const element of project.elements.filter(item => item.status === 'apply' && item.target)) {
    const before = new Set(validatePlacement(project, element.id, element.target).issues.map(key));
    issues.push(...validatePlacement(candidate, element.id, element.target).issues.filter(issue => !before.has(key(issue))));
  }
  for (const camera of project.cameras) {
    const before = new Set(validateCamera(project, camera.id).issues.map(key));
    issues.push(...validateCamera(candidate, camera.id).issues.filter(issue => !before.has(key(issue))));
  }
  const validation = { valid: !issues.some(issue => issue.severity === 'error'), issues };
  return { project: validation.valid ? updateCommon(project, { floorPlan: candidate.floorPlan }) : project, validation };
}
