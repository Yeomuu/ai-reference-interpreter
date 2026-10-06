import LayoutSymbol from './LayoutSymbol';
import { layoutKindFor, LAYOUT_LABELS } from '../domain/layoutMapping';
import { isCountedLayoutItem } from '../domain/prototypeLimits';
import { REFERENCE_DRAG_TYPE } from './MappingWorkspace';
import PlanSymbol from './PlanSymbol'
import { displayPosition, isDisplaySupport } from '../domain/display';
import { arrangePlanLabels } from './plan-labels';
import { elementPlanPosition } from '../services/planGuide';
import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent, PointerEvent } from 'react';
import type { DesignElement, FloorPlan, Point, Project, Structure } from '../domain/types';
import { resolveImageUri, revokeImageUrl } from '../services/assets';
import { projectOntoWall, wallNearPointer, adjacentWallAtPointer } from './plan-drawing';
import { previewStructureTranslation, structureMovementReason } from '../domain/structureEditing';
import { AREA_LABELS, targetForArea } from '../domain/areaTargets';
import PlanAreaControls from './PlanAreaControls';
import type { AreaLayers } from './PlanAreaControls';
import PlanMovementOverlay from './PlanMovementOverlay';
import { physicalFloorBounds } from '../domain/validation';
import { translatedElementTarget, validateMovementPreview, type MovementPreview } from '../domain/movementFeedback';
import PlanLegend from './PlanLegend';
import TimedNotice from './TimedNotice';
import { wallFaceLabel, wallFaceLine } from '../domain/wallFaces';
import './plan-canvas.css';

export interface PlanCanvasProps {
  onValidationDismiss?: () => void;
  project: Project;
  onUndo?: () => void; onRedo?: () => void; canUndo?: boolean; canRedo?: boolean;
  onDragEvent?: (phase: 'start' | 'end' | 'cancel', kind: string, id: string) => void;
  selectedElementId?: string;
  selectedStructureId?: string;
  selectedCameraId?: string;
  selectedAreaId?: string;
  showCameraPreview?: boolean;
  onAreaSelect?: (id: string) => void;
  mode: 'view' | 'keep' | 'place' | 'camera' | 'mapping';
  quietLabels?: boolean;
  mappingSelectedIds?: string[];
  attachmentWallId?: string;
  selectedWallFace?: 'a' | 'b';
  onWallFaceSelect?: (wallId: string, face: 'a' | 'b') => void;
  wallAttachmentMode?: boolean;
  areaSelectionMode?: boolean;
  onMappingSelect?: (id: string, multi: boolean) => void;
  onReferenceDrop?: (targetId: string, referenceId: string, region?: import('../domain/types').Rect) => void;
  drawTool?: 'point' | 'segment' | 'rect' | 'polygon';
  drawStructureKind?: Structure['kind'];
  lineConstraint?: 'snap' | 'horizontal' | 'vertical' | 'free';
  onDrawPolygon?: (points: Point[]) => boolean;
  onStructureLockToggle?: (id: string) => void;
  onSupportSelect?: (id: string) => void;
  supportPlacementMode?: boolean;
  pointPlacementMode?: boolean;
  drawWallId?: string;
  validationMessage?: string;
  onDrawWallSelect?: (id: string) => void;
  onDraw?: (start: Point, end: Point, wallId?: string) => void;
  onStructureSelect?: (id: string) => void;
  onStructureMove?: (id: string, delta: Point) => void;
  onPlacePoint?: (x: number, y: number) => void;
  onWallSelect?: (id: string) => void;
  onElementSelect?: (id: string) => void;
  onElementMove?: (id: string, x: number, y: number) => void;
  onElementRotate?: (id: string, degrees: number) => void;
  onWallElementMove?: (id: string, wallId: string, start: number, end: number) => void;
  onCameraSelect?: (id: string) => void;
  onCameraMove?: (id: string, x: number, y: number) => void;
  onCameraRotate?: (id: string, degrees: number) => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;

type DragKind = 'element-move' | 'element-rotate' | 'wall-element-move' | 'camera-move' | 'camera-rotate' | 'structure-move';
type WallDrag = {
  wallId: string;
  start: number;
  end: number;
  pointerOffset: number;
  geometry: { start: Point; end: Point };
  spanPixels: number;
};
type StructureDrag = { pointer: Point };
type DragState = {
  kind: DragKind;
  id?: string;
  pointerId: number;
  startX: number;
  startY: number;
  moved: boolean;
  center?: Point;
  pointerOffset?: Point;
  wall?: WallDrag;
  structure?: StructureDrag;
};
type Preview = MovementPreview;
type DrawDraft = { pointerId: number; start: Point; end: Point; wallId?: string; clientStart: Point };

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

function normalDegrees(value: number): number {
  return (Math.round(value) % 360 + 360) % 360;
}

function safeLocalImage(uri: string | undefined): string | undefined {
  if (!uri) return undefined;
  return /^(?:\/sample\/[a-z0-9_.-]+\.(?:png|jpe?g|webp)|blob:)/i.test(uri) ? uri : undefined;
}

function pointOnSegment(start: Point, end: Point, fraction: number): Point {
  return {
    x: start.x + (end.x - start.x) * fraction,
    y: start.y + (end.y - start.y) * fraction,
  };
}

function fractionOnSegment(point: Point, start: Point, end: Point, width: number, height: number): number {
  const dx = (end.x - start.x) * width;
  const dy = (end.y - start.y) * height;
  const distanceSquared = dx * dx + dy * dy;
  if (distanceSquared === 0) return 0;
  const px = (point.x - start.x) * width;
  const py = (point.y - start.y) * height;
  return (px * dx + py * dy) / distanceSquared;
}

function structureCenter(structure: Structure): Point {
  const geometry = structure.geometry;
  if (geometry.kind === 'segment') return pointOnSegment(geometry.start, geometry.end, 0.5);
  if (geometry.kind === 'rect') return {
    x: geometry.bounds.x + geometry.bounds.width / 2,
    y: geometry.bounds.y + geometry.bounds.height / 2,
  };
  return geometry.center;
}

function areaBounds(plan: FloorPlan, areaId: string) {
  return plan.areas.find((area) => area.id === areaId)?.bounds;
}

/** Plan values remain normalized. Only this component maps them to SVG units. */
export default function PlanCanvas({
  project, quietLabels = false, mappingSelectedIds = [], attachmentWallId, selectedWallFace, onWallFaceSelect, wallAttachmentMode = false, areaSelectionMode = false, onMappingSelect, onReferenceDrop,
  onUndo, onRedo, canUndo, canRedo,
  onDragEvent,
  selectedElementId,
  selectedStructureId,
  selectedCameraId,
  selectedAreaId,
  showCameraPreview = false,
  onAreaSelect,
  mode,
  drawTool,
  drawStructureKind,
  lineConstraint = 'free',
  onDrawPolygon,
  onStructureLockToggle,
  onSupportSelect,
  supportPlacementMode = false,
  pointPlacementMode = false,
  drawWallId,
  validationMessage,
  onValidationDismiss,
  onDrawWallSelect,
  onDraw,
  onStructureSelect,
  onStructureMove,
  onPlacePoint,
  onWallSelect,
  onElementSelect,
  onElementMove,
  onElementRotate,
  onWallElementMove,
  onCameraSelect,
  onCameraMove,
  onCameraRotate,
}: PlanCanvasProps) {
  const dragEventRef = useRef(onDragEvent);
  useEffect(() => { dragEventRef.current = onDragEvent; }, [onDragEvent]);
  const svgRef = useRef<SVGSVGElement>(null);
  const contentRef = useRef<SVGGElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const previewRef = useRef<Preview | null>(null);
  const drawRef = useRef<DrawDraft | null>(null);
  const suppressClickRef = useRef(false);
  const instructionId = useId();
  const [hoveredId, setHoveredId] = useState<string>();
  const [dropTarget, setDropTarget] = useState<string>();
  const [zoom, setZoom] = useState(1);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [drawDraft, setDrawDraft] = useState<DrawDraft | null>(null);
  const [outlineRedo, setOutlineRedo] = useState<Point[]>([]);
  const [outlineDraft, setOutlineDraft] = useState<Point[]>([]);
  const [gestureHint, setGestureHint] = useState<string | null>(null);
  const [layers, setLayers] = useState({ structures: true, elements: true, cameras: true });
  const [areaLayers, setAreaLayers] = useState<AreaLayers>({ floor: true, ceiling: false, spatial: true, passage: true });
  const [showAreaNames, setShowAreaNames] = useState(false);
  const [dimOtherAreas, setDimOtherAreas] = useState(true);
  const [localAreaId, setLocalAreaId] = useState<string>();
  const movementPatternId = useId();
  const [imageState, setImageState] = useState<{ sourceUri: string; url?: string; error?: string } | null>(null);
  const [canvasDisplay, setCanvasDisplay] = useState({ scale: 1, narrow: false, width: 0, height: 0 });
  const plan = project.floorPlan;
  const planWidth = plan?.width;
  const planHeight = plan?.height;
  const sourceUri = plan?.kind === 'uploaded' ? plan.imageUri : undefined;
  const focusedSelectionRef = useRef('');

  // Selecting a saved item should also find it when a previous zoom clipped it.
  useEffect(() => {
    const id = mode === 'mapping' ? mappingSelectedIds.at(-1) : selectedElementId;
    const selection = `${project.id}:${id ?? ''}`;
    if (focusedSelectionRef.current === selection) return;
    focusedSelectionRef.current = selection;
    const item = project.elements.find(element => element.id === id);
    const point = item && elementPlanPosition(project, item);
    if (point && [point.x, point.y].some(value => Math.abs(value - .5) * zoom > .5)) setZoom(1);
  }, [project, selectedElementId, mappingSelectedIds, mode, zoom]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !planWidth || !planHeight) return;
    const update = () => {
      const bounds = svg.getBoundingClientRect();
      const scale = Math.min(bounds.width / planWidth, bounds.height / planHeight);
      if (!Number.isFinite(scale) || scale <= 0) return;
      const narrow = typeof window.matchMedia === 'function'
        ? window.matchMedia('(max-width: 767px)').matches
        : window.innerWidth <= 767;
      setCanvasDisplay((current) => current.narrow === narrow && Math.abs(current.scale - scale) < 0.001 && Math.abs(current.width - bounds.width) < 1 && Math.abs(current.height - bounds.height) < 1
        ? current : { scale, narrow, width: bounds.width, height: bounds.height });
    };
    update();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(svg);
    window.addEventListener('resize', update);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [planWidth, planHeight]);

  useEffect(() => {
    if (!sourceUri) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    void resolveImageUri(sourceUri).then((url) => {
      objectUrl = url;
      if (cancelled) revokeImageUrl(url);
      else setImageState({ sourceUri, url });
    }).catch((error: unknown) => {
      if (!cancelled) setImageState({ sourceUri, error: error instanceof Error ? error.message : '도면 이미지를 읽지 못했습니다.' });
    });
    return () => {
      cancelled = true;
      if (objectUrl) revokeImageUrl(objectUrl);
    };
  }, [sourceUri]);

  useEffect(() => () => {
    if (dragRef.current?.id) dragEventRef.current?.('cancel', dragRef.current.kind, dragRef.current.id);
    const pointerId = drawRef.current?.pointerId ?? dragRef.current?.pointerId;
    const svg = svgRef.current;
    drawRef.current = null;
    dragRef.current = null;
    previewRef.current = null;
    if (pointerId !== undefined && svg?.hasPointerCapture(pointerId)) svg.releasePointerCapture(pointerId);
    setDrawDraft(null);
    setPreview(null);
    setGestureHint(null);
  }, [drawTool, project.id]);

  if (!plan) {
    return <div className="plan-canvas plan-canvas--empty" role="status">도면이 없습니다. 공간 자료에서 도면을 등록하거나 개략 도면을 만들어 주세요.</div>;
  }

