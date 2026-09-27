import type {
  Camera,
  ConditionsSnapshot,
  DesignElement,
  Keep,
  PlacementTarget,
  Point,
  Project,
  Reference,
  Result,
  SourceImage,
  FloorPlan,
  ValidationResult,
} from './types';
import { validatePlacement } from './validation';

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/** A common edit keeps history and marks every result from an older revision stale. */
export function markCommonChange(project: Project): Project {
  const commonRevision = project.commonRevision + 1;
  return {
    ...project,
    commonRevision,
    results: project.results.map((result) => ({
      ...result,
      stale: result.stale || result.commonRevision < commonRevision,
    })),
  };
}

export type CommonPatch = Partial<Pick<Project,
  'name' | 'spaceType' | 'concept' | 'sourceImages' | 'floorPlan' | 'planAlignmentPending' | 'keeps' | 'references' | 'elements'
>>;

export function updateCommon(project: Project, patch: CommonPatch): Project {
  const changed = Object.entries(patch).some(([key, value]) => !same(project[key as keyof CommonPatch], value));
  if (!changed) return project;
  return markCommonChange({ ...project, ...patch });
}

export function setSourceImages(project: Project, sourceImages: SourceImage[]): Project {
  return updateCommon(project, { sourceImages });
}

export function setFloorPlan(project: Project, floorPlan: FloorPlan | null): Project {
  return updateCommon(project, { floorPlan });
}

/** A photograph label is display-only metadata, so it does not stale design results. */
export function updatePhotoAnchor(project: Project, structureId: string, photoAnchor: Point): Project {
  if (!project.floorPlan || !Number.isFinite(photoAnchor.x) || !Number.isFinite(photoAnchor.y) ||
      photoAnchor.x < 0 || photoAnchor.x > 1 || photoAnchor.y < 0 || photoAnchor.y > 1) return project;
  const structure = project.floorPlan.structures.find((item) => item.id === structureId);
  if (!structure || same(structure.photoAnchor, photoAnchor)) return project;
  return { ...project, floorPlan: { ...project.floorPlan, structures: project.floorPlan.structures.map((item) => item.id === structureId ? { ...item, photoAnchor } : item) } };
}

export function setKeeps(project: Project, keeps: Keep[]): Project {
  const mandatory = project.keeps.filter((keep) => project.floorPlan?.structures.some((structure) => structure.id === keep.structureId && structure.immutable));
  const normalizedKeeps = [...keeps, ...mandatory.filter((entry) => !keeps.some((keep) => keep.structureId === entry.structureId))];
  const protectedIds = new Set(normalizedKeeps.map((keep) => keep.structureId));
  const floorPlan = project.floorPlan ? {
    ...project.floorPlan,
    structures: project.floorPlan.structures.map((structure) => ({
      ...structure,
      protected: !!structure.immutable || protectedIds.has(structure.id),
    })),
  } : null;
  return updateCommon(project, { keeps: normalizedKeeps, floorPlan });
}

export function setReferences(project: Project, references: Reference[]): Project {
  return updateCommon(project, { references });
}

export function setElements(project: Project, elements: DesignElement[]): Project {
  return updateCommon(project, { elements });
}

export function updateKeep(project: Project, keepId: string, patch: Partial<Omit<Keep, 'id'>>): Project {
  const index = project.keeps.findIndex((keep) => keep.id === keepId);
  if (index < 0) return project;
  if (patch.structureId && !project.floorPlan?.structures.some((structure) => structure.id === patch.structureId)) return project;
  const keeps = project.keeps.map((keep, position) => position === index ? { ...keep, ...patch } : keep);
  return setKeeps(project, keeps);
}

export function upsertKeep(project: Project, keep: Keep): Project {
  if (!project.floorPlan?.structures.some((structure) => structure.id === keep.structureId)) return project;
  const index = project.keeps.findIndex((entry) => entry.id === keep.id || entry.structureId === keep.structureId);
  const keeps = index < 0
    ? [...project.keeps, keep]
    : project.keeps.map((entry, position) => position === index ? keep : entry);
  return setKeeps(project, keeps);
}

