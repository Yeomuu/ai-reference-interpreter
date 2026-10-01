import type { PlacementTarget, Point, Project, ValidationResult } from './types';
import { moveStructure } from './structureEditing';
import { validateCamera, validatePlacement } from './validation';

export interface MovementPreview {
  kind: 'element-move' | 'element-rotate' | 'wall-element-move' | 'camera-move' | 'camera-rotate' | 'structure-move';
  id: string;
  point?: Point;
  degrees?: number;
  wall?: { wallId: string; start: number; end: number };
  structure?: Point;
}

/** Convert a canvas position to the item's existing typed anchor; never change its host. */
export function translatedElementTarget(project: Project, id: string, point: Point): PlacementTarget | undefined {
  const target = project.elements.find(item => item.id === id)?.target;
  if (target?.kind === 'floor-point') return { ...target, ...point };
  const plan = project.floorPlan;
  if (!plan) return;
  if (target?.kind === 'ceiling-zone') {
    const zone = plan.areas.find(area => area.id === target.zoneId);
    if (zone) return { ...target, offset: { x: (point.x - zone.bounds.x) / zone.bounds.width, y: (point.y - zone.bounds.y) / zone.bounds.height } };
  }
  if (target?.kind === 'fixture-surface') {
    const host = project.elements.find(item => item.id === target.fixtureElementId)?.target;
    const bounds = host?.kind === 'floor-point' ? { x: host.x - (host.footprint?.width ?? .06) / 2, y: host.y - (host.footprint?.height ?? .06) / 2, width: host.footprint?.width ?? .06, height: host.footprint?.height ?? .06 }
      : host?.kind === 'floor-area' ? plan.areas.find(area => area.id === host.areaId)?.bounds : undefined;
    if (!bounds) return;
    const angle = -(host?.kind === 'floor-point' ? host.rotationDegrees ?? 0 : 0) * Math.PI / 180;
    const dx = (point.x - bounds.x - bounds.width / 2) * plan.width, dy = (point.y - bounds.y - bounds.height / 2) * plan.height;
    return { ...target, offset: { x: .5 + (dx * Math.cos(angle) - dy * Math.sin(angle)) / (bounds.width * plan.width), y: .5 + (dx * Math.sin(angle) + dy * Math.cos(angle)) / (bounds.height * plan.height) } };
  }
}

/** Preview runs the same validation as release, without saving a proposed position. */
export function validateMovementPreview(project: Project, preview: MovementPreview | null): ValidationResult | undefined {
  if (!preview) return;
  if (preview.kind === 'structure-move' && preview.structure) return moveStructure(project, preview.id, preview.structure).validation;
  if (preview.kind === 'camera-move' || preview.kind === 'camera-rotate') {
    const cameras = project.cameras.map(camera => camera.id !== preview.id ? camera : { ...camera,
      ...(preview.point ?? {}), ...(preview.degrees !== undefined ? { directionDegrees: preview.degrees } : {}),
    });
    return validateCamera({ ...project, cameras }, preview.id);
  }
  const element = project.elements.find(item => item.id === preview.id);
  const target = element?.target;
  if (!target) return;
  if (preview.kind === 'element-move' && preview.point) {
    const moved = translatedElementTarget(project, preview.id, preview.point);
    if (moved) return validatePlacement(project, preview.id, moved);
  }
  if (target.kind === 'floor-point') return validatePlacement(project, preview.id, { ...target,
    ...(preview.point ?? {}), ...(preview.degrees !== undefined ? { rotationDegrees: preview.degrees } : {}),
  });
  if (target.kind === 'wall-segment' && preview.wall) return validatePlacement(project, preview.id, { ...target, ...preview.wall });
}