  const activePlan: FloorPlan = plan;
  const width = Math.max(1, plan.width);
  const height = Math.max(1, plan.height);
  const floorAreas = plan.areas.filter((area) => area.kind === 'floor');
  const imageUri = sourceUri && imageState?.sourceUri === sourceUri ? safeLocalImage(imageState.url) : undefined;
  const imageError = sourceUri && imageState?.sourceUri === sourceUri ? imageState.error : undefined;
  const keptIds = new Set(project.keeps.map((keep) => keep.structureId));
  const activeElements = project.elements.filter((element) => element.status === 'apply' && element.target);
  const placedObjects = activeElements.filter(isCountedLayoutItem);
  const movableStructures = plan.structures.filter((structure) => !structureMovementReason(project, structure));
  const wallDrawing = drawTool === 'segment' && Boolean(onDrawWallSelect);
  const activeDrawWall = plan.structures.find((structure) => structure.id === (drawDraft?.wallId ?? drawWallId));
  const modeInstruction = drawTool === 'polygon' ? '윤곽의 모서리를 순서대로 누르세요. 곡선은 여러 점으로 표시합니다. 윤곽 저장 또는 Enter로 완료, 마지막 점 취소 또는 Backspace로 수정, Escape로 취소합니다.' : drawTool === 'point'
    ? '원하는 위치를 한 번 누르면 구조가 추가됩니다.'
    : drawTool === 'segment'
      ? wallDrawing ? `${activeDrawWall?.name ?? '연결할 벽'}의 선에서 시작해 원하는 길이만큼 끌어 주세요. 다른 벽의 선을 누르면 연결 벽이 바뀝니다.` : '시작 위치를 누른 채 끝 위치까지 끌어 주세요. 마우스를 놓으면 선이 추가됩니다.'
      : drawTool === 'rect'
        ? '한쪽 모서리를 누른 채 반대쪽 모서리까지 끌어 주세요. 마우스를 놓으면 범위가 추가됩니다.'
        : mode === 'mapping'
          ? '도면에서 대상을 선택하고 참고 이미지를 적용하세요. Shift로 여러 대상을 선택합니다. 배치 요소를 끌면 위치를 조정할 수 있습니다.'
        : mode === 'place'
    ? '요소는 끌어서 이동하고 회전 손잡이로 각도를 조정하세요. ‘이동 가능’ 구조도 끌 수 있습니다. 벽에 붙은 창·문은 연결 벽을 따라 이동합니다. 빈 바닥 클릭은 선택한 디자인 요소를 배치합니다.'
    : mode === 'camera'
      ? '카메라 본체를 끌면 위치가 이동합니다. 본체와 떨어진 회전 손잡이를 끌면 시선 각도만 바뀝니다. 빈 바닥을 눌러도 카메라는 이동하지 않습니다.'
      : mode === 'keep'
        ? `구조를 선택하고 필수 보존을 켜거나 끄세요. ${movableStructures.length ? '‘이동 가능’ 이름표나 구조를 끌면 위치가 바뀝니다.' : '현재 이동 가능한 구조가 없습니다. 필수 보존을 끄면 도면 위치를 수정할 수 있습니다.'}`
        : movableStructures.length ? '‘이동 가능’ 이름표나 구조를 끌어 위치를 바꾸세요. 빈 공간을 끌면 도면은 이동하지 않습니다.' : '현재 이동 가능한 구조가 없습니다. 유지할 구조에서 위치 고정을 끄거나 ‘추가 가벽’을 그려 주세요.';
  const showElements = mode === 'place' || mode === 'mapping' || mode === 'camera' || showCameraPreview;
  const visibleElements = showElements ? activeElements.filter(element => layers.elements || element.id === selectedElementId || mappingSelectedIds.includes(element.id)) : [];
  const showCameras = mode === 'camera' || showCameraPreview;
  const showStructureLayer = Boolean(drawTool) || layers.structures;
  const contentPixelScale = Math.max(0.01, canvasDisplay.scale * zoom);
  const selectedArea = plan.areas.find(area => area.id === (selectedAreaId ?? localAreaId));
  const showAreas = mode === 'view' || mode === 'place' || mode === 'mapping';
  const visibleAreas = plan.areas.filter(area => area.kind === 'passage' || showAreas && (areaLayers[area.kind] || area.id === selectedArea?.id || mappingSelectedIds.includes(`area:${area.id}`)));
  const areaLabels = visibleAreas.filter(area => showAreaNames || area.id === selectedArea?.id || mappingSelectedIds.includes(`area:${area.id}`) || hoveredId===`area:${area.id}`);
  const selectedDesignElement = project.elements.find(element => element.id === selectedElementId);
  const linkableAreaIds = mode === 'place' && onAreaSelect && selectedDesignElement ? new Set(plan.areas.filter(area => targetForArea(selectedDesignElement.kind, area)).map(area => area.id)) : undefined;
  function selectArea(id: string) {
    if (onAreaSelect) onAreaSelect(id);
    else setLocalAreaId(id);
  }
  const movementValidation = validateMovementPreview(project, preview);
  const previewBlocked = movementValidation?.valid === false;
  const movementReason = movementValidation?.issues.find(issue => issue.severity === 'error')?.message;
  const movedStructures = preview?.kind === 'structure-move' && preview.structure ? previewStructureTranslation(project, preview.id, preview.structure) : plan.structures;
  const editingStructure = drawStructureKind ?? plan.structures.find(item => item.id === (preview?.kind === 'structure-move' ? preview.id : selectedStructureId))?.kind;
  const showCameraOccupancy = !showCameras && (editingStructure === 'wall' || editingStructure === 'pillar') && (Boolean(drawStructureKind) || movableStructures.some(item => item.id === selectedStructureId));
  const clearanceNames = movedStructures.filter(item => item.clearance && (showAreaNames || item.id === selectedStructureId)).map(item => ({ id: `clearance-${item.id}`, name: `${item.name} · 여닫이`, hint: `${item.name} · 출입·여닫이 여유 공간`, x: item.clearance!.x + item.clearance!.width / 2, y: item.clearance!.y + item.clearance!.height / 2 }));
  const occupancyNames = !showElements || !layers.elements ? activeElements.filter(element => element.id === selectedElementId).flatMap(element => { const bounds = physicalFloorBounds(project, element); return bounds ? [{ id: `occupancy-${element.id}`, name: element.label, hint: `${element.label} · 배치 점유 범위`, x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }] : []; }) : [];
  const elementNames = !preview ? visibleElements.filter(element => (!quietLabels && placedObjects.length <= 4) || element.id === selectedElementId || element.id === hoveredId || mappingSelectedIds.includes(element.id)).flatMap(element => {
    if (!isCountedLayoutItem(element) || !element.target || !['floor-point', 'floor-area', 'ceiling-zone', 'fixture-surface', 'wall-segment'].includes(element.target.kind)) return [];
    const point = elementPlanPosition(project, element);
    return point ? [{ id: `element-name-${element.id}`, name: element.label, hint: element.label, x: point.x, y: point.y }] : [];
  }) : [];
  const constraintNames = [...elementNames.sort((a, b) => Number(b.id === `element-name-${selectedElementId}`) - Number(a.id === `element-name-${selectedElementId}`)), ...clearanceNames, ...occupancyNames];

  const areaLabelCandidates = areaLabels.map(area => ({ id: `area-${area.id}`, x: (area.bounds.x + area.bounds.width / 2) * width * contentPixelScale, y: (area.bounds.y + area.bounds.height / 2) * height * contentPixelScale, width: Math.min(220, area.name.length * 14 + 32), height: 40 }));
  const showStructureNames = wallDrawing || !quietLabels && plan.structures.length <= 5;
  const labeledStructures = showStructureLayer ? plan.structures.filter(structure => showStructureNames || (!quietLabels && !keptIds.has(structure.id)) || structure.id === selectedStructureId || structure.id === hoveredId || mappingSelectedIds.includes(`wall:${structure.id}`)) : [];
  const structureLabelCandidates = labeledStructures.map(structure => {
    const moved = movedStructures.find(item => item.id === structure.id);
    const center = structureCenter(moved ?? structure);
    const moving = !drawTool && movableStructures.some(item => item.id === structure.id) && mode !== 'camera';
    const name = structure.name.length > 12 ? `${structure.name.slice(0, 11)}…` : structure.name;
    const edgeWall = structure.kind === 'wall';
    const horizontal = structure.geometry.kind === 'segment' && Math.abs(structure.geometry.end.x - structure.geometry.start.x) * width > Math.abs(structure.geometry.end.y - structure.geometry.start.y) * height;
    const nearBottom = center.y > .8;
    const openingOffset = structure.kind === 'door' ? -70 : structure.kind === 'entrance' ? 70 : 0;
    return { id: structure.id,
      x: center.x * width * contentPixelScale + openingOffset + (edgeWall && !horizontal ? center.x < .5 ? -24 : 24 : 0),
      y: center.y * height * contentPixelScale + (edgeWall ? horizontal ? nearBottom ? 24 : -24 : 0 : nearBottom ? -26 : 26),
      width: name.length * 13 + (moving ? 100 : 50), height: 40 };
  });
  const movementBounds = [
    ...plan.areas.filter(area => area.kind === 'passage').map(area => ({ id: `range-${area.id}`, bounds: area.bounds })),
    ...movedStructures.flatMap(item => item.clearance ? [{ id: `range-${item.id}`, bounds: item.clearance }] : []),
    ...activeElements.filter(element => !preview || preview.id !== element.id).flatMap(element => { const bounds = physicalFloorBounds(project, element); return bounds ? [{ id: `range-${element.id}`, bounds }] : []; }),
  ].map(item => ({ id: item.id, x: (item.bounds.x + item.bounds.width / 2) * width * contentPixelScale, y: (item.bounds.y + item.bounds.height / 2) * height * contentPixelScale, width: item.bounds.width * width * contentPixelScale, height: item.bounds.height * height * contentPixelScale }));
  const savedWallTarget = mode === 'place' && selectedDesignElement?.target?.kind === 'wall-segment' ? selectedDesignElement.target : undefined;
  const wallFaceMarkers = plan.structures.filter(wall => wall.role === 'partition' && (
    mappingSelectedIds.includes(`wall:${wall.id}`) || attachmentWallId === wall.id ||
    !attachmentWallId && savedWallTarget?.wallId === wall.id
  )).flatMap(wall => (['a', 'b'] as const).flatMap(face => {
    const point = wallFaceLine(wall, .5, .5, face, width, height, 24 / contentPixelScale)?.start;
    return point ? [{ wall, face, point }] : [];
  }));
  const markerObstacles = [
    ...wallFaceMarkers.map(({ wall, face, point }) => ({ id: `face-${wall.id}-${face}`, x: point.x * contentPixelScale, y: point.y * contentPixelScale, width: 40, height: 40 })),
    ...(showCameras && layers.cameras ? project.cameras.map(camera => ({ id: `camera-${camera.id}`, x: camera.x * width * contentPixelScale, y: camera.y * height * contentPixelScale, width: 108, height: 52 })) : []),
    ...(showCameraOccupancy ? project.cameras.map(camera => ({ id: `camera-${camera.id}`, x: camera.x * width * contentPixelScale, y: camera.y * height * contentPixelScale, width: 28, height: 28 })) : []),
    ...movedStructures.filter(item => item.kind === 'pillar').flatMap(item => {
      const geometry = item.geometry;
      if (geometry.kind === 'rect') return [{ id: item.id, x: (geometry.bounds.x + geometry.bounds.width / 2) * width * contentPixelScale, y: (geometry.bounds.y + geometry.bounds.height / 2) * height * contentPixelScale, width: geometry.bounds.width * width * contentPixelScale, height: geometry.bounds.height * height * contentPixelScale }];
      if (geometry.kind === 'circle') { const radius = geometry.radius * Math.min(width, height) * contentPixelScale; return [{ id: item.id, x: geometry.center.x * width * contentPixelScale, y: geometry.center.y * height * contentPixelScale, width: radius * 2, height: radius * 2 }]; }
      return [];
    }),
    ...(showElements && layers.elements ? activeElements.flatMap(element => { const position = element.target?.kind === 'floor-point' ? element.target : displayPosition(project, element); return position ? [{ id: `element-${element.id}`, x: position.x * width * contentPixelScale, y: position.y * height * contentPixelScale, width: 48, height: 48 }] : []; }) : []),
  ];
  // Use the entire visible SVG surface, including the side margins left by
  // preserveAspectRatio. Labels need not squeeze into the physical plan box.
  const labelWidth = canvasDisplay.width || width * contentPixelScale;
  const labelHeight = canvasDisplay.height || height * contentPixelScale;
  const labelOffset = { x: (labelWidth - width * contentPixelScale) / 2, y: (labelHeight - height * contentPixelScale) / 2 };
  const inSurface = (item: { id: string; x: number; y: number; width: number; height: number }) => ({ ...item, x: item.x + labelOffset.x, y: item.y + labelOffset.y });
  const packedLabels = arrangePlanLabels([
    ...areaLabelCandidates.filter(label => label.id === `area-${selectedArea?.id}`),
    ...structureLabelCandidates.filter(label => label.id === selectedStructureId),
    ...areaLabelCandidates.filter(label => label.id !== `area-${selectedArea?.id}` && plan.areas.find(area => `area-${area.id}` === label.id)?.kind === 'passage'),
    ...constraintNames.map(label => ({ ...label, x: label.x * width * contentPixelScale, y: label.y * height * contentPixelScale, width: Math.min(220, label.name.length * 14 + 16), height: 24 })),
    ...structureLabelCandidates.filter(label => label.id !== selectedStructureId).sort((a, b) => Number(plan.structures.find(item => item.id === a.id)?.kind === 'wall') - Number(plan.structures.find(item => item.id === b.id)?.kind === 'wall')),
    ...areaLabelCandidates.filter(label => label.id !== `area-${selectedArea?.id}` && plan.areas.find(area => `area-${area.id}` === label.id)?.kind !== 'passage'),
  ].map(inSurface), labelWidth, labelHeight, [...movementBounds, ...markerObstacles].map(inSurface));
  const labels = new Map([...packedLabels].map(([id, item]) => [id, { ...item, x: item.x - labelOffset.x, y: item.y - labelOffset.y }]));
  const movingStructure = preview?.kind === 'structure-move' ? movedStructures.find(item => item.id === preview.id) : undefined;
  const movingPosition = preview?.point ?? (movingStructure ? structureCenter(movingStructure) : undefined);
  function constrainedEnd(start: Point, end: Point): Point {
    if (drawTool !== 'segment' || wallDrawing || lineConstraint === 'free') return end;
    const dx = Math.abs((end.x - start.x) * width), dy = Math.abs((end.y - start.y) * height);
    if (lineConstraint === 'horizontal' || lineConstraint === 'snap' && dy < dx * .14) return { x: end.x, y: start.y };
    if (lineConstraint === 'vertical' || lineConstraint === 'snap' && dx < dy * .14) return { x: start.x, y: end.y };
    return end;
  }
  function finishOutline() {
    if (outlineDraft.length < 3) { setGestureHint('세 점 이상을 찍어 윤곽을 만들어 주세요.'); return; }
    if (onDrawPolygon?.(outlineDraft)) { setOutlineDraft([]); setGestureHint('윤곽을 저장했습니다.'); }
  }