export function removeKeep(project: Project, keepId: string): Project {
  const keep = project.keeps.find((entry) => entry.id === keepId);
  if (keep && project.floorPlan?.structures.some((structure) => structure.id === keep.structureId && structure.immutable)) return project;
  return setKeeps(project, project.keeps.filter((keep) => keep.id !== keepId));
}

export function updateElement(project: Project, elementId: string, patch: Partial<Omit<DesignElement, 'id' | 'target'>>): Project {
  const current = project.elements.find((element) => element.id === elementId);
  if (!current) return project;
  const next: DesignElement = { ...current, ...patch };
  if (patch.kind && patch.kind !== current.kind && current.target) {
    // Validate the old anchor against the new type and current Keep/geometry rules.
    // Excluded items may retain a draft anchor for later re-application.
    const validationProject: Project = {
      ...project,
      elements: project.elements.map((element) => element.id === elementId ? { ...next, status: 'apply' } : element),
    };
    if (!validatePlacement(validationProject, elementId, current.target).valid) next.target = null;
  }
  const elements = project.elements.map((element) => element.id === elementId ? next : element);
  return setElements(project, elements);
}

export function placeElement(
  project: Project,
  elementId: string,
  target: PlacementTarget,
): { project: Project; validation: ValidationResult } {
  const validation = validatePlacement(project, elementId, target);
  if (!validation.valid) return { project, validation };
  const elements = project.elements.map((element) => element.id === elementId ? { ...element, target } : element);
  return { project: setElements(project, elements), validation };
}

function staleCameraResults(results: Result[], cameraId: string): Result[] {
  return results.map((result) => result.cameraId === cameraId ? { ...result, stale: true } : result);
}

export function updateCamera(project: Project, cameraId: string, patch: Partial<Omit<Camera, 'id'>>): Project {
  const current = project.cameras.find((camera) => camera.id === cameraId);
  if (!current) return project;
  const next = { ...current, ...patch };
  if (same(current, next)) return project;
  const geometryChanged = current.x !== next.x || current.y !== next.y ||
    current.directionDegrees !== next.directionDegrees || current.fovPreset !== next.fovPreset;
  return {
    ...project,
    cameras: project.cameras.map((camera) => camera.id === cameraId ? next :
      patch.primary ? { ...camera, primary: false } : camera),
    results: geometryChanged ? staleCameraResults(project.results, cameraId) : project.results,
  };
}

export function addCamera(project: Project, camera: Camera): Project {
  if (project.cameras.some((entry) => entry.id === camera.id)) return project;
  return {
    ...project,
    cameras: [...project.cameras.map((entry) => camera.primary ? { ...entry, primary: false } : entry), camera],
  };
}

export function createConditionsSnapshot(project: Project, cameraId: string): ConditionsSnapshot | null {
  const camera = project.cameras.find((entry) => entry.id === cameraId);
  if (!camera) return null;
  return {
    keepIds: project.keeps.map((keep) => keep.id),
    appliedElementIds: project.elements.filter((element) => element.status === 'apply').map((element) => element.id),
    excludedElementIds: project.elements.filter((element) => element.status === 'exclude').map((element) => element.id),
    camera: { id: camera.id, x: camera.x, y: camera.y, directionDegrees: camera.directionDegrees },
    common: structuredClone({
      concept: project.concept,
      floorPlan: project.floorPlan,
      keeps: project.keeps,
      references: project.references,
      elements: project.elements,
    }),
  };
}

export function appendResult(project: Project, result: Result): Project {
  if (project.results.some((entry) => entry.id === result.id)) return project;
  return { ...project, results: [...project.results, result] };
}

export function setResultApproved(project: Project, resultId: string, approved: boolean): Project {
  return {
    ...project,
    results: project.results.map((result) => result.id === resultId ? { ...result, approved } : result),
  };
}
