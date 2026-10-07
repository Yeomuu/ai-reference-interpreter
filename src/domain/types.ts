/** All plan coordinates are normalized to the 0–1 range, independent of pixels. */
export interface Point {
  x: number;
  y: number;
}

export interface Rect extends Point {
  width: number;
  height: number;
}

export type StructureKind =
  | 'wall'
  | 'window'
  | 'pillar'
  | 'door'
  | 'entrance'
  | 'existing-light'
  | 'ceiling'
  | 'floor';

export type StructureGeometry =
  | { kind: 'segment'; start: Point; end: Point }
  | { kind: 'rect'; bounds: Rect }
  | { kind: 'circle'; center: Point; radius: number };

export interface Structure {
  id: string;
  kind: StructureKind;
  name: string;
  geometry: StructureGeometry;
  /** Window and opening spans use 0–1 positions along parent wall. */
  parentWallId?: string;
  wallSpan?: { start: number; end: number };
  /** Explicit no-obstruction area for doors and entrances. */
  clearance?: Rect;
  /** User-confirmed plan symbol. Unspecified doors never imply an inferred swing. */
  doorSwing?: { hinge: 'start' | 'end'; side: 1 | -1 };
  connectedPhotoRegionId?: string;
  /** Approximate visual location on an existing-space photograph; never plan geometry. */
  photoAnchor?: Point;
  /** Origin is independent from the user-controlled preservation lock. */
  role?: 'base' | 'partition';
  /** User-controlled preservation lock. Explicit false must survive reloads. */
  immutable?: boolean;
  /** Fixed scenario baseline: preservation cannot be released. Missing on legacy projects. */
  preservationRequired?: boolean;
  /** Remember the user's preservation conditions while its switch is off. */
  preservationSettings?: { description: string; allowedSurfaceTreatment?: boolean };
  /** Existing ceiling fixture light tone; its geometry is fixed while preserved. */
  lightTone?: string;
  protected: boolean;
}

export interface Area {
  id: string;
  name: string;
  kind: 'floor' | 'ceiling' | 'spatial' | 'passage';
  bounds: Rect;
  /** Optional manually traced outline; bounds is its enclosing box, never measured geometry. */
  outline?: Point[];
}

export interface FloorPlan {
  kind: 'uploaded' | 'schematic';
  width: number;
  height: number;
  units: 'unknown' | 'mm' | 'm';
  structures: Structure[];
  areas: Area[];
  geometryConfidence: 'measured' | 'schematic';
  imageUri?: string;
}

export interface SourceImage {
  id: string;
  role: 'existing-space' | 'inspiration' | 'product';
  uri: string;
  name: string;
  width?: number;
  height?: number;
  referenceId?: string;
  crop?: Rect;
  note?: string;
}

export interface Keep {
  id: string;
  structureId: string;
  intent: 'preserve';
  description: string;
  allowedSurfaceTreatment?: boolean;
}

export interface Reference {
  id: string;
  imageId: string;
  role: 'ambience' | 'element' | 'product';
  note: string;
  extractedElements: string[];
  exclusions: string[];
}

export type ElementKind =
  | 'display-product'
  | 'other-floor'
  | 'other-wall'
  | 'other-ceiling'
  | 'other-area'
  | 'freestanding-fixture'
  | 'furniture'
  | 'photozone'
  | 'wall-graphic'
  | 'wall-mounted-product'
  | 'ceiling-light'
  | 'hanging-display'
  | 'wall-light'
  | 'standing-light'
  | 'ambient-light'
  | 'global-palette'
  | 'floor-material'
  | 'wall-material';

export type PlacementTarget =
  | { kind: 'fixture-surface'; fixtureElementId: string; offset: Point }
  | { kind: 'floor-point'; x: number; y: number; rotationDegrees?: number; footprint?: { width: number; height: number } }
  | { kind: 'floor-area'; areaId: string }
  | { kind: 'wall-segment'; wallId: string; start: number; end: number; height?: string; face?: 'a' | 'b' }
  | { kind: 'ceiling-zone'; zoneId: string; offset?: Point; height?: string }
  | { kind: 'whole-space' }
  | { kind: 'named-area'; areaId: string };