  function svgPosition(event: { clientX: number; clientY: number }): Point | null {
    const matrix = contentRef.current?.getScreenCTM();
    if (!matrix) return null;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return { x: point.x / width, y: point.y / height };
  }

  function handleCanvasClick(event: MouseEvent<SVGSVGElement>) {
    if (drawTool === 'polygon') {
      const point = svgPosition(event);
      if (!point || point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) return;
      if (outlineDraft.length >= 3 && Math.hypot((point.x - outlineDraft[0].x) * width, (point.y - outlineDraft[0].y) * height) * contentPixelScale < 12) { finishOutline(); return; }
      if (outlineDraft.length >= 100) { setGestureHint('윤곽은 최대 100점까지 표시할 수 있습니다.'); return; }
      setOutlineRedo([]); setOutlineDraft([...outlineDraft, point]); event.currentTarget.focus({ preventScroll: true }); return;
    }
    if (drawTool) return;
    if (mode !== 'place') return;
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    const target = event.target;
    if (target !== event.currentTarget && !(target instanceof SVGElement && (
      target.classList.contains('plan-canvas__backdrop') ||
      target.classList.contains('plan-canvas__floor') ||
      target.classList.contains('plan-canvas__image')
    ))) return;
    placeAtPointer(event);
  }

  function placeAtPointer(event: MouseEvent<SVGElement>) {
    const point = svgPosition(event);
    if (!point || point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) return;
    onPlacePoint?.(point.x, point.y);
  }

