import type { Point, Project, ValidationResult } from './types';
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
  if (target.kind === 'floor-point') return validatePlacement(project, preview.id, { ...target,
    ...(preview.point ?? {}), ...(preview.degrees !== undefined ? { rotationDegrees: preview.degrees } : {}),
  });
  if (target.kind === 'wall-segment' && preview.wall) return validatePlacement(project, preview.id, { ...target, ...preview.wall });
}
