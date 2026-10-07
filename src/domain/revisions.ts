import { cleanDisplayTargets } from './display.js';
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
} from './types.js';
import { validatePlacement } from './validation.js';
import { CAMERA_PRESETS } from './prototypeConfig.js';

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
  'name' | 'spaceType' | 'concept' | 'designGoal' | 'sourceImages' | 'floorPlan' | 'planAlignmentPending' | 'keeps' | 'references' | 'elements' | 'referenceBindings' | 'cameraRecommendationVersion'
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
  const mandatory = project.keeps.filter((keep) => project.floorPlan?.structures.some((structure) => structure.id === keep.structureId && (structure.immutable || structure.preservationRequired)));
  const normalizedKeeps = [...keeps, ...mandatory.filter((entry) => !keeps.some((keep) => keep.structureId === entry.structureId))];
  const protectedIds = new Set(normalizedKeeps.map((keep) => keep.structureId));
  const floorPlan = project.floorPlan ? {
    ...project.floorPlan,
    structures: project.floorPlan.structures.map((structure) => ({
      ...structure,
      protected: !!structure.immutable || !!structure.preservationRequired || protectedIds.has(structure.id),
    })),
  } : null;
  return updateCommon(project, { keeps: normalizedKeeps, floorPlan });
}

export function setReferences(project: Project, references: Reference[]): Project {
  return updateCommon(project, { references });
}

export function setElements(project: Project, elements: DesignElement[]): Project {
  return updateCommon(project, { elements: cleanDisplayTargets(elements) });
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
  if (keep && project.floorPlan?.structures.some((structure) => structure.id === keep.structureId && (structure.immutable || structure.preservationRequired))) return project;
  return setKeeps(project, project.keeps.filter((keep) => keep.id !== keepId));
}

/** Explicit user intent can release any preservation lock without changing its origin. */
export function setStructurePreservation(project: Project, structureId: string, enabled: boolean): Project {
  const structure = project.floorPlan?.structures.find((item) => item.id === structureId);
  if (!structure || !project.floorPlan) return project;
  if (structure.preservationRequired && !enabled) return project;
  const existing = project.keeps.find((keep) => keep.structureId === structureId);
  const settings = existing ? { description: existing.description, allowedSurfaceTreatment: existing.allowedSurfaceTreatment } : structure.preservationSettings;
  const keeps = enabled ? existing ? project.keeps : [...project.keeps, {
    id: `keep-${structureId}`, structureId, intent: 'preserve' as const,
    description: settings?.description ?? `${structure.name}의 위치와 형태 보존`,
    allowedSurfaceTreatment: settings?.allowedSurfaceTreatment,
  }] : project.keeps.filter((keep) => keep.structureId !== structureId);
  return updateCommon(project, {
    keeps,
    floorPlan: { ...project.floorPlan, structures: project.floorPlan.structures.map((item) => item.id === structureId ? {
      ...item, role: item.role ?? (item.kind === 'wall' && item.immutable === false ? 'partition' : 'base'),
      immutable: enabled, protected: enabled, ...(settings ? { preservationSettings: settings } : {}),
    } : item) },
  });
}

/** Delete the current reference and its derived conditions, preserving every result. */
export function removeReference(project: Project, referenceId: string): Project {
  const reference = project.references.find((item) => item.id === referenceId);
  if (!reference) return project;
  const references = project.references.filter((item) => item.id !== referenceId);
  // Older snapshots contain reference IDs but no source metadata. Capture it before
  // removal, without changing any previous condition or result image.
  const withHistory = { ...project, results: project.results.map((result) => {
    const common = result.conditionsSnapshot.common;
    if (!common || common.sourceImages) return result;
    const sourceIds = new Set(common.references.map((item) => item.imageId));
    if (result.conditionsSnapshot.existingPhotoId) sourceIds.add(result.conditionsSnapshot.existingPhotoId);
    return { ...result, conditionsSnapshot: { ...result.conditionsSnapshot, common: {
      ...common, sourceImages: structuredClone(project.sourceImages.filter((image) => sourceIds.has(image.id))),
    } } };
  }) };
  return updateCommon(withHistory, {
    references,
    sourceImages: references.some((item) => item.imageId === reference.imageId)
      ? project.sourceImages : project.sourceImages.filter((item) => item.id !== reference.imageId),
    elements: cleanDisplayTargets(project.elements.flatMap(item => item.sourceReferenceId !== referenceId ? [item] : item.layoutKind ? [{ ...item, origin: item.origin === 'mapping-condition' ? 'mapping-condition' as const : 'layout' as const, sourceReferenceId: '', sourceRegion: undefined }] : [])),
    referenceBindings: project.referenceBindings?.filter(item => item.referenceId !== referenceId),
  });
}