  function handleDrawStart(event: PointerEvent<SVGSVGElement>) {
    if (!drawTool || drawTool === 'polygon' || !onDraw || event.button !== 0) return;
    const position = svgPosition(event);
    if (!position || position.x < 0 || position.x > 1 || position.y < 0 || position.y > 1) return;
    let start = position;
    let wallId: string | undefined;
    if (wallDrawing) {
      const hit = wallNearPointer(position, activePlan.structures, width, height, contentPixelScale);
      if (!hit) { setGestureHint('이 구조는 벽에 붙여 그립니다. 이름이 표시된 벽의 선 위에서 드래그를 시작해 주세요.'); return; }
      wallId = hit.wall.id;
      start = hit.point;
      onDrawWallSelect?.(wallId);
    }
    setGestureHint(null);
    const draft = { pointerId: event.pointerId, start, end: start, wallId, clientStart: { x: event.clientX, y: event.clientY } };
    drawRef.current = draft;
    setDrawDraft(draft);
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function handleDrawMove(event: PointerEvent<SVGSVGElement>) {
    const draft = drawRef.current;
    if (!drawTool || !draft || draft.pointerId !== event.pointerId) return false;
    const position = svgPosition(event);
    if (!position) return true;
    const wall = draft.wallId && activePlan.structures.find((item) => item.id === draft.wallId);
    const end = wall ? projectOntoWall(position, wall, width, height)?.point ?? draft.end : { x: clamp(position.x, 0, 1), y: clamp(position.y, 0, 1) };
    const next = { ...draft, end: constrainedEnd(draft.start, end) };
    drawRef.current = next;
    setDrawDraft(next);
    return true;
  }

  function handleDrawEnd(event: PointerEvent<SVGSVGElement>) {
    const draft = drawRef.current;
    if (!drawTool || !draft || draft.pointerId !== event.pointerId) return false;
    drawRef.current = null;
    setDrawDraft(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (event.type !== 'pointercancel') {
      const position = svgPosition(event);
      const wall = draft.wallId && activePlan.structures.find((item) => item.id === draft.wallId);
      const end = position ? wall ? projectOntoWall(position, wall, width, height)?.point ?? draft.end : { x: clamp(position.x, 0, 1), y: clamp(position.y, 0, 1) } : draft.end;
      if (drawTool !== 'point' && Math.hypot(event.clientX - draft.clientStart.x, event.clientY - draft.clientStart.y) < 4) {
        setGestureHint(wall ? `${wall.name}을 연결 벽으로 선택했습니다. 이 벽의 선을 누른 채 끌어 길이를 정해 주세요.` : '클릭만으로는 선이나 영역이 추가되지 않습니다. 마우스를 누른 채 원하는 끝 위치까지 끌어 주세요.');
        return true;
      }
      onDraw?.(draft.start, drawTool === 'point' ? draft.start : constrainedEnd(draft.start, end), draft.wallId);
    }
    return true;
  }

  function handleStructureSelect(structure: Structure) {
    if (wallDrawing && structure.kind === 'wall') onDrawWallSelect?.(structure.id);
    else if (mode === 'place' && structure.kind === 'wall' && onWallSelect && (wallAttachmentMode || !movableStructures.some((item) => item.id === structure.id))) onWallSelect(structure.id);
    else onStructureSelect?.(structure.id);
  }

  function handleStructureKeyDown(event: KeyboardEvent<SVGGElement>, structure: Structure) {
    if (!drawTool && !(wallAttachmentMode && structure.kind === 'wall') && movableStructures.some((item) => item.id === structure.id) && onStructureMove && mode !== 'camera') {
      const step = event.shiftKey ? 0.05 : 0.01;
      const offsets: Record<string, Point> = {
        ArrowLeft: { x: -step, y: 0 }, ArrowRight: { x: step, y: 0 },
        ArrowUp: { x: 0, y: -step }, ArrowDown: { x: 0, y: step },
      };
      const offset = offsets[event.key];
      if (offset) {
        event.preventDefault();
        event.stopPropagation();
        onStructureMove(structure.id, offset);
        return;
      }
    }
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    event.stopPropagation();
    handleStructureSelect(structure);
  }

  function startStructureDrag(event: PointerEvent<SVGGElement>, structure: Structure) {
    const pointer = svgPosition(event);
    if (!pointer) return;
    startDrag(event, 'structure-move', structure.id, undefined, undefined, {
      pointer,
    });
  }

  function startDrag(event: PointerEvent<SVGGElement>, kind: DragKind, id: string, center?: Point, wall?: WallDrag, structure?: StructureDrag) {
    if (event.button !== 0) return;
    event.stopPropagation();
    const pointer = kind === 'element-move' || kind === 'camera-move' ? svgPosition(event) : null;
    dragRef.current = {
      kind, id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
      moved: false, center, wall, structure,
      pointerOffset: pointer && center ? { x: center.x - pointer.x, y: center.y - pointer.y } : undefined,
    };
    dragEventRef.current?.('start', kind, id);
    svgRef.current?.focus({ preventScroll: true });
    svgRef.current?.setPointerCapture(event.pointerId);
    if (kind.startsWith('element') || kind === 'wall-element-move') onElementSelect?.(id);
    if (kind.startsWith('camera')) onCameraSelect?.(id);
    if (kind === 'structure-move') onStructureSelect?.(id);
    event.preventDefault();
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    if (handleDrawMove(event)) return;
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 3) return;
    if (!drag.moved && mode === 'mapping' && drag.id && !mappingSelectedIds.includes(drag.id)) onMappingSelect?.(drag.id, false);
    drag.moved = true;
    const point = svgPosition(event);
    if (!point || !drag.id) return;
    let next: Preview;
    if (drag.kind === 'structure-move') {
      if (!drag.structure) return;
      const { pointer } = drag.structure;
      next = {
        kind: drag.kind, id: drag.id,
        structure: { x: point.x - pointer.x, y: point.y - pointer.y },
      };
    } else if (drag.kind === 'wall-element-move') {
      if (!drag.wall) return;
      const current = activePlan.structures.find(item => item.id === drag.wall!.wallId);
      const adjacent = current && adjacentWallAtPointer(point, current, activePlan.structures, width, height, contentPixelScale, drag.wall.spanPixels);
      if (adjacent?.geometry.kind === 'segment') {
        const length = Math.hypot((adjacent.geometry.end.x - adjacent.geometry.start.x) * width, (adjacent.geometry.end.y - adjacent.geometry.start.y) * height);
        const span = drag.wall.spanPixels / length;
        drag.wall = { wallId: adjacent.id, start: 0, end: span, pointerOffset: 0, spanPixels: drag.wall.spanPixels, geometry: adjacent.geometry };
        setGestureHint(`${adjacent.name}을 따라 이동 중입니다.`);
      }
      const wall = drag.wall;
      const span = wall.end - wall.start;
      const midpoint = fractionOnSegment(point, wall.geometry.start, wall.geometry.end, width, height) + wall.pointerOffset;
      const start = clamp(midpoint - span / 2, 0, 1 - span);
      next = { kind: drag.kind, id: drag.id, wall: { wallId: wall.wallId, start, end: start + span } };
    } else if (drag.kind.endsWith('move')) {
      next = { kind: drag.kind, id: drag.id, point: {
        x: clamp(point.x + (drag.pointerOffset?.x ?? 0), 0, 1),
        y: clamp(point.y + (drag.pointerOffset?.y ?? 0), 0, 1),
      } };
    } else {
      if (!drag.center) return;
      const dx = (point.x - drag.center.x) * width;
      const dy = (point.y - drag.center.y) * height;
      next = { kind: drag.kind, id: drag.id, degrees: normalDegrees(Math.atan2(dy, dx) * 180 / Math.PI) };
    }
    previewRef.current = next;
    setPreview(next);
  }

  function handlePointerEnd(event: PointerEvent<SVGSVGElement>) {
    if (handleDrawEnd(event)) return;
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    const last = previewRef.current;
    previewRef.current = null;
    setPreview(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (drag.id) dragEventRef.current?.(event.type === 'pointercancel' || !drag.moved || !last ? 'cancel' : 'end', drag.kind, drag.id);
    if (!drag.moved) {
      if (mode === 'mapping' && drag.id && event.type === 'pointerup') {
        onMappingSelect?.(drag.id, event.shiftKey);
        suppressClickRef.current = true;
        window.setTimeout(() => { suppressClickRef.current = false; }, 0);
      }
      return;
    }
    suppressClickRef.current = true;
    window.setTimeout(() => { suppressClickRef.current = false; }, 0);
    if (event.type === 'pointercancel' || !last || last.id !== drag.id || last.kind !== drag.kind) return;
    if (last.kind === 'element-move' && last.point) onElementMove?.(last.id, last.point.x, last.point.y);
    if (last.kind === 'element-rotate' && last.degrees !== undefined) onElementRotate?.(last.id, last.degrees);
    if (last.kind === 'wall-element-move' && last.wall) onWallElementMove?.(last.id, last.wall.wallId, last.wall.start, last.wall.end);
    if (last.kind === 'structure-move' && last.structure) onStructureMove?.(last.id, last.structure);
    if (last.kind === 'camera-move' && last.point) onCameraMove?.(last.id, last.point.x, last.point.y);
    if (last.kind === 'camera-rotate' && last.degrees !== undefined) onCameraRotate?.(last.id, last.degrees);
  }

  function cancelGesture() {
    const drag = dragRef.current;
    if (drag?.id) dragEventRef.current?.('cancel', drag.kind, drag.id);
    // Clear before releasing capture so lostcapture cannot recursively cancel.
    dragRef.current = null;
    const pointerId = drawRef.current?.pointerId ?? drag?.pointerId;
    drawRef.current = null;
    previewRef.current = null;
    if (pointerId !== undefined && svgRef.current?.hasPointerCapture(pointerId)) svgRef.current.releasePointerCapture(pointerId);
    setDrawDraft(null);
    setPreview(null);
  }

  function handleMoveKeyDown(event: KeyboardEvent<SVGGElement>, owner: 'element' | 'camera', id: string, point: Point) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      if (owner === 'element') onElementSelect?.(id);
      else onCameraSelect?.(id);
      return;
    }
    const step = event.shiftKey ? 0.05 : 0.01;
    const offsets: Record<string, Point> = {
      ArrowLeft: { x: -step, y: 0 }, ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step }, ArrowDown: { x: 0, y: step },
    };
    const offset = offsets[event.key];
    if (!offset) return;
    event.preventDefault();
    event.stopPropagation();
    const x = clamp(point.x + offset.x, 0, 1);
    const y = clamp(point.y + offset.y, 0, 1);
    if (owner === 'element') onElementMove?.(id, x, y);
    else onCameraMove?.(id, x, y);
  }

  function startWallElementDrag(event: PointerEvent<SVGGElement>, element: DesignElement, wall: Structure) {
    const target = element.target;
    if (target?.kind !== 'wall-segment' || wall.geometry.kind !== 'segment') return;
    const pointer = svgPosition(event);
    const midpoint = (target.start + target.end) / 2;
    const projected = pointer ? fractionOnSegment(pointer, wall.geometry.start, wall.geometry.end, width, height) : midpoint;
    startDrag(event, 'wall-element-move', element.id, undefined, {
      wallId: wall.id, start: target.start, end: target.end,
      pointerOffset: midpoint - projected,
      geometry: { start: wall.geometry.start, end: wall.geometry.end },
      spanPixels: (target.end - target.start) * Math.hypot((wall.geometry.end.x - wall.geometry.start.x) * width, (wall.geometry.end.y - wall.geometry.start.y) * height),
    });
  }

  function handleWallElementKeyDown(event: KeyboardEvent<SVGGElement>, element: DesignElement, wall: Structure) {
    const target = element.target;
    if (target?.kind !== 'wall-segment' || wall.geometry.kind !== 'segment') return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      onElementSelect?.(element.id);
      return;
    }
    const dx = (wall.geometry.end.x - wall.geometry.start.x) * width;
    const dy = (wall.geometry.end.y - wall.geometry.start.y) * height;
    const horizontal = Math.abs(dx) >= Math.abs(dy);
    let direction = 0;
    if (horizontal && event.key === 'ArrowLeft') direction = dx >= 0 ? -1 : 1;
    if (horizontal && event.key === 'ArrowRight') direction = dx >= 0 ? 1 : -1;
    if (!horizontal && event.key === 'ArrowUp') direction = dy >= 0 ? -1 : 1;
    if (!horizontal && event.key === 'ArrowDown') direction = dy >= 0 ? 1 : -1;
    if (!direction) return;
    event.preventDefault();
    event.stopPropagation();
    const span = target.end - target.start;
    const start = clamp(target.start + direction * (event.shiftKey ? 0.05 : 0.01), 0, 1 - span);
    onWallElementMove?.(element.id, wall.id, start, start + span);
  }

  function handleRotateKeyDown(event: KeyboardEvent<SVGGElement>, owner: 'element' | 'camera', id: string, currentDegrees: number) {
    let next: number;
    if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = 359;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = normalDegrees(currentDegrees - (event.shiftKey ? 15 : 5));
    else if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = normalDegrees(currentDegrees + (event.shiftKey ? 15 : 5));
    else return;
    event.preventDefault();
    event.stopPropagation();
    if (owner === 'element') onElementRotate?.(id, next);
    else onCameraRotate?.(id, next);
  }

  function renderStructure(structure: Structure, labelsOnly = false) {
    const drawHost = wallDrawing && structure.kind === 'wall' && structure.geometry.kind === 'segment';
    const selected = drawHost ? structure.id === activeDrawWall?.id : structure.id === selectedStructureId;
    const kept = keptIds.has(structure.id);
    const translated = preview?.kind === 'structure-move' && preview.structure
      ? previewStructureTranslation(project, preview.id, preview.structure).find((item) => item.id === structure.id) : undefined;
    const geometry = translated?.geometry ?? structure.geometry;
    const center = structureCenter({ ...structure, geometry });
    const movable = !drawTool && !pointPlacementMode && !(wallAttachmentMode && structure.kind === 'wall') && movableStructures.some((item) => item.id === structure.id)
      && Boolean(onStructureMove) && mode !== 'camera';
    const selectable = pointPlacementMode || drawHost || (!drawTool && (movable || (mode === 'place' && structure.kind === 'wall'
      ? Boolean(onWallSelect || onStructureSelect)
      : Boolean(onStructureSelect))));
    const isOpening = structure.kind === 'window' || structure.kind === 'door' || structure.kind === 'entrance';
    const classes = [
      'plan-structure',
      `plan-structure--${structure.kind}`,
      structure.role === 'partition' ? 'plan-structure--partition' : '',
      structure.immutable ? 'plan-structure--immutable' : '',
      movable ? 'plan-structure--movable' : '',
      drawHost ? 'plan-structure--draw-host' : '',
      selected ? 'plan-structure--selected' : '',
      kept ? 'plan-structure--kept' : '',
      previewBlocked && preview?.id === structure.id ? 'plan-preview-blocked' : '',
    ].filter(Boolean).join(' ');
    let shape;
    if (geometry.kind === 'segment') {
      const x1 = geometry.start.x * width;
      const y1 = geometry.start.y * height;
      const x2 = geometry.end.x * width;
      const y2 = geometry.end.y * height;
      shape = <>
        {isOpening ? <PlanSymbol structure={{ ...structure, geometry }} width={width} height={height} /> : <line className="plan-structure__shape" x1={x1} y1={y1} x2={x2} y2={y2} />}
        <line className="plan-structure__hit" x1={x1} y1={y1} x2={x2} y2={y2} style={movable || drawHost ? { strokeWidth: 40 / contentPixelScale } : undefined} />
      </>;
    } else if (geometry.kind === 'rect') {
      const { bounds } = geometry;
      shape = <>
        <rect className="plan-structure__shape" x={bounds.x * width} y={bounds.y * height} width={bounds.width * width} height={bounds.height * height} />
        <rect className="plan-structure__hit" x={center.x * width - Math.max(bounds.width * width + 8, movable ? 40 / contentPixelScale : 0) / 2} y={center.y * height - Math.max(bounds.height * height + 8, movable ? 40 / contentPixelScale : 0) / 2} width={Math.max(bounds.width * width + 8, movable ? 40 / contentPixelScale : 0)} height={Math.max(bounds.height * height + 8, movable ? 40 / contentPixelScale : 0)} />
      </>;
    } else {
      shape = <>
        <circle className="plan-structure__shape" cx={geometry.center.x * width} cy={geometry.center.y * height} r={geometry.radius * Math.min(width, height)} />
        <circle className="plan-structure__hit" cx={geometry.center.x * width} cy={geometry.center.y * height} r={Math.max(geometry.radius * Math.min(width, height) + 7, movable ? 20 / contentPixelScale : 0)} />
      </>;
    }
    const packed = labels.get(structure.id);
    const labelName = structure.name.length > 12 ? `${structure.name.slice(0, 11)}…` : structure.name;
    const nameWidth = packed?.width ?? labelName.length * 13 + 50;
    const labelX = (packed?.x ?? center.x * width * contentPixelScale) / contentPixelScale;
    const labelY = (packed?.y ?? center.y * height * contentPixelScale) / contentPixelScale;
    return <g key={structure.id} onMouseEnter={()=>setHoveredId(structure.id)} onMouseLeave={()=>setHoveredId(undefined)} className={labelsOnly ? `plan-label-wrapper${selected ? ' is-selected' : ''}${drawTool ? ' is-read-only' : ''}` : classes}>
    {!labelsOnly && <g
      role={selectable ? 'button' : undefined}
      tabIndex={selectable ? 0 : undefined}
      aria-label={pointPlacementMode ? `${structure.name}, 여기에 요소 배치` : selectable ? `${structure.name}${drawHost ? ', 연결 벽으로 선택, 벽 선을 따라 드래그해 그리기' : movable ? ', 이동 가능한 구조, 끌어서 이동 또는 방향키로 1% 이동' : ', 위치 고정, 선택하여 보존 조건 확인'}${kept ? ', Keep 보존 대상' : ''}` : undefined}
      aria-pressed={selectable ? selected : undefined}
      onClick={selectable ? (event) => { event.stopPropagation(); if (pointPlacementMode) placeAtPointer(event); else if (!suppressClickRef.current) handleStructureSelect(structure); } : undefined}
      onKeyDown={pointPlacementMode ? event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();onPlacePoint?.(center.x,center.y)}} : selectable ? (event) => handleStructureKeyDown(event, structure) : undefined}
      onPointerDown={pointPlacementMode ? event=>event.stopPropagation() : movable ? (event) => startStructureDrag(event, structure) : undefined}
    >
      <title>{`${structure.name}${kept ? ' · Keep' : ''}`}</title>
      {shape}
      {structure.kind === 'existing-light' && <LayoutSymbol kind="light" x={center.x*width} y={center.y*height} width={28} height={28} />}
    </g>}
      {labelsOnly && quietLabels && !packed && kept && !drawTool && !pointPlacementMode && mode!=='camera' && <g className="plan-lock-toggle is-kept" transform={`translate(${center.x*width} ${center.y*height}) scale(${1/contentPixelScale})`} role={onStructureLockToggle?'button':undefined} tabIndex={onStructureLockToggle?0:undefined} aria-label={`${structure.name} 필수 보존 끄기`} onPointerDown={event=>event.stopPropagation()} onClick={event=>{event.stopPropagation();onStructureLockToggle?.(structure.id)}} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();onStructureLockToggle?.(structure.id)}}}><title>{structure.name} · 위치 고정</title><rect x={-14} y={-14} width={28} height={28} rx={6} /><image href="/icons/nucleo/IconLockOutline18.svg" x={-7} y={-7} width={14} height={14} /></g>}
      {labelsOnly && !drawHost && packed && <>
        <g className={movable ? 'plan-structure__move-label' : `plan-keep-label${kept ? ' is-kept' : ''}`} transform={`translate(${labelX} ${labelY}) scale(${1 / contentPixelScale})`}
          style={drawTool ? { pointerEvents: 'none' } : undefined} role={selectable ? 'button' : undefined} tabIndex={selectable ? 0 : undefined} aria-label={`${structure.name}${movable ? ' · 이동 가능' : ''}`}
          onPointerDown={movable ? event => startStructureDrag(event, structure) : event => event.stopPropagation()}
          onClick={selectable ? event => { event.stopPropagation(); if (!suppressClickRef.current) handleStructureSelect(structure); } : undefined}
          onKeyDown={selectable ? event => handleStructureKeyDown(event, structure) : undefined}>
          <title>{structure.name}</title><rect className="plan-label-hit" x={-nameWidth / 2} y={-20} width={nameWidth} height={40} rx={8} /><rect className="plan-label-surface" x={-nameWidth / 2} y={-14} width={nameWidth} height={28} rx={4} />
          <>{kept && (!onStructureLockToggle || drawTool) && <image href="/icons/nucleo/IconLockOutline18.svg" x={-nameWidth / 2 + 8} y={-9} width={18} height={18} aria-hidden="true" />}</><text x={kept || onStructureLockToggle && !drawTool ? 18 : 0} y={5} textAnchor="middle">{labelName}{movable ? ' · 이동 가능' : ''}</text>
        </g>
        {!drawTool && onStructureLockToggle && <g className={`plan-lock-toggle${kept ? ' is-kept' : ''}`} transform={`translate(${labelX - (nameWidth / 2 - 20) / contentPixelScale} ${labelY}) scale(${1 / contentPixelScale})`}
          role="button" tabIndex={0} aria-pressed={kept} aria-label={`${structure.name} 필수 보존 ${kept ? '끄기' : '켜기'}`}
          onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); onStructureLockToggle(structure.id); }}
          onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); onStructureLockToggle(structure.id); } }}>
          <title>{kept ? '필수 보존 끄기' : '필수 보존 켜기'}</title><rect x={-20} y={-20} width={40} height={40} rx={8} />
          <image href={kept ? '/icons/nucleo/IconLockOutline18.svg' : '/icons/user-provided/open-lock.svg'} x={-9} y={-9} width={18} height={18} aria-hidden="true" />
        </g>}
      </>}

    </g>;
  }

  function renderDrawWallLabel(wall: Structure) {
    const center = structureCenter(wall);
    const selected = activeDrawWall?.id === wall.id;
    const horizontal = wall.geometry.kind === 'segment' && Math.abs(wall.geometry.end.x - wall.geometry.start.x) * width >= Math.abs(wall.geometry.end.y - wall.geometry.start.y) * height;
    const offset = 24 / contentPixelScale;
    const label = wall.name;
    const kept = keptIds.has(wall.id);
    const labelWidth = label.length * 13 + (kept ? 42 : 20);
    const x = clamp(center.x * width + (horizontal ? 0 : center.x < .5 ? offset : -offset), (labelWidth / 2 + 4) / contentPixelScale, width - (labelWidth / 2 + 4) / contentPixelScale);
    const y = clamp(center.y * height + (horizontal ? center.y < .2 ? offset : -offset : 0), 20 / contentPixelScale, height - 20 / contentPixelScale);
    return <g key={`${wall.id}-name`} className={`plan-wall-label${selected ? ' plan-wall-label--selected' : ''}`}
      transform={`translate(${x} ${y}) scale(${1 / contentPixelScale})`} role="button" tabIndex={0}
      aria-label={`${wall.name}을 연결 벽으로 선택`} aria-pressed={selected}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => { event.stopPropagation(); onDrawWallSelect?.(wall.id); setGestureHint(`${wall.name}을 선택했습니다. 이 벽의 선을 누른 채 끌어 길이를 정해 주세요.`); }}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); onDrawWallSelect?.(wall.id); } }}>
      <rect className="plan-wall-label__hit" x={-labelWidth / 2} y={-20} width={labelWidth} height={40} rx={8} />
      <rect x={-labelWidth / 2} y={-14} width={labelWidth} height={28} rx={8} />
      {kept && <image href="/icons/nucleo/IconLockOutline18.svg" x={-labelWidth / 2 + 8} y={-9} width={18} height={18} aria-hidden="true" />}
      <text textAnchor="middle" x={kept ? 10 : 0} y={5}>{label}</text>
    </g>;
  }

  function renderElement(element: DesignElement, index: number) {
    const target = preview?.kind === 'element-move' && preview.id === element.id && preview.point ? translatedElementTarget(project, element.id, preview.point) ?? element.target : element.target;
    if (!target) return null;
    const selected = mode === 'place' && element.id === selectedElementId || mode === 'mapping' && mappingSelectedIds.includes(element.id);
    // Scope conditions are not separate physical objects: focus one instead of stacking every outline.
    if (['whole-space', 'named-area', 'ceiling-zone', 'floor-area'].includes(target.kind) && !isCountedLayoutItem(element) && !selected) return null;
    const supportPicking = mode === 'place' && Boolean(onSupportSelect) && (supportPlacementMode || project.elements.find(item => item.id === selectedElementId)?.kind === 'display-product') && isDisplaySupport(element);
    const editable = mode === 'place' && target.kind === 'floor-point' && Boolean(onElementMove) && !pointPlacementMode && !supportPicking && !element.locked;
    const classes = `plan-element${pointPlacementMode ? ' plan-element--point-placement' : ''}${supportPicking ? ' plan-element--support-picking' : ''}${selected ? ' plan-element--selected' : ''}${editable ? ' plan-element--editable' : ''}${previewBlocked && preview?.id === element.id ? ' plan-preview-blocked' : ''}`;
    const number = index + 1;
    if (target.kind === 'floor-point') {
      const footprint = target.footprint ?? { width: 0.06, height: 0.06 };
      const dragPreview = preview?.kind === 'element-move' && preview.id === element.id ? preview.point : undefined;
      const rotatePreview = preview?.kind === 'element-rotate' && preview.id === element.id ? preview.degrees : undefined;
      const position = dragPreview ?? { x: target.x, y: target.y };
      const degrees = rotatePreview ?? target.rotationDegrees ?? 0;
      const x = position.x * width;
      const y = position.y * height;
      const radians = degrees * Math.PI / 180;
      const handleDistance = Math.max(58, footprint.width * width / 2 + 34, footprint.height * height / 2 + 34);
      const handleX = x + Math.cos(radians) * handleDistance;
      const handleY = y + Math.sin(radians) * handleDistance;
      return <g className={classes} key={element.id} data-element-id={element.id} onMouseEnter={() => setHoveredId(element.id)} onMouseLeave={() => setHoveredId(undefined)} role={editable || supportPicking || mode==='place' ? 'button' : undefined} tabIndex={editable || supportPicking || mode==='place' ? 0 : undefined}
        aria-label={`${element.label}${supportPicking ? ', 이 진열대 위에 제품 연결' : ', 바닥 요소'}${editable ? ', 끌어서 이동, 방향키로 1% 이동' : ''}`}
        aria-pressed={editable ? selected : undefined}
        onPointerDown={pointPlacementMode || supportPicking ? event => event.stopPropagation() : editable ? (event) => startDrag(event, 'element-move', element.id, position) : undefined}
        onKeyDown={pointPlacementMode ? event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();onPlacePoint?.(target.x,target.y)}} : supportPicking ? event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); onSupportSelect?.(element.id); } } : mode==='place' && element.locked ? event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onElementSelect?.(element.id)}} : editable ? (event) => handleMoveKeyDown(event, 'element', element.id, { x: target.x, y: target.y }) : undefined}
        onClick={pointPlacementMode ? event=>{event.stopPropagation();placeAtPointer(event)} : supportPicking ? event => { event.stopPropagation(); onSupportSelect?.(element.id); } : mode==='place' && element.locked ? event=>{event.stopPropagation();onElementSelect?.(element.id)} : editable ? (event) => event.stopPropagation() : undefined}>
        <title>{element.label}</title>
        <rect className="plan-element__footprint" data-constraint-id={!preview ? element.id : undefined} x={x - footprint.width * width / 2} y={y - footprint.height * height / 2} width={footprint.width * width} height={footprint.height * height} rx={Math.min(14, footprint.height * height / 4)} transform={`rotate(${degrees} ${x} ${y})`} />
        <g transform={`rotate(${degrees} ${x} ${y})`} style={{ pointerEvents: 'none' }}><LayoutSymbol kind={layoutKindFor(element)} x={x} y={y} width={footprint.width * width} height={footprint.height * height} /></g>
        {selected && editable && <g className="plan-rotation-handle" role="slider" tabIndex={0}
          aria-label={`${element.label} 회전 각도`} aria-valuemin={0} aria-valuemax={359} aria-valuenow={degrees}
          onPointerDown={(event) => startDrag(event, 'element-rotate', element.id, position)}
          onKeyDown={(event) => handleRotateKeyDown(event, 'element', element.id, target.rotationDegrees ?? 0)}
          onClick={(event) => event.stopPropagation()}>
          <line x1={x} y1={y} x2={handleX} y2={handleY} />
          <rect x={handleX - 22} y={handleY - 12} width={44} height={24} rx={12} />
          <text x={handleX} y={handleY + 4} textAnchor="middle">회전</text>
        </g>}
      </g>;
    }
    if(target.kind==='ceiling-zone' && isCountedLayoutItem(element)) {
      const zone=plan!.areas.find(area=>area.id===target.zoneId);if(!zone)return null;
      const x=(zone.bounds.x+zone.bounds.width*(target.offset?.x??.5))*width,y=(zone.bounds.y+zone.bounds.height*(target.offset?.y??.5))*height;
      return <g className={classes} key={element.id} data-element-id={element.id} role={onElementSelect&&!supportPlacementMode?'button':undefined} tabIndex={onElementSelect&&!supportPlacementMode?0:undefined} style={{pointerEvents:supportPlacementMode?'none':undefined}} aria-label={`${element.label}, 천장 요소`} onMouseEnter={()=>setHoveredId(element.id)} onMouseLeave={()=>setHoveredId(undefined)} onPointerDown={event=>event.stopPropagation()} onClick={event=>{event.stopPropagation();if(pointPlacementMode)placeAtPointer(event);else onElementSelect?.(element.id)}} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();if(pointPlacementMode)onPlacePoint?.(x/width,y/height);else onElementSelect?.(element.id)}}}><title>{element.label}</title><LayoutSymbol kind={layoutKindFor(element)} x={x} y={y} width={30/contentPixelScale} height={30/contentPixelScale} /></g>;
    }
    if (target.kind === 'fixture-surface') {
      const host = project.elements.find(item => item.id === target.fixtureElementId);
      const hostPreview = host && preview?.id === host.id && host.target?.kind === 'floor-point'
        ? { ...host, target: { ...host.target, ...(preview.point ? preview.point : {}), ...(preview.degrees !== undefined ? { rotationDegrees: preview.degrees } : {}) } } : host;
      const point = displayPosition(hostPreview ? { ...project, elements: project.elements.map(item => item.id === hostPreview.id ? hostPreview : item) } : project, { ...element, target });
      if (!point) return null;
      return <g key={element.id} data-element-id={element.id} className={`${classes} plan-element--product`} role={mode === 'place' ? 'button' : undefined} tabIndex={mode === 'place' ? 0 : undefined}
        aria-label={`${element.label}, ${host?.label ?? '진열대'} 위`} onPointerDown={event => event.stopPropagation()}
        onClick={event => { event.stopPropagation(); if (pointPlacementMode) placeAtPointer(event); else if (supportPlacementMode) onSupportSelect?.(target.fixtureElementId); else onElementSelect?.(element.id); }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); if (pointPlacementMode) onPlacePoint?.(point.x, point.y); else if (supportPlacementMode) onSupportSelect?.(target.fixtureElementId); else onElementSelect?.(element.id); } }}>
        <title>{`${element.label} · 진열 상품 · ${host?.label} 위`}</title><g transform={`translate(${point.x * width} ${point.y * height}) scale(${1 / contentPixelScale})`}><rect x={-17} y={-17} width={34} height={34} rx={8} /><LayoutSymbol kind="product" width={24} height={24} />{selected && <text className="plan-product-label" x={0} y={-25} textAnchor="middle">진열 상품</text>}</g>
      </g>;
    }
    if (target.kind === 'wall-segment') {
      const moving = preview?.kind === 'wall-element-move' && preview.id === element.id ? preview.wall : undefined;
      const wall = activePlan.structures.find((structure) => structure.id === (moving?.wallId ?? target.wallId) && structure.geometry.kind === 'segment');
      if (!wall || wall.geometry.kind !== 'segment') return null;
      const wallPreview = preview?.kind === 'wall-element-move' && preview.id === element.id && preview.wall?.wallId === wall.id
        ? preview.wall : undefined;
      const startFraction = wallPreview?.start ?? target.start;
      const endFraction = wallPreview?.end ?? target.end;
      const start = pointOnSegment(wall.geometry.start, wall.geometry.end, startFraction);
      const end = pointOnSegment(wall.geometry.start, wall.geometry.end, endFraction);
      const middle = pointOnSegment(start, end, 0.5);
      const partition = wall.role === 'partition';
      const faceLine = partition && target.face ? wallFaceLine(wall, startFraction, endFraction, target.face, width, height) : null;
      const wallEditable = mode === 'place' && Boolean(onWallElementMove) && !element.locked;
      return <g className={`${classes}${wallEditable ? ' plan-element--wall-editable' : ''}`} key={element.id} data-element-id={element.id} aria-label={`${element.label}, ${wall.name}${partition ? `, ${target.face ? wallFaceLabel(project, wall.id, target.face) : '붙일 면 미지정'}` : ''}`}>
        <title>{`${element.label} · ${wall.name}${partition ? ` · ${target.face ? wallFaceLabel(project, wall.id, target.face) : '붙일 면 미지정'}` : ''}`}</title>
        <g className="plan-element__wall-drag" role={wallEditable ? 'button' : undefined} tabIndex={wallEditable ? 0 : undefined}
          aria-label={`${element.label}, ${wall.name}${partition ? `, ${target.face ? wallFaceLabel(project, wall.id, target.face) : '붙일 면 미지정'}` : ''}${wallEditable ? ', 벽을 따라 끌어서 이동, 방향키로 1% 이동' : ''}`}
          aria-pressed={wallEditable ? selected : undefined}
          onPointerDown={wallEditable ? (event) => startWallElementDrag(event, element, wall) : undefined}
          onKeyDown={wallEditable ? (event) => handleWallElementKeyDown(event, element, wall) : undefined}
          onClick={wallEditable ? (event) => event.stopPropagation() : undefined}>
          <line className="plan-element__wall" x1={faceLine?.start.x ?? start.x * width} y1={faceLine?.start.y ?? start.y * height} x2={faceLine?.end.x ?? end.x * width} y2={faceLine?.end.y ?? end.y * height} />
        </g>
        {selected && wallEditable && <text className="plan-element__wall-hint" x={middle.x * width} y={middle.y * height + (middle.y > 0.75 ? -35 : 52)} textAnchor="middle" aria-hidden="true">벽 따라 이동</text>}
      </g>;
    }
    const boundsList = target.kind === 'whole-space'
      ? floorAreas.length ? floorAreas.map((area) => area.bounds) : [{ x: 0, y: 0, width: 1, height: 1 }]
      : target.kind === 'floor-area' || target.kind === 'named-area'
        ? [areaBounds(activePlan, target.areaId)]
        : [areaBounds(activePlan, target.zoneId)];
    const visibleBounds = boundsList.filter((bounds) => bounds !== undefined);
    if (!visibleBounds.length) return null;
    const labelBounds = visibleBounds[0];
    return <g className={`${classes} plan-element--area`} key={element.id} data-element-id={element.id} onMouseEnter={()=>setHoveredId(element.id)} onMouseLeave={()=>setHoveredId(undefined)} aria-label={`${element.label}, 영역 적용`} role={supportPicking?'button':undefined} tabIndex={supportPicking?0:undefined} onClick={supportPicking?event=>{event.stopPropagation();onSupportSelect?.(element.id)}:pointPlacementMode?event=>{event.stopPropagation();placeAtPointer(event)}:undefined} onKeyDown={supportPicking?event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();onSupportSelect?.(element.id)}}:undefined}>
      <title>{element.label}</title>
      {visibleBounds.map((bounds, boundsIndex) => { const area = target.kind === 'whole-space' ? floorAreas[boundsIndex] : activePlan.areas.find(item => item.id === (target.kind === 'floor-area' || target.kind === 'named-area' ? target.areaId : target.zoneId)); return area?.outline ? <polygon key={boundsIndex} className="plan-element__area" points={area.outline.map(p => `${p.x * width},${p.y * height}`).join(' ')} /> : <rect key={boundsIndex} className="plan-element__area" x={bounds.x * width + 9} y={bounds.y * height + 9} width={Math.max(0, bounds.width * width - 18)} height={Math.max(0, bounds.height * height - 18)} rx={8} />; })}
      <circle className="plan-element__number-bg" cx={labelBounds.x * width + 30} cy={labelBounds.y * height + 30} r={14} />
      <text className="plan-element__number" x={labelBounds.x * width + 30} y={labelBounds.y * height + 35} textAnchor="middle">{number}</text>
    </g>;
  }

  function renderMappingTarget(id: string, name: string, geometry: React.ReactNode) {
    const linked = project.referenceBindings?.some(binding => binding.layoutItemIds.includes(id));
    const element = project.elements.find(item => item.id === id);
    const point = element && elementPlanPosition(project, element);
    const movable = !!onElementMove && !element?.locked && ['floor-point', 'ceiling-zone', 'fixture-surface'].includes(element?.target?.kind ?? '');
    const wallId = element?.target?.kind === 'wall-segment' ? element.target.wallId : undefined;
    const wall = plan!.structures.find(item => item.id === wallId);
    const wallMovable = !!onWallElementMove && !!wall && !element?.locked;
    return <g key={id} data-mapping-target={id} className={`mapping-target ${mappingSelectedIds.includes(id) ? 'is-selected' : ''} ${dropTarget===id ? 'is-drop-target' : ''} ${linked ? 'is-linked' : ''}`} role="button" tabIndex={0} aria-label={`${name} 매핑 대상${linked ? ', 연결됨' : ''}`} aria-pressed={mappingSelectedIds.includes(id)}
      onMouseEnter={()=>setHoveredId(id.replace(/^wall:/,''))} onMouseLeave={()=>setHoveredId(undefined)}
      onPointerDown={event=>{event.stopPropagation();if(event.shiftKey){event.preventDefault();return;}if(movable&&point)startDrag(event,'element-move',id,point);else if(wallMovable&&element)startWallElementDrag(event,element,wall);}}
      onClick={event=>{event.stopPropagation();if(!suppressClickRef.current)onMappingSelect?.(id,event.shiftKey)}}
      onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();onMappingSelect?.(id,event.shiftKey)}else if(movable&&point)handleMoveKeyDown(event,'element',id,point)}}
      onDragOver={event=>{if(event.dataTransfer.types.includes(REFERENCE_DRAG_TYPE)){event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect='copy';setDropTarget(id)}}}
      onDragLeave={()=>setDropTarget(undefined)} onDrop={event=>{event.preventDefault();event.stopPropagation();setDropTarget(undefined);try {const input=JSON.parse(event.dataTransfer.getData(REFERENCE_DRAG_TYPE));if(typeof input.referenceId==='string')onReferenceDrop?.(id,input.referenceId,input.region)} catch {setGestureHint('이미지를 다시 끌어 적용하세요.')}}}>{geometry}</g>;
  }
  function attachmentMarkers() {
    return wallFaceMarkers.map(({ wall, face, point }) => {
      const editable = !!onWallFaceSelect && (mode === 'place' && attachmentWallId === wall.id || mode === 'mapping' && mappingSelectedIds.includes(`wall:${wall.id}`));
      const activeFace = attachmentWallId === wall.id || mode === 'mapping' ? selectedWallFace : savedWallTarget?.face;
      return <g key={`${wall.id}-${face}`} className={`plan-wall-face-marker${editable ? ' is-interactive' : ''}${activeFace === face ? ' is-active' : ''}`}
        transform={`translate(${point.x} ${point.y}) scale(${1 / contentPixelScale})`}
        role={editable ? 'button' : undefined} tabIndex={editable ? 0 : undefined} aria-hidden={editable ? undefined : true}
        aria-label={editable ? `${wallFaceLabel(project, wall.id, face)} 선택` : undefined} aria-pressed={editable ? activeFace === face : undefined}
        data-wall-face={face} data-wall-id={wall.id}
        onPointerDown={editable ? event => event.stopPropagation() : undefined}
        onClick={editable ? event => { event.stopPropagation(); onWallFaceSelect?.(wall.id, face); } : undefined}
        onKeyDown={editable ? event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); onWallFaceSelect?.(wall.id, face); } } : undefined}>
        <title>{wallFaceLabel(project, wall.id, face)}</title>
        {editable && <rect className="plan-wall-face-marker__hit" x={-20} y={-20} width={40} height={40} />}
        <circle r={12} /><text y={5} textAnchor="middle">{face.toUpperCase()}</text>
        {editable && <circle className="plan-wall-face-marker__focus" r={16} />}
      </g>;
    });
  }
  function mappingTargets() {
    return <g className="mapping-targets">
      {visibleAreas.filter(area=>area.kind!=='passage').map(area=>renderMappingTarget(`area:${area.id}`,area.name,area.outline ? <polygon points={area.outline.map(p=>`${p.x*width},${p.y*height}`).join(' ')} /> : <rect x={area.bounds.x*width} y={area.bounds.y*height} width={area.bounds.width*width} height={area.bounds.height*height} />))}
      {showStructureLayer&&plan!.structures.filter(item=>item.kind==='wall'&&item.geometry.kind==='segment').map(wall=>wall.geometry.kind==='segment'&&renderMappingTarget(`wall:${wall.id}`,wall.name,<polygon points={(() => { if(wall.geometry.kind!=='segment')return '';const a={x:wall.geometry.start.x*width,y:wall.geometry.start.y*height},b={x:wall.geometry.end.x*width,y:wall.geometry.end.y*height},length=Math.hypot(b.x-a.x,b.y-a.y)||1,offset=8/contentPixelScale,n={x:-(b.y-a.y)/length*offset,y:(b.x-a.x)/length*offset};return `${a.x+n.x},${a.y+n.y} ${b.x+n.x},${b.y+n.y} ${b.x-n.x},${b.y-n.y} ${a.x-n.x},${a.y-n.y}`;})()} />))}

      {visibleElements.filter(isCountedLayoutItem).filter(item=>item.target?.kind==='floor-point'||item.target?.kind==='wall-segment'||item.target?.kind==='fixture-surface'||item.target?.kind==='ceiling-zone').sort((a,b)=>Number(a.target?.kind==='fixture-surface')-Number(b.target?.kind==='fixture-surface')).map(item=>{
        const target=item.target!;const moved=preview?.id===item.id ? preview.point ? translatedElementTarget(project,item.id,preview.point) : preview.wall&&target.kind==='wall-segment'?{...target,...preview.wall}:undefined : undefined;const point=elementPlanPosition(project,moved?{...item,target:moved}:item);if(!point)return null;
        const w=target.kind==='floor-point' ? (target.footprint?.width ?? .06)*width : 36/contentPixelScale;
        const h=target.kind==='floor-point' ? (target.footprint?.height ?? .06)*height : 36/contentPixelScale;
        return renderMappingTarget(item.id,item.label,<rect x={point.x*width-w/2} y={point.y*height-h/2} width={w} height={h} rx={4} transform={`rotate(${target.kind==='floor-point'?target.rotationDegrees??0:0} ${point.x*width} ${point.y*height})`} />);
      })}
    </g>;
  }

  function renderCamera(camera: Project['cameras'][number], index: number) {
    const editable = mode === 'camera' && Boolean(onCameraMove);
    const dragPreview = preview?.kind === 'camera-move' && preview.id === camera.id ? preview.point : undefined;
    const rotatePreview = preview?.kind === 'camera-rotate' && preview.id === camera.id ? preview.degrees : undefined;
    const position = dragPreview ?? { x: camera.x, y: camera.y };
    const degrees = rotatePreview ?? camera.directionDegrees;
    const x = position.x * width;
    const y = position.y * height;
    const angle = degrees * Math.PI / 180;
    const spread = (camera.fovPreset === 'narrow' ? 18 : camera.fovPreset === 'wide' ? 38 : 28) * Math.PI / 180;
    const reach = Math.min(width, height) * 0.29;
    const left = { x: x + Math.cos(angle - spread) * reach, y: y + Math.sin(angle - spread) * reach };
    const right = { x: x + Math.cos(angle + spread) * reach, y: y + Math.sin(angle + spread) * reach };
    const selected = showCameras && (camera.id === selectedCameraId || (!selectedCameraId && camera.primary));
    const displayUnit = 1 / contentPixelScale;
    const bodyWidth = (mode==='camera' ? canvasDisplay.narrow ? 64 : 96 : 36) * displayUnit;
    const bodyHeight = 36 * displayUnit;
    const bodyHitWidth = bodyWidth;
    const bodyHitHeight = 48 * displayUnit;
    const cameraIconSize = 20 * displayUnit;
    const ringRadius = Math.hypot(bodyHitWidth / 2, bodyHitHeight / 2) + 12 * displayUnit;
    const handleDistance = ringRadius + 28 * displayUnit;
    const handleX = x + Math.cos(angle) * handleDistance;
    const handleY = y + Math.sin(angle) * handleDistance;
    const handleWidth = 64 * displayUnit;
    const handleHeight = 36 * displayUnit;
    const handleHitHeight = 48 * displayUnit;
    const handleIconSize = 18 * displayUnit;
    return <g key={camera.id} className={`plan-camera${selected ? ' plan-camera--selected' : ''}${editable ? ' plan-camera--editable' : ''}${previewBlocked && preview?.id === camera.id ? ' plan-preview-blocked' : ''}`}
      aria-label={`${camera.name}, 방향 ${Math.round(degrees)}도`}>
      <title>{`${camera.name} · ${Math.round(degrees)}°`}</title>
      {mode === 'camera' && <><path className="plan-camera__cone" d={`M ${x} ${y} L ${left.x} ${left.y} Q ${x + Math.cos(angle) * reach * 1.1} ${y + Math.sin(angle) * reach * 1.1} ${right.x} ${right.y} Z`} />
      <line className="plan-camera__direction" x1={x} y1={y} x2={x + Math.cos(angle) * 48} y2={y + Math.sin(angle) * 48} /></>}
      <g className="plan-camera__drag" role={editable ? 'button' : undefined} tabIndex={editable ? 0 : undefined}
        aria-label={`${camera.name} 카메라 위치${editable ? ', 이 본체를 끌어서 이동, 방향키로 1% 이동' : ''}`}
        aria-pressed={editable ? selected : undefined}
        onPointerDown={editable ? (event) => startDrag(event, 'camera-move', camera.id, position) : undefined}
        onKeyDown={editable ? (event) => handleMoveKeyDown(event, 'camera', camera.id, { x: camera.x, y: camera.y }) : undefined}
        onClick={editable ? (event) => event.stopPropagation() : undefined}>
        <rect className="plan-camera__hit" x={x - bodyHitWidth / 2} y={y - bodyHitHeight / 2} width={bodyHitWidth} height={bodyHitHeight} rx={8} />
        <rect className="plan-camera__body" x={x - bodyWidth / 2} y={y - bodyHeight / 2} width={bodyWidth} height={bodyHeight} rx={8} />
        <image className="plan-camera__icon" href="/icons/nucleo/IconCameraOutline18.svg"
          x={x - bodyWidth / 2 + 8 * displayUnit} y={y - cameraIconSize / 2}
          width={cameraIconSize} height={cameraIconSize} aria-hidden="true" />
        {mode === 'camera' && <text className="plan-camera__label" x={x + 14 * displayUnit}
          y={y + 5 * displayUnit} textAnchor="middle"
          style={{ fontSize: 14 * displayUnit }}>{canvasDisplay.narrow ? index + 1 : `카메라 ${index + 1}`}</text>}
      </g>
      {selected && editable && <g className="plan-rotation-handle plan-rotation-handle--camera" role="slider" tabIndex={0}
        aria-label={`${camera.name} 시선 회전 손잡이. 이 손잡이나 바깥 링을 끌면 위치는 그대로이고 각도만 바뀝니다.`} aria-valuemin={0} aria-valuemax={359} aria-valuenow={degrees} aria-valuetext={`${degrees}도`}
        onPointerDown={(event) => startDrag(event, 'camera-rotate', camera.id, position)}
        onKeyDown={(event) => handleRotateKeyDown(event, 'camera', camera.id, camera.directionDegrees)}
        onClick={(event) => event.stopPropagation()}>
        <circle className="plan-rotation-handle__track-hit" cx={x} cy={y} r={ringRadius} strokeWidth={12 * displayUnit} />
        <circle className="plan-rotation-handle__track" cx={x} cy={y} r={ringRadius} strokeWidth={2 * displayUnit} />
        <line x1={x + Math.cos(angle) * (bodyWidth / 2 + 1)} y1={y + Math.sin(angle) * (bodyWidth / 2 + 1)} x2={handleX} y2={handleY} />
        <rect className="plan-rotation-handle__hit" x={handleX - handleWidth / 2} y={handleY - handleHitHeight / 2} width={handleWidth} height={handleHitHeight} rx={14} />
        <rect x={handleX - handleWidth / 2} y={handleY - handleHeight / 2} width={handleWidth} height={handleHeight} rx={14} />
        <image className="plan-rotation-handle__icon" href="/icons/nucleo/IconArrowDottedRotateAnticlockwiseOutline18.svg"
          x={handleX - handleWidth / 2 + 8 * displayUnit} y={handleY - handleIconSize / 2}
          width={handleIconSize} height={handleIconSize} aria-hidden="true" />
        <text x={handleX + 14 * displayUnit}
          y={handleY + 5 * displayUnit} textAnchor="middle"
          style={{ fontSize: 14 * displayUnit }}>회전</text>
      </g>}
    </g>;
  }

  return <section className="plan-canvas" aria-label="공간 도면">
    <div className="plan-canvas__toolbar">
      <div className="plan-canvas__status">
        <strong>{plan.kind === 'schematic' ? '개략 도면' : '등록한 도면'}</strong>
        <span>{plan.geometryConfidence === 'schematic' ? '치수 미확인' : '등록된 치수 기준'}</span>
      </div>
      <div className="plan-canvas__controls" aria-label="도면 보기 도구">
        {onUndo && <button type="button" disabled={!canUndo && !outlineDraft.length} onClick={() => { if (outlineDraft.length) { setOutlineRedo(points => [...points, outlineDraft.at(-1)!]); setOutlineDraft(points => points.slice(0, -1)); } else onUndo(); }}>실행 취소</button>}
        {onRedo && <button type="button" disabled={!canRedo && !outlineRedo.length} onClick={() => { if (outlineRedo.length) { setOutlineDraft(points => [...points, outlineRedo.at(-1)!]); setOutlineRedo(points => points.slice(0, -1)); } else onRedo(); }}>다시 실행</button>}
        <button type="button" onClick={() => setZoom((value) => clamp(value - ZOOM_STEP, MIN_ZOOM, MAX_ZOOM))} disabled={zoom <= MIN_ZOOM}>축소</button>
        <span aria-live="polite">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => setZoom((value) => clamp(value + ZOOM_STEP, MIN_ZOOM, MAX_ZOOM))} disabled={zoom >= MAX_ZOOM}>확대</button>
        <button type="button" onClick={() => setZoom(1)}>보기 초기화</button>
      </div>
      <div className="plan-canvas__layer-controls" aria-label="표시 레이어">
        <button type="button" aria-pressed={showStructureLayer} disabled={Boolean(drawTool)} onClick={() => setLayers((current) => ({ ...current, structures: !current.structures }))}>구조 {showStructureLayer ? '표시' : '숨김'}</button>
        {showElements && <button type="button" title="선택한 요소는 숨김 설정과 관계없이 표시됩니다." aria-pressed={layers.elements} onClick={() => setLayers((current) => ({ ...current, elements: !current.elements }))}>요소 {layers.elements ? '표시' : '숨김'}</button>}
        {showCameras && <button type="button" aria-pressed={layers.cameras} onClick={() => setLayers((current) => ({ ...current, cameras: !current.cameras }))}>카메라 {layers.cameras ? '표시' : '숨김'}</button>}
        {showAreas && <PlanAreaControls areas={plan.areas} layers={areaLayers} selectedId={selectedArea?.id} showNames={showAreaNames} dimOthers={dimOtherAreas} linkableIds={linkableAreaIds} onLayersChange={setAreaLayers} onNamesChange={setShowAreaNames} onDimChange={setDimOtherAreas} onSelect={selectArea} />}
      </div>
    </div>
    {plan.kind === 'uploaded' && (imageError || !sourceUri) && <p className="plan-canvas__image-status" role="alert">{imageError ?? '등록한 도면 이미지를 찾을 수 없습니다. 다시 등록해 주세요.'}</p>}
    <div className="plan-canvas__surface">
    {validationMessage && <TimedNotice lifetimeKey={validationMessage} className="plan-canvas__validation" role="alert" closeLabel="도면 안내 닫기" onDismiss={onValidationDismiss}><strong>표시를 저장하지 않았습니다.</strong><p>{validationMessage}</p></TimedNotice>}
      <svg
        ref={svgRef}
        className={`plan-canvas__svg plan-canvas__svg--${mode}${drawTool ? ` plan-canvas__svg--draw-${drawTool}` : ''}`}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        role="group"
        aria-label={`${project.name} 공간 도면. ${plan.kind === 'schematic' ? '치수가 확인되지 않은 개략 도면' : '등록한 도면'}. 보존 구조 ${project.keeps.length}개${showElements ? `, 위치 지정 배치 요소 ${placedObjects.filter(item=>elementPlanPosition(project,item)).length}개, 공간·표면 연출 조건 ${activeElements.filter(item=>!isCountedLayoutItem(item)).length}개${!layers.elements ? ', 요소 숨김 중 · 선택한 요소만 표시' : ''}` : ''}${showCameras ? `, 카메라 ${project.cameras.length}개` : ''}.`}
        aria-describedby={instructionId}
        tabIndex={0}
        onClick={handleCanvasClick}
        onPointerDown={handleDrawStart}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onLostPointerCapture={() => { if (drawRef.current || dragRef.current) cancelGesture(); }}
        onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.stopPropagation(); if (drawRef.current || dragRef.current) cancelGesture(); else if (event.shiftKey && outlineRedo.length) { setOutlineDraft(points => [...points, outlineRedo.at(-1)!]); setOutlineRedo(points => points.slice(0, -1)); } else if (!event.shiftKey && outlineDraft.length) { setOutlineRedo(points => [...points, outlineDraft.at(-1)!]); setOutlineDraft(points => points.slice(0, -1)); } else if (event.shiftKey) onRedo?.(); else onUndo?.(); return; } if (drawTool === 'polygon') { if (event.key === 'Enter') { event.preventDefault(); finishOutline(); } else if (event.key === 'Escape') { event.preventDefault(); setOutlineDraft([]); } else if (event.key === 'Backspace') { event.preventDefault(); setOutlineDraft(points => points.slice(0, -1)); } } if (event.key === 'Escape' && (drawRef.current || dragRef.current)) { event.preventDefault(); cancelGesture(); setGestureHint('그리기를 취소했습니다. 저장된 도면은 그대로 유지됩니다.'); } }}
      >
        <g ref={contentRef} transform={`translate(${width / 2} ${height / 2}) scale(${zoom}) translate(${-width / 2} ${-height / 2})`}>
          <rect className="plan-canvas__backdrop" width={width} height={height} />
          {imageUri && <image className="plan-canvas__image" href={imageUri} x={0} y={0} width={width} height={height} preserveAspectRatio="xMidYMid meet" />}
          {floorAreas.filter(area => !showAreas || areaLayers.floor || area.id === selectedArea?.id).map((area) => area.outline ? <polygon key={area.id} className={`plan-canvas__floor${imageUri ? ' plan-canvas__floor--uploaded' : ''}`} points={area.outline.map(p => `${p.x * width},${p.y * height}`).join(' ')} /> : <rect key={area.id} className={`plan-canvas__floor${imageUri ? ' plan-canvas__floor--uploaded' : ''}`} x={area.bounds.x * width} y={area.bounds.y * height} width={area.bounds.width * width} height={area.bounds.height * height} />)}
          <PlanMovementOverlay project={project} structures={movedStructures} width={width} height={height} unit={1 / contentPixelScale} patternId={movementPatternId} showCameraOccupancy={showCameraOccupancy} showStructureObstacles={!showStructureLayer} showElementOccupancy={!showElements || !layers.elements || Boolean(preview)} ignoredElementId={preview?.kind === 'element-move' || preview?.kind === 'element-rotate' ? preview.id : undefined} />
          {visibleAreas.filter(area => area.kind !== 'passage' && (area.kind !== 'floor' || area.id === selectedArea?.id)).map(area => {
            const selected = area.id === selectedArea?.id;
            const pickable = !drawTool && (mode === 'view' || areaSelectionMode || linkableAreaIds?.has(area.id));
            return <g key={area.id} className={`plan-canvas__area plan-canvas__area--${area.kind}${selected ? ' is-selected' : selectedArea && dimOtherAreas ? ' is-dimmed' : ''}${pickable ? ' is-pickable' : ''}`} aria-label={`${area.name} · ${AREA_LABELS[area.kind]}${selected ? ' · 선택됨' : ''}`} data-area-id={area.id}
              onClick={pickable ? event => { event.stopPropagation(); selectArea(area.id); } : undefined} onPointerDown={pickable ? event => event.stopPropagation() : undefined}>
              <title>{`${area.name} · ${AREA_LABELS[area.kind]}`}</title>
              {area.outline ? <polygon className="plan-area-geometry" points={area.outline.map(p => `${p.x * width},${p.y * height}`).join(' ')} /> : <rect className="plan-area-geometry" x={area.bounds.x * width} y={area.bounds.y * height} width={area.bounds.width * width} height={area.bounds.height * height} />}
            </g>;
          })}
          {showStructureLayer && <g className="plan-canvas__layer plan-canvas__layer--structures" aria-label="기존 구조 레이어">
            {[...plan.structures].sort((a, b) => Number(a.kind === 'door') - Number(b.kind === 'door')).map(structure => renderStructure(structure))}
          </g>}
          {visibleElements.length>0 && <g className="plan-canvas__layer plan-canvas__layer--elements" aria-label="적용 요소 레이어">{visibleElements.filter(item => item.kind !== 'display-product').map(item => renderElement(item, activeElements.indexOf(item)))}{visibleElements.filter(item => item.kind === 'display-product').map(item => renderElement(item, activeElements.indexOf(item)))}</g>}
          {showCameras && layers.cameras && <g className="plan-canvas__layer plan-canvas__layer--cameras" aria-label="카메라 레이어">{project.cameras.map(renderCamera)}</g>}
          {showStructureLayer && <g aria-label="구조 이름표"><g aria-hidden="true">{labeledStructures.map(structure => { const packed = labels.get(structure.id); const center = structureCenter(movedStructures.find(item => item.id === structure.id) ?? structure); return packed && <line key={structure.id} className="plan-label-leader" x1={center.x * width} y1={center.y * height} x2={packed.x / contentPixelScale} y2={packed.y / contentPixelScale} />; })}</g>{labeledStructures.map(structure => renderStructure(structure, true))}</g>}
          <g className="plan-constraint-names" aria-label="보호·점유 범위 이름">{constraintNames.map(label => { const packed = labels.get(label.id); if (!packed) return null; return <g key={label.id}><line className="plan-label-leader" x1={label.x * width} y1={label.y * height} x2={packed.x / contentPixelScale} y2={packed.y / contentPixelScale} /><g className={`plan-area-label plan-area-label--constraint${label.id.startsWith('occupancy-') ? ' is-occupancy' : ''}`} transform={`translate(${packed.x / contentPixelScale} ${packed.y / contentPixelScale}) scale(${1 / contentPixelScale})`} aria-label={label.hint}><title>{label.hint}</title><rect x={-packed.width / 2} y={-12} width={packed.width} height={24} rx={4} /><text x={0} y={5} textAnchor="middle">{label.name.length > 13 ? `${label.name.slice(0, 12)}…` : label.name}</text></g></g>; })}</g>
          <g aria-label="영역 이름표">{areaLabels.map(area => {
            const packed = labels.get(`area-${area.id}`); if (!packed) return null;
            const selected = area.id === selectedArea?.id;
            const selectable = !drawTool && (mode === 'view' || linkableAreaIds?.has(area.id));
            const caption = area.name;
            const name = caption.length > 13 ? `${caption.slice(0, 12)}…` : caption;
            return <g key={area.id}><line className="plan-label-leader" x1={(area.bounds.x + area.bounds.width / 2) * width} y1={(area.bounds.y + area.bounds.height / 2) * height} x2={packed.x / contentPixelScale} y2={packed.y / contentPixelScale} /><g className={`plan-area-label${selected ? ' is-selected' : ''}${!selectable ? ' is-read-only' : ''}`} transform={`translate(${packed.x / contentPixelScale} ${packed.y / contentPixelScale}) scale(${1 / contentPixelScale})`}
              role={selectable ? 'button' : undefined} tabIndex={selectable ? 0 : undefined} aria-label={`${area.name} · ${AREA_LABELS[area.kind]}${selectable ? mode === 'place' ? ' · 이 영역에 연결' : ' · 도면에서 선택' : ''}`} aria-pressed={selectable ? selected : undefined}
              onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); if (selectable) selectArea(area.id); }}
              onKeyDown={selectable ? event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); selectArea(area.id); } } : undefined}>
              <title>{`${area.name} · ${AREA_LABELS[area.kind]}`}</title><rect x={-packed.width / 2} y={-20} width={packed.width} height={40} rx={8} /><text x={0} y={5} textAnchor="middle">{name}</text>
            </g></g>;
          })}</g>
          {wallDrawing && activeDrawWall?.geometry.kind === 'segment' && <line className="plan-canvas__active-wall" x1={activeDrawWall.geometry.start.x * width} y1={activeDrawWall.geometry.start.y * height} x2={activeDrawWall.geometry.end.x * width} y2={activeDrawWall.geometry.end.y * height} style={{ strokeWidth: 6 / contentPixelScale }} />}
          {wallDrawing && plan.structures.filter((wall) => wall.kind === 'wall' && wall.geometry.kind === 'segment').map(renderDrawWallLabel)}
          {outlineDraft.length > 0 && <g className="plan-canvas__draw-preview" aria-hidden="true"><polyline points={outlineDraft.map(p => `${p.x * width},${p.y * height}`).join(' ')} />{outlineDraft.map((p, i) => <circle key={i} cx={p.x * width} cy={p.y * height} r={6 / contentPixelScale} />)}</g>}
          {drawDraft && <g className="plan-canvas__draw-preview" aria-hidden="true">
            {drawTool === 'point' && <circle cx={drawDraft.start.x * width} cy={drawDraft.start.y * height} r={15} />}
            {drawTool === 'segment' && <line x1={drawDraft.start.x * width} y1={drawDraft.start.y * height} x2={drawDraft.end.x * width} y2={drawDraft.end.y * height} />}
            {drawTool === 'rect' && <rect x={Math.min(drawDraft.start.x, drawDraft.end.x) * width} y={Math.min(drawDraft.start.y, drawDraft.end.y) * height} width={Math.abs(drawDraft.end.x - drawDraft.start.x) * width} height={Math.abs(drawDraft.end.y - drawDraft.start.y) * height} />}
          </g>}
          {mode === 'mapping' && mappingTargets()}
          {attachmentMarkers()}
        </g>
      </svg>
    {movementValidation ? <TimedNotice lifetimeKey={`${preview?.kind}-${preview?.id}`} className={`plan-canvas__movement-feedback${previewBlocked ? ' is-blocked' : ''}${movingPosition && movingPosition.y > .5 ? ' is-top' : ''}`}><strong>{previewBlocked ? '놓을 수 없는 위치' : '놓을 수 있는 위치'}</strong><span>{movementReason ?? '놓으면 이 위치로 저장합니다.'}</span></TimedNotice> : gestureHint ? <TimedNotice lifetimeKey={gestureHint} className="plan-canvas__gesture-hint" onDismiss={()=>setGestureHint(null)}><span>{gestureHint}</span></TimedNotice> : null}
    </div>
    {drawTool === 'polygon' && <div className="plan-outline-actions"><span aria-live="polite">윤곽 {outlineDraft.length}점</span><button type="button" disabled={outlineDraft.length < 3} onClick={finishOutline}>윤곽 저장</button><button type="button" disabled={!outlineDraft.length} onClick={() => setOutlineDraft(points => points.slice(0, -1))}>마지막 점 취소</button><button type="button" disabled={!outlineDraft.length} onClick={() => setOutlineDraft([])}>윤곽 취소</button></div>}
    {drawTool && <p className="plan-canvas__instruction" id={instructionId}>{modeInstruction}</p>}
    <PlanLegend instruction={modeInstruction} instructionId={!drawTool ? instructionId : undefined}>
      {showStructureLayer&&plan.structures.some(s=>s.kind==='wall'&&s.role!=='partition') && <span><i className="legend-wall" />기존 벽</span>}
      {(['window','door','entrance','pillar'] as const).filter(kind=>showStructureLayer&&plan.structures.some(s=>s.kind===kind)).map(kind=>{const actual=plan.structures.find(s=>s.kind===kind)!;return <span key={kind}><svg viewBox="0 0 70 55"><PlanSymbol width={70} height={55} structure={{...actual,geometry:kind==='pillar'?{kind:'rect',bounds:{x:.3,y:.2,width:.4,height:.5}}:{kind:'segment',start:{x:.2,y:.2},end:{x:.8,y:.2}}}} /></svg>{kind==='window'?'창':kind==='door'?actual.doorSwing?'여닫이문':'문 · 열림 방향 미지정':kind==='entrance'?'열린 출입구':'기둥'}</span>})}
      {[...new Set([...visibleElements.filter(isCountedLayoutItem).filter(e=>['floor-point','ceiling-zone','fixture-surface','wall-segment'].includes(e.target?.kind??'')).map(layoutKindFor),...(showStructureLayer&&plan.structures.some(s=>s.kind==='existing-light')?['light' as const]:[])])].map(kind=><span key={kind}><svg viewBox="-40 -28 80 56"><LayoutSymbol kind={kind} /></svg>{LAYOUT_LABELS[kind]}</span>)}
      {plan.structures.some(s=>s.clearance) && <span><i className="legend-hatch" />빗금 · 비워 둘 출입 여유</span>}
      {visibleAreas.some(a=>a.kind==='spatial') && <span><i className="legend-area" />점선 윤곽 · 분위기 영역</span>}
      {visibleAreas.some(a=>a.kind==='ceiling') && <span>천장 영역</span>}
      {selectedArea?.kind==='floor' && <span>사용 바닥</span>}
      {plan.areas.some(a=>a.kind==='passage') && <span><i className="legend-hatch" />빗금 · 비워 둘 통행 동선{mode==='camera'?' (시점 배치 가능)':''}</span>}
      {mode==='mapping' && <span>보라 윤곽 · 연결·선택</span>}
      {showStructureLayer&&plan.structures.some(s=>keptIds.has(s.id))&&<span><img src="/icons/nucleo/IconLockOutline18.svg" width="14" height="14" alt="" />위치 고정 구조</span>}
      {showStructureLayer&&plan.structures.some(structure => structure.role === 'partition') && <span><i className="plan-canvas__legend-partition" aria-hidden="true" />점선 · 추가 가벽</span>}
      {!drawTool && mode !== 'camera' && movableStructures.length > 0 && <span><i className="plan-canvas__legend-movable" aria-hidden="true" />이동 가능한 구조 {movableStructures.length}개</span>}
      {showCameras && layers.cameras && <span>{mode==='camera'?'카메라 본체: 위치 이동 · 바깥 링/회전: 시선 변경':'카메라 · 생성 시점 위치'}</span>}
    </PlanLegend>
  </section>;
}
