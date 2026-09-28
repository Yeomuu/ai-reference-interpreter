import type { FloorPlan, Project } from '../domain/types';

const STORAGE_KEY = 'ai-reference-interpreter:projects:v1';
const SCHEMA_VERSION = 1;

interface StoredProjects {
  schemaVersion: typeof SCHEMA_VERSION;
  projects: Project[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isFraction(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isPoint(value: unknown): boolean {
  return isRecord(value) && isFraction(value.x) && isFraction(value.y);
}

function isRect(value: unknown): boolean {
  return isRecord(value) && isFraction(value.x) && isFraction(value.y) &&
    typeof value.width === 'number' && Number.isFinite(value.width) && value.width > 0 &&
    typeof value.height === 'number' && Number.isFinite(value.height) && value.height > 0 &&
    value.x + value.width <= 1 && value.y + value.height <= 1;
}

function isStructure(value: unknown): boolean {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string' ||
      !['wall', 'window', 'pillar', 'door', 'entrance', 'existing-light', 'ceiling', 'floor'].includes(String(value.kind)) ||
      typeof value.protected !== 'boolean' || !isRecord(value.geometry)) return false;
  const geometry = value.geometry;
  const validGeometry = geometry.kind === 'segment' ? isPoint(geometry.start) && isPoint(geometry.end)
    : geometry.kind === 'rect' ? isRect(geometry.bounds)
      : geometry.kind === 'circle' && isPoint(geometry.center) &&
        typeof geometry.radius === 'number' && Number.isFinite(geometry.radius) && geometry.radius > 0;
  return validGeometry &&
    (value.immutable === undefined || typeof value.immutable === 'boolean') &&
    (value.role === undefined || value.role === 'base' || value.role === 'partition') &&
    (value.preservationSettings === undefined || (isRecord(value.preservationSettings) && typeof value.preservationSettings.description === 'string' &&
      (value.preservationSettings.allowedSurfaceTreatment === undefined || typeof value.preservationSettings.allowedSurfaceTreatment === 'boolean'))) &&
    (value.parentWallId === undefined || typeof value.parentWallId === 'string') &&
    (value.lightTone === undefined || typeof value.lightTone === 'string') &&
    (value.photoAnchor === undefined || isPoint(value.photoAnchor)) &&
    (value.clearance === undefined || isRect(value.clearance)) &&
    (value.wallSpan === undefined || (isRecord(value.wallSpan) &&
      isFraction(value.wallSpan.start) && isFraction(value.wallSpan.end) && value.wallSpan.start < value.wallSpan.end));
}

function isFloorPlan(value: unknown): value is FloorPlan {
  if (!isRecord(value)) return false;
  return (value.kind === 'uploaded' || value.kind === 'schematic') &&
    typeof value.width === 'number' && Number.isFinite(value.width) && value.width > 0 &&
    typeof value.height === 'number' && Number.isFinite(value.height) && value.height > 0 &&
    ['unknown', 'mm', 'm'].includes(String(value.units)) &&
    (value.geometryConfidence === 'measured' || value.geometryConfidence === 'schematic') &&
    (value.imageUri === undefined || typeof value.imageUri === 'string') &&
    Array.isArray(value.structures) && value.structures.every(isStructure) &&
    Array.isArray(value.areas) && value.areas.every((area: unknown) =>
      isRecord(area) && typeof area.id === 'string' && typeof area.name === 'string' &&
      ['floor', 'ceiling', 'spatial', 'passage'].includes(String(area.kind)) && isRect(area.bounds));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isSourceImage(value: unknown): boolean {
  return isRecord(value) && typeof value.id === 'string' &&
    ['existing-space', 'inspiration', 'product'].includes(String(value.role)) &&
    typeof value.uri === 'string' && typeof value.name === 'string' &&
    (value.width === undefined || (typeof value.width === 'number' && Number.isFinite(value.width) && value.width > 0)) &&
    (value.height === undefined || (typeof value.height === 'number' && Number.isFinite(value.height) && value.height > 0)) &&
    (value.referenceId === undefined || typeof value.referenceId === 'string') &&
    (value.crop === undefined || isRect(value.crop)) &&
    (value.note === undefined || typeof value.note === 'string');
}

function isKeep(value: unknown): boolean {
  return isRecord(value) && typeof value.id === 'string' && typeof value.structureId === 'string' &&
    value.intent === 'preserve' && typeof value.description === 'string' &&
    (value.allowedSurfaceTreatment === undefined || typeof value.allowedSurfaceTreatment === 'boolean');
}

function isReference(value: unknown): boolean {
  return isRecord(value) && typeof value.id === 'string' && typeof value.imageId === 'string' &&
    ['ambience', 'element', 'product'].includes(String(value.role)) && typeof value.note === 'string' &&
    isStringArray(value.extractedElements) && isStringArray(value.exclusions);
}

function isPlacementTarget(value: unknown): boolean {
  if (!isRecord(value)) return false;
  switch (value.kind) {
    case 'floor-point':
      return isFraction(value.x) && isFraction(value.y) &&
        (value.rotationDegrees === undefined || (typeof value.rotationDegrees === 'number' && Number.isFinite(value.rotationDegrees))) &&
        (value.footprint === undefined || (isRecord(value.footprint) &&
          typeof value.footprint.width === 'number' && Number.isFinite(value.footprint.width) && value.footprint.width > 0 &&
          typeof value.footprint.height === 'number' && Number.isFinite(value.footprint.height) && value.footprint.height > 0));
    case 'floor-area':
    case 'named-area':
      return typeof value.areaId === 'string';
    case 'wall-segment':
      return typeof value.wallId === 'string' && isFraction(value.start) && isFraction(value.end) &&
        value.start < value.end && (value.height === undefined || typeof value.height === 'string');
    case 'ceiling-zone':
      return typeof value.zoneId === 'string' && (value.offset === undefined || isPoint(value.offset)) &&
        (value.height === undefined || typeof value.height === 'string');
    case 'whole-space':
      return true;
    default:
      return false;
  }
}

function isElement(value: unknown): boolean {
  return isRecord(value) && typeof value.id === 'string' && typeof value.sourceReferenceId === 'string' &&
    (value.sourceRegion === undefined || isRect(value.sourceRegion)) &&
    typeof value.label === 'string' &&
    ['freestanding-fixture', 'furniture', 'photozone', 'wall-graphic', 'wall-mounted-product',
      'ceiling-light', 'hanging-display', 'wall-light', 'standing-light', 'ambient-light',
      'global-palette', 'floor-material', 'wall-material'].includes(String(value.kind)) &&
    (value.status === 'apply' || value.status === 'exclude') &&
    (value.target === null || isPlacementTarget(value.target)) &&
    (value.appearance === undefined || typeof value.appearance === 'string') &&
    (value.conditions === undefined || typeof value.conditions === 'string');
}

function isCamera(value: unknown): boolean {
  return isRecord(value) && typeof value.id === 'string' && typeof value.name === 'string' &&
    isFraction(value.x) && isFraction(value.y) &&
    typeof value.directionDegrees === 'number' && Number.isFinite(value.directionDegrees) &&
    (value.fovPreset === undefined || ['narrow', 'standard', 'wide'].includes(String(value.fovPreset))) &&
    typeof value.primary === 'boolean';
}

function isConditionsSnapshot(value: unknown): boolean {
  if (!isRecord(value) || !isStringArray(value.keepIds) || !isStringArray(value.appliedElementIds) ||
      !isStringArray(value.excludedElementIds) ||
      (value.existingPhotoId !== undefined && typeof value.existingPhotoId !== 'string') ||
      !isRecord(value.camera) ||
      typeof value.camera.id !== 'string' || !isFraction(value.camera.x) || !isFraction(value.camera.y) ||
      typeof value.camera.directionDegrees !== 'number' || !Number.isFinite(value.camera.directionDegrees) ||
      (value.camera.fovPreset !== undefined && !['narrow', 'standard', 'wide'].includes(String(value.camera.fovPreset)))) return false;
  if (value.common === undefined) return true;
  const common = value.common;
  return isRecord(common) && typeof common.concept === 'string' &&
    (common.floorPlan === null || isFloorPlan(common.floorPlan)) &&
    Array.isArray(common.keeps) && common.keeps.every(isKeep) &&
    Array.isArray(common.references) && common.references.every(isReference) &&
    Array.isArray(common.elements) && common.elements.every(isElement) &&
    (common.sourceImages === undefined || (Array.isArray(common.sourceImages) && common.sourceImages.every(isSourceImage)));
}

function isResult(value: unknown): boolean {
  return isRecord(value) && typeof value.id === 'string' && typeof value.cameraId === 'string' &&
    Number.isInteger(value.commonRevision) && typeof value.createdAt === 'string' &&
    typeof value.imageUri === 'string' && (value.origin === 'ai' || value.origin === 'sample') &&
    typeof value.approved === 'boolean' && typeof value.stale === 'boolean' &&
    isConditionsSnapshot(value.conditionsSnapshot);
}

/** Shared with the server endpoint before accepting billable generation input. */
export function isProject(value: unknown): value is Project {
  if (!isRecord(value)) return false;
  const project = value;
  return project.schemaVersion === SCHEMA_VERSION &&
    typeof project.id === 'string' &&
    typeof project.name === 'string' &&
    typeof project.spaceType === 'string' &&
    typeof project.concept === 'string' &&
    Number.isInteger(project.commonRevision) &&
    (project.planAlignmentPending === undefined || typeof project.planAlignmentPending === 'boolean') &&
    (project.floorPlan === null || isFloorPlan(project.floorPlan)) &&
    Array.isArray(project.sourceImages) && project.sourceImages.every(isSourceImage) &&
    Array.isArray(project.keeps) && project.keeps.every(isKeep) &&
    Array.isArray(project.references) && project.references.every(isReference) &&
    Array.isArray(project.elements) && project.elements.every(isElement) &&
    Array.isArray(project.cameras) && project.cameras.every(isCamera) &&
    Array.isArray(project.results) && project.results.every(isResult);
}

function storage(): Storage {
  if (typeof localStorage === 'undefined') {
    throw new Error('이 브라우저에서는 로컬 프로젝트 저장소를 사용할 수 없습니다.');
  }
  return localStorage;
}

/** Return only records from the current schema; never silently migrate unknown data. */
export function loadProjects(): Project[] {
  const raw = storage().getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return [];
    const envelope = parsed as Partial<StoredProjects>;
    if (envelope.schemaVersion !== SCHEMA_VERSION || !Array.isArray(envelope.projects)) return [];
    return envelope.projects.filter(isProject);
  } catch {
    return [];
  }
}

export function getProject(id: string): Project | null {
  return loadProjects().find((project) => project.id === id) ?? null;
}

function writeProjects(projects: Project[]): void {
  const envelope: StoredProjects = { schemaVersion: SCHEMA_VERSION, projects };
  try {
    const target = storage();
    const previous = target.getItem(STORAGE_KEY);
    if (previous) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(previous);
      } catch {
        throw new Error('손상된 프로젝트 데이터가 있어 덮어쓰지 않았습니다.');
      }
      const stored = parsed as Partial<StoredProjects> | null;
      if (!stored || stored.schemaVersion !== SCHEMA_VERSION ||
          !Array.isArray(stored.projects) || !stored.projects.every(isProject)) {
        throw new Error('손상되었거나 다른 버전의 프로젝트 데이터가 있어 덮어쓰지 않았습니다.');
      }
    }
    target.setItem(STORAGE_KEY, JSON.stringify(envelope));
  } catch (error) {
    if (error instanceof Error && error.message.includes('덮어쓰지 않았습니다')) throw error;
    throw new Error('프로젝트를 이 브라우저에 저장하지 못했습니다. 저장 공간과 브라우저 설정을 확인해 주세요.');
  }
}

/** Images are stored separately in IndexedDB; project JSON only contains stable asset URIs. */
export function saveProject(project: Project): void {
  if (!isProject(project)) throw new Error('지원되지 않는 프로젝트 형식입니다.');
  const existing = loadProjects();
  const index = existing.findIndex((item) => item.id === project.id);
  if (index < 0) writeProjects([project, ...existing]);
  else writeProjects(existing.map((item, position) => position === index ? project : item));
}

export function removeProject(id: string): void {
  writeProjects(loadProjects().filter((project) => project.id !== id));
}