export function removeDesignElement(project: Project, elementId: string): Project {
  if (!project.elements.some((item) => item.id === elementId)) return project;
  return updateCommon(project, {
    elements: cleanDisplayTargets(project.elements.filter((item) => item.id !== elementId)),
    referenceBindings: project.referenceBindings?.map(item => ({ ...item, layoutItemIds: item.layoutItemIds.filter(id => id !== elementId) })).filter(item => item.layoutItemIds.length),
    references: project.references.map((item) => ({ ...item,
      extractedElements: item.extractedElements.filter((id) => id !== elementId),
      exclusions: item.exclusions.filter((id) => id !== elementId),
    })),
  });
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
  const item = project.elements.find(item=>item.id===elementId);
  if (item?.locked && !same(item.target,target)) return { project, validation: { valid:false, issues:[{ code:'keep-conflict', severity:'error', elementId, message:'위치 고정을 끈 뒤 이동하거나 크기를 바꾸세요.' }] } };
  const validation = validatePlacement(project, elementId, target);
  if (!validation.valid) return { project, validation };
  const elements = project.elements.map((element) => element.id === elementId ? { ...element, target } : element);
  return { project: setElements(project, elements), validation };
}

function staleCameraResults(results: Result[], cameraId: string): Result[] {
  return results.map((result) => result.cameraId === cameraId ? { ...result, stale: true } : result);
}

export function updateCamera(project: Project, cameraId: string, patch: Partial<Omit<Camera, 'id'>>, automatic = false): Project {
  const current = project.cameras.find((camera) => camera.id === cameraId);
  if (!current) return project;
  const next = { ...current, ...patch };
  if (same(current, next)) return project;
  if (current.recommendation && !automatic) next.recommendation = 'modified';
  const geometryChanged = current.x !== next.x || current.y !== next.y ||
    current.directionDegrees !== next.directionDegrees || current.fovPreset !== next.fovPreset || current.heightMeters !== next.heightMeters || current.pitchDegrees !== next.pitchDegrees || current.viewPreset !== next.viewPreset;
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

/** Compare the view used for a finished request with its current settings. */
export function cameraConditionsChanged(current: Camera | undefined, saved: ConditionsSnapshot['camera']): boolean {
  return !current || current.x !== saved.x || current.y !== saved.y ||
    current.directionDegrees !== saved.directionDegrees ||
    (current.fovPreset ?? 'standard') !== (saved.fovPreset ?? 'standard') ||
    (current.viewPreset ?? 'custom') !== (saved.viewPreset ?? 'custom') ||
    (current.heightMeters ?? CAMERA_PRESETS[current.viewPreset ?? 'custom'].heightMeters) !== (saved.heightMeters ?? CAMERA_PRESETS[saved.viewPreset ?? 'custom'].heightMeters) ||
    (current.pitchDegrees ?? CAMERA_PRESETS[current.viewPreset ?? 'custom'].pitchDegrees) !== (saved.pitchDegrees ?? CAMERA_PRESETS[saved.viewPreset ?? 'custom'].pitchDegrees);
}

export function createConditionsSnapshot(project: Project, cameraId: string, existingPhotoId?: string): ConditionsSnapshot | null {
  const camera = project.cameras.find((entry) => entry.id === cameraId);
  if (!camera) return null;
  return {
    keepIds: project.keeps.map((keep) => keep.id),
    appliedElementIds: project.elements.filter((element) => element.status === 'apply').map((element) => element.id),
    excludedElementIds: project.elements.filter((element) => element.status === 'exclude').map((element) => element.id),
    ...(existingPhotoId ? { existingPhotoId } : {}),
    camera: { id: camera.id, name: camera.name, x: camera.x, y: camera.y, directionDegrees: camera.directionDegrees, fovPreset: camera.fovPreset ?? 'standard', viewPreset:camera.viewPreset, heightMeters:camera.heightMeters, eyeHeightPreset:camera.eyeHeightPreset, pitchDegrees:camera.pitchDegrees },
    common: structuredClone({
      concept: project.concept,
      ...(project.designGoal !== undefined ? { designGoal: project.designGoal } : {}),
      floorPlan: project.floorPlan,
      keeps: project.keeps,
      references: project.references,
      elements: project.elements,
      sourceImages: project.sourceImages,
      referenceBindings: project.referenceBindings,
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

/** Camera deletion retains its images and conditions; another remaining camera becomes primary. */
export function removeCamera(project: Project, cameraId: string): Project {
  const camera = project.cameras.find(item => item.id === cameraId);
  if (!camera) return project;
  const remaining = project.cameras.filter(item => item.id !== cameraId);
  const cameras = camera.primary ? remaining.map((item, index) => ({ ...item, primary: index === 0 })) : remaining;
  return { ...project, cameras, results: project.results.map(result => result.cameraId === cameraId ? { ...result, stale: true } : result) };
}