export interface DesignElement {
  id: string;
  sourceReferenceId: string;
  /** Optional normalized region of the reference image. Omitted means the whole image. */
  sourceRegion?: Rect;
  label: string;
  kind: ElementKind;
  status: 'apply' | 'exclude';
  target: PlacementTarget | null;
  appearance?: string;
  conditions?: string;
  /** A user-added basic support is not extracted from the product photo. */
  origin?: 'basic-support' | 'layout' | 'mapping-condition';
  /** Reference-independent layout identity; geometry stays in target for compatibility. */
  layoutKind?: LayoutKind;
  locked?: boolean;
}

export type LayoutKind = 'display' | 'table' | 'chair' | 'light' | 'wall-art' | 'product' | 'area';
/** Reference-free layout view. Persisted DesignElement fields remain a legacy projection. */
export type LayoutItem = Omit<DesignElement, 'sourceReferenceId' | 'sourceRegion'>;
export interface ReferenceBinding {
  id: string;
  referenceId: string;
  sourceRegion?: Rect;
  layoutItemIds: string[];
  scope?: 'appearance' | 'lighting' | 'material';
}

export interface Camera extends Point {
  id: string;
  name: string;
  directionDegrees: number;
  fovPreset?: 'narrow' | 'standard' | 'wide';
  viewPreset?: 'overview' | 'entry' | 'secondary' | 'custom';
  heightMeters?: number;
  eyeHeightPreset?: 'average-female' | 'average-male' | 'custom';
  /** Negative pitch looks down; a suggested render height is not a measurement. */
  pitchDegrees?: number;
  recommendation?: 'automatic' | 'modified';
  primary: boolean;
}

export interface ConditionsSnapshot {
  keepIds: string[];
  appliedElementIds: string[];
  excludedElementIds: string[];
  /** Existing-space photograph selected for AI input; absent on older results. */
  existingPhotoId?: string;
  /** Older saved results may omit fovPreset; that means the standard view. */
  camera: Pick<Camera, 'id' | 'x' | 'y' | 'directionDegrees' | 'fovPreset' | 'viewPreset' | 'heightMeters' | 'eyeHeightPreset' | 'pitchDegrees'> & { name?: string };
  /** Full values preserve the original review state after later partial revisions. */
  common?: {
    concept: string;
    designGoal?: string;
    floorPlan: FloorPlan | null;
    keeps: Keep[];
    references: Reference[];
    elements: DesignElement[];
    /** Keeps historical source attribution after a reference is removed. */
    sourceImages?: SourceImage[];
    referenceBindings?: ReferenceBinding[];
  };
}

export interface Result {
  id: string;
  cameraId: string;
  commonRevision: number;
  createdAt: string;
  imageUri: string;
  origin: 'ai' | 'sample';
  approved: boolean;
  stale: boolean;
  conditionsSnapshot: ConditionsSnapshot;
}

export interface Project {
  schemaVersion: 1;
  id: string;
  name: string;
  spaceType: string;
  concept: string;
  /** User-authored desired design, separate from existing-space facts. */
  designGoal?: string;
  sourceImages: SourceImage[];
  floorPlan: FloorPlan | null;
  /** A replacement plan retains annotations but blocks preview until their alignment is checked. */
  planAlignmentPending?: boolean;
  keeps: Keep[];
  references: Reference[];
  elements: DesignElement[];
  cameras: Camera[];
  results: Result[];
  commonRevision: number;
  layoutVersion?: 2;
  referenceBindings?: ReferenceBinding[];
  /** Prepare once; deleting suggested cameras must not recreate them on reload. */
  cameraRecommendationVersion?: 1;
}

export interface ValidationIssue {
  code:
    | 'missing-plan'
    | 'plan-alignment-pending'
    | 'missing-existing-photo'
    | 'missing-primary-camera'
    | 'invalid-camera'
    | 'missing-element'
    | 'missing-reference'
    | 'missing-applied-element'
    | 'excluded-element'
    | 'missing-target'
    | 'missing-wall-face'
    | 'invalid-target-kind'
    | 'invalid-coordinate'
    | 'missing-structure'
    | 'missing-area'
    | 'invalid-area-kind'
    | 'outside-floor'
    | 'pillar-collision'
    | 'door-clearance'
    | 'passage-blocked'
    | 'opening-overlap'
    | 'partition-conflict'
    | 'structure-overlap'
    | 'area-overlap'
    | 'element-overlap'
    | 'keep-conflict';
  message: string;
  severity: 'error' | 'warning';
  elementId?: string;
  structureId?: string;
  cameraId?: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}
