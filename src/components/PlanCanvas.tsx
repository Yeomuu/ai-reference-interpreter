import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent, PointerEvent } from 'react';
import type { DesignElement, FloorPlan, Point, Project, Structure } from '../domain/types';
import { resolveImageUri, revokeImageUrl } from '../services/assets';
import { projectOntoWall, wallNearPointer } from './plan-drawing';
import { previewStructureTranslation, structureMovementReason } from '../domain/structureEditing';
import './plan-canvas.css';

export interface PlanCanvasProps {
  project: Project;
  onDragEvent?: (phase: 'start' | 'end' | 'cancel', kind: string, id: string) => void;
  selectedElementId?: string;
  selectedStructureId?: string;
  selectedCameraId?: string;
  mode: 'view' | 'keep' | 'place' | 'camera';
  drawTool?: 'point' | 'segment' | 'rect';
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
type Preview = {
  kind: DragKind;
  id: string;
  point?: Point;
  degrees?: number;
  wall?: { wallId: string; start: number; end: number };
  structure?: Point;
};
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
  project,
  onDragEvent,
  selectedElementId,
  selectedStructureId,
  selectedCameraId,
  mode,
  drawTool,
  drawWallId,
  validationMessage,
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
  const [zoom, setZoom] = useState(1);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [drawDraft, setDrawDraft] = useState<DrawDraft | null>(null);
  const [gestureHint, setGestureHint] = useState<string | null>(null);
  const [layers, setLayers] = useState({ structures: true, elements: true, cameras: true });
  const [imageState, setImageState] = useState<{ sourceUri: string; url?: string; error?: string } | null>(null);
  const [canvasDisplay, setCanvasDisplay] = useState({ scale: 1, narrow: false });
  const plan = project.floorPlan;
  const planWidth = plan?.width;
  const planHeight = plan?.height;
  const sourceUri = plan?.kind === 'uploaded' ? plan.imageUri : undefined;

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
      setCanvasDisplay((current) => current.narrow === narrow && Math.abs(current.scale - scale) < 0.001
        ? current : { scale, narrow });
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
  const movableStructures = plan.structures.filter((structure) => !structureMovementReason(project, structure));
  const wallDrawing = drawTool === 'segment' && Boolean(onDrawWallSelect);
  const activeDrawWall = plan.structures.find((structure) => structure.id === (drawDraft?.wallId ?? drawWallId));
  const modeInstruction = drawTool === 'point'
    ? '원하는 위치를 한 번 누르면 구조가 추가됩니다.'
    : drawTool === 'segment'
      ? wallDrawing ? `${activeDrawWall?.name ?? '연결할 벽'}의 선에서 시작해 원하는 길이만큼 끌어 주세요. 다른 벽의 선을 누르면 연결 벽이 바뀝니다.` : '시작 위치를 누른 채 끝 위치까지 끌어 주세요. 마우스를 놓으면 선이 추가됩니다.'
      : drawTool === 'rect'
        ? '한쪽 모서리를 누른 채 반대쪽 모서리까지 끌어 주세요. 마우스를 놓으면 범위가 추가됩니다.'
        : mode === 'place'
    ? '요소는 끌어서 이동하고 회전 손잡이로 각도를 조정하세요. ‘이동 가능’ 구조도 끌 수 있습니다. 벽에 붙은 창·문은 연결 벽을 따라 이동합니다. 빈 바닥 클릭은 선택한 디자인 요소를 배치합니다.'
    : mode === 'camera'
      ? '카메라 본체를 끌면 위치가 이동합니다. 본체와 떨어진 회전 손잡이를 끌면 시선 각도만 바뀝니다. 빈 바닥을 눌러도 카메라는 이동하지 않습니다.'
      : mode === 'keep'
        ? `구조를 선택하고 필수 보존을 켜거나 끄세요. ${movableStructures.length ? '‘이동 가능’ 이름표나 구조를 끌면 위치가 바뀝니다.' : '현재 이동 가능한 구조가 없습니다. 필수 보존을 끄면 도면 위치를 수정할 수 있습니다.'}`
        : movableStructures.length ? '‘이동 가능’ 이름표나 구조를 끌어 위치를 바꾸세요. 빈 공간을 끌면 도면은 이동하지 않습니다.' : '현재 이동 가능한 구조가 없습니다. Keep에서 필수 보존을 끄거나 ‘추가 가벽’을 그려 주세요.';
  const showElements = mode === 'place' || mode === 'camera';
  const showCameras = mode === 'camera';
  const showStructureLayer = Boolean(drawTool) || layers.structures;
  const contentPixelScale = Math.max(0.01, canvasDisplay.scale * zoom);

  function svgPosition(event: { clientX: number; clientY: number }): Point | null {
    const matrix = contentRef.current?.getScreenCTM();
    if (!matrix) return null;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return { x: point.x / width, y: point.y / height };
  }

  function handleCanvasClick(event: MouseEvent<SVGSVGElement>) {
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
    const point = svgPosition(event);
    if (!point || point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) return;
    onPlacePoint?.(point.x, point.y);
  }

  function handleDrawStart(event: PointerEvent<SVGSVGElement>) {
    if (!drawTool || !onDraw || event.button !== 0) return;
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
    const next = { ...draft, end };
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
      onDraw?.(draft.start, drawTool === 'point' ? draft.start : end, draft.wallId);
    }
    return true;
  }

  function handleStructureSelect(structure: Structure) {
    if (wallDrawing && structure.kind === 'wall') onDrawWallSelect?.(structure.id);
    else if (mode === 'place' && structure.kind === 'wall' && onWallSelect && !movableStructures.some((item) => item.id === structure.id)) onWallSelect(structure.id);
    else onStructureSelect?.(structure.id);
  }

  function handleStructureKeyDown(event: KeyboardEvent<SVGGElement>, structure: Structure) {
    if (!drawTool && movableStructures.some((item) => item.id === structure.id) && onStructureMove && mode !== 'camera') {
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
    if (!drag.moved) return;
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

  function renderStructure(structure: Structure) {
    const drawHost = wallDrawing && structure.kind === 'wall' && structure.geometry.kind === 'segment';
    const selected = drawHost ? structure.id === activeDrawWall?.id : structure.id === selectedStructureId;
    const kept = keptIds.has(structure.id);
    const translated = preview?.kind === 'structure-move' && preview.structure
      ? previewStructureTranslation(project, preview.id, preview.structure).find((item) => item.id === structure.id) : undefined;
    const geometry = translated?.geometry ?? structure.geometry;
    const center = structureCenter({ ...structure, geometry });
    const movable = !drawTool && movableStructures.some((item) => item.id === structure.id)
      && Boolean(onStructureMove) && mode !== 'camera';
    const selectable = drawHost || (!drawTool && (movable || (mode === 'place' && structure.kind === 'wall'
      ? Boolean(onWallSelect || onStructureSelect)
      : Boolean(onStructureSelect))));
    const isOpening = structure.kind === 'window' || structure.kind === 'door' || structure.kind === 'entrance';
    const classes = [
      'plan-structure',
      `plan-structure--${structure.kind}`,
      structure.immutable ? 'plan-structure--immutable' : '',
      movable ? 'plan-structure--movable' : '',
      drawHost ? 'plan-structure--draw-host' : '',
      selected ? 'plan-structure--selected' : '',
      kept ? 'plan-structure--kept' : '',
    ].filter(Boolean).join(' ');
    let shape;
    if (geometry.kind === 'segment') {
      const x1 = geometry.start.x * width;
      const y1 = geometry.start.y * height;
      const x2 = geometry.end.x * width;
      const y2 = geometry.end.y * height;
      shape = <>
        {isOpening && <line className="plan-structure__opening-gap" x1={x1} y1={y1} x2={x2} y2={y2} />}
        <line className="plan-structure__shape" x1={x1} y1={y1} x2={x2} y2={y2} />
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
    const nameWidth = structure.name.length * 13 + (kept ? 36 : 20);
    const moveLabelOffset = isOpening ? structure.kind === 'entrance' ? 112 : 68 : 24;
    const nameOffset = structure.kind === 'entrance' ? (center.y > .75 ? -62 : 62)
      : structure.kind === 'door' || structure.kind === 'window' ? (center.y > .75 ? -28 : 28)
        : structure.kind === 'pillar' ? -30 : (center.y > .8 ? 20 : -22);
    const labelY = clamp(center.y * height + nameOffset / contentPixelScale, 14 / contentPixelScale, height - 14 / contentPixelScale);
    return <g
      key={structure.id}
      className={classes}
      role={selectable ? 'button' : undefined}
      tabIndex={selectable ? 0 : undefined}
      aria-label={selectable ? `${structure.name}${drawHost ? ', 연결 벽으로 선택, 벽 선을 따라 드래그해 그리기' : movable ? ', 이동 가능한 구조, 끌어서 이동 또는 방향키로 1% 이동' : ', 위치 고정, 선택하여 보존 조건 확인'}${kept ? ', Keep 보존 대상' : ''}` : undefined}
      aria-pressed={selectable ? selected : undefined}
      onClick={selectable ? (event) => { event.stopPropagation(); if (!suppressClickRef.current) handleStructureSelect(structure); } : undefined}
      onKeyDown={selectable ? (event) => handleStructureKeyDown(event, structure) : undefined}
      onPointerDown={movable ? (event) => startStructureDrag(event, structure) : undefined}
    >
      <title>{`${structure.name}${kept ? ' · Keep' : ''}`}</title>
      {shape}
      {structure.kind === 'existing-light' && <text className="plan-structure__light-label" x={center.x * width} y={center.y * height + 5} textAnchor="middle" aria-hidden="true">등</text>}
      {movable && <g className="plan-structure__move-label" transform={`translate(${center.x * width} ${center.y * height + (center.y > 0.8 ? -moveLabelOffset : moveLabelOffset) / contentPixelScale}) scale(${1 / contentPixelScale})`} aria-hidden="true">
        <rect x={-(structure.name.length * 7 + 42)} y={-18} width={structure.name.length * 14 + 84} height={36} rx={8} />
        <text textAnchor="middle" y={5}>{structure.name} · 이동 가능</text>
      </g>}
      {!movable && !drawHost && <g className={`plan-keep-label${kept ? ' is-kept' : ''}`} transform={`translate(${Math.max(nameWidth / (2 * contentPixelScale), Math.min(width - nameWidth / (2 * contentPixelScale), center.x * width))} ${labelY}) scale(${1 / contentPixelScale})`} aria-hidden="true">
        <rect x={-nameWidth / 2} y={-14} width={nameWidth} height={28} rx={8} />
        {kept && <image href="/icons/nucleo/IconLockOutline18.svg" x={-nameWidth / 2 + 8} y={-9} width={18} height={18} />}
        <text x={kept ? 10 : 0} y={5} textAnchor="middle">{structure.name}</text>
      </g>}
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
    const target = element.target;
    if (!target) return null;
    const selected = mode === 'place' && element.id === selectedElementId;
    const editable = mode === 'place' && target.kind === 'floor-point' && Boolean(onElementMove);
    const classes = `plan-element${selected ? ' plan-element--selected' : ''}${editable ? ' plan-element--editable' : ''}`;
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
      return <g className={classes} key={element.id} role={editable ? 'button' : undefined} tabIndex={editable ? 0 : undefined}
        aria-label={`${element.label}, 바닥 요소${editable ? ', 끌어서 이동, 방향키로 1% 이동' : ''}`}
        aria-pressed={editable ? selected : undefined}
        onPointerDown={editable ? (event) => startDrag(event, 'element-move', element.id, position) : undefined}
        onKeyDown={editable ? (event) => handleMoveKeyDown(event, 'element', element.id, { x: target.x, y: target.y }) : undefined}
        onClick={editable ? (event) => event.stopPropagation() : undefined}>
        <title>{element.label}</title>
        <rect className="plan-element__footprint" x={x - footprint.width * width / 2} y={y - footprint.height * height / 2} width={footprint.width * width} height={footprint.height * height} rx={Math.min(14, footprint.height * height / 4)} transform={`rotate(${degrees} ${x} ${y})`} />
        <circle className="plan-element__number-bg" cx={x} cy={y} r={14} />
        <text className="plan-element__number" x={x} y={y + 5} textAnchor="middle">{number}</text>
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
    if (target.kind === 'wall-segment') {
      const wall = activePlan.structures.find((structure) => structure.id === target.wallId && structure.geometry.kind === 'segment');
      if (!wall || wall.geometry.kind !== 'segment') return null;
      const wallPreview = preview?.kind === 'wall-element-move' && preview.id === element.id && preview.wall?.wallId === wall.id
        ? preview.wall : undefined;
      const startFraction = wallPreview?.start ?? target.start;
      const endFraction = wallPreview?.end ?? target.end;
      const start = pointOnSegment(wall.geometry.start, wall.geometry.end, startFraction);
      const end = pointOnSegment(wall.geometry.start, wall.geometry.end, endFraction);
      const middle = pointOnSegment(start, end, 0.5);
      const wallEditable = mode === 'place' && Boolean(onWallElementMove);
      return <g className={`${classes}${wallEditable ? ' plan-element--wall-editable' : ''}`} key={element.id} aria-label={`${element.label}, ${wall.name}`}>
        <title>{`${element.label} · ${wall.name}`}</title>
        <g className="plan-element__wall-drag" role={wallEditable ? 'button' : undefined} tabIndex={wallEditable ? 0 : undefined}
          aria-label={`${element.label}, ${wall.name}${wallEditable ? ', 벽을 따라 끌어서 이동, 방향키로 1% 이동' : ''}`}
          aria-pressed={wallEditable ? selected : undefined}
          onPointerDown={wallEditable ? (event) => startWallElementDrag(event, element, wall) : undefined}
          onKeyDown={wallEditable ? (event) => handleWallElementKeyDown(event, element, wall) : undefined}
          onClick={wallEditable ? (event) => event.stopPropagation() : undefined}>
          <line className="plan-element__wall" x1={start.x * width} y1={start.y * height} x2={end.x * width} y2={end.y * height} />
          <circle className="plan-element__number-bg" cx={middle.x * width} cy={middle.y * height + 20} r={14} />
          <text className="plan-element__number" x={middle.x * width} y={middle.y * height + 25} textAnchor="middle">{number}</text>
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
    return <g className={`${classes} plan-element--area`} key={element.id} aria-label={`${element.label}, 영역 적용`}>
      <title>{element.label}</title>
      {visibleBounds.map((bounds, boundsIndex) => <rect key={boundsIndex} className="plan-element__area" x={bounds.x * width + 9} y={bounds.y * height + 9} width={Math.max(0, bounds.width * width - 18)} height={Math.max(0, bounds.height * height - 18)} rx={8} />)}
      <circle className="plan-element__number-bg" cx={labelBounds.x * width + 30} cy={labelBounds.y * height + 30} r={14} />
      <text className="plan-element__number" x={labelBounds.x * width + 30} y={labelBounds.y * height + 35} textAnchor="middle">{number}</text>
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
    const selected = mode === 'camera' && (camera.id === selectedCameraId || (!selectedCameraId && camera.primary));
    const mobileUnit = canvasDisplay.narrow ? 1 / contentPixelScale : 0;
    const bodyWidth = Math.max(104, 64 * mobileUnit);
    const bodyHeight = Math.max(36, 36 * mobileUnit);
    const bodyHitWidth = Math.max(bodyWidth, 48 * mobileUnit);
    const bodyHitHeight = Math.max(bodyHeight, 48 * mobileUnit);
    const cameraIconSize = Math.max(20, 20 * mobileUnit);
    const ringRadius = canvasDisplay.narrow
      ? Math.max(61, Math.hypot(bodyHitWidth / 2, bodyHitHeight / 2) + 18 * mobileUnit)
      : 61;
    const handleDistance = canvasDisplay.narrow ? ringRadius + 24 * mobileUnit : 82;
    const handleX = x + Math.cos(angle) * handleDistance;
    const handleY = y + Math.sin(angle) * handleDistance;
    const handleWidth = Math.max(68, 64 * mobileUnit);
    const handleHeight = Math.max(28, 36 * mobileUnit);
    const handleHitHeight = Math.max(handleHeight, 48 * mobileUnit);
    const handleIconSize = Math.max(18, 18 * mobileUnit);
    return <g key={camera.id} className={`plan-camera${selected ? ' plan-camera--selected' : ''}${editable ? ' plan-camera--editable' : ''}`}
      aria-label={`${camera.name}, 방향 ${Math.round(degrees)}도`}>
      <title>{`${camera.name} · ${Math.round(degrees)}°`}</title>
      <path className="plan-camera__cone" d={`M ${x} ${y} L ${left.x} ${left.y} Q ${x + Math.cos(angle) * reach * 1.1} ${y + Math.sin(angle) * reach * 1.1} ${right.x} ${right.y} Z`} />
      <line className="plan-camera__direction" x1={x} y1={y} x2={x + Math.cos(angle) * 48} y2={y + Math.sin(angle) * 48} />
      <g className="plan-camera__drag" role={editable ? 'button' : undefined} tabIndex={editable ? 0 : undefined}
        aria-label={`${camera.name} 카메라 위치${editable ? ', 이 본체를 끌어서 이동, 방향키로 1% 이동' : ''}`}
        aria-pressed={editable ? selected : undefined}
        onPointerDown={editable ? (event) => startDrag(event, 'camera-move', camera.id, position) : undefined}
        onKeyDown={editable ? (event) => handleMoveKeyDown(event, 'camera', camera.id, { x: camera.x, y: camera.y }) : undefined}
        onClick={editable ? (event) => event.stopPropagation() : undefined}>
        <rect className="plan-camera__hit" x={x - bodyHitWidth / 2} y={y - bodyHitHeight / 2} width={bodyHitWidth} height={bodyHitHeight} rx={8} />
        <rect className="plan-camera__body" x={x - bodyWidth / 2} y={y - bodyHeight / 2} width={bodyWidth} height={bodyHeight} rx={8} />
        <image className="plan-camera__icon" href="/icons/nucleo/IconCameraOutline18.svg"
          x={x - bodyWidth / 2 + (canvasDisplay.narrow ? 8 * mobileUnit : 9)} y={y - cameraIconSize / 2}
          width={cameraIconSize} height={cameraIconSize} aria-hidden="true" />
        <text className="plan-camera__label" x={x + (canvasDisplay.narrow ? 14 * mobileUnit : 15)}
          y={y + (canvasDisplay.narrow ? 5 * mobileUnit : 5)} textAnchor="middle"
          style={canvasDisplay.narrow ? { fontSize: 13 * mobileUnit } : undefined}>{canvasDisplay.narrow ? index + 1 : `카메라 ${index + 1}`}</text>
      </g>
      {selected && editable && <g className="plan-rotation-handle plan-rotation-handle--camera" role="slider" tabIndex={0}
        aria-label={`${camera.name} 시선 회전 손잡이. 이 손잡이나 바깥 링을 끌면 위치는 그대로이고 각도만 바뀝니다.`} aria-valuemin={0} aria-valuemax={359} aria-valuenow={degrees} aria-valuetext={`${degrees}도`}
        onPointerDown={(event) => startDrag(event, 'camera-rotate', camera.id, position)}
        onKeyDown={(event) => handleRotateKeyDown(event, 'camera', camera.id, camera.directionDegrees)}
        onClick={(event) => event.stopPropagation()}>
        <circle className="plan-rotation-handle__track-hit" cx={x} cy={y} r={ringRadius} strokeWidth={canvasDisplay.narrow ? 18 * mobileUnit : 10} />
        <circle className="plan-rotation-handle__track" cx={x} cy={y} r={ringRadius} strokeWidth={canvasDisplay.narrow ? 6 * mobileUnit : 10} />
        <line x1={x + Math.cos(angle) * (bodyWidth / 2 + 1)} y1={y + Math.sin(angle) * (bodyWidth / 2 + 1)} x2={handleX} y2={handleY} />
        <rect className="plan-rotation-handle__hit" x={handleX - handleWidth / 2} y={handleY - handleHitHeight / 2} width={handleWidth} height={handleHitHeight} rx={14} />
        <rect x={handleX - handleWidth / 2} y={handleY - handleHeight / 2} width={handleWidth} height={handleHeight} rx={14} />
        <image className="plan-rotation-handle__icon" href="/icons/nucleo/IconArrowDottedRotateAnticlockwiseOutline18.svg"
          x={handleX - handleWidth / 2 + (canvasDisplay.narrow ? 8 * mobileUnit : 8)} y={handleY - handleIconSize / 2}
          width={handleIconSize} height={handleIconSize} aria-hidden="true" />
        <text x={handleX + (canvasDisplay.narrow ? 14 * mobileUnit : 8)}
          y={handleY + (canvasDisplay.narrow ? 5 * mobileUnit : 5)} textAnchor="middle"
          style={canvasDisplay.narrow ? { fontSize: 13 * mobileUnit } : undefined}>회전</text>
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
        <button type="button" onClick={() => setZoom((value) => clamp(value - ZOOM_STEP, MIN_ZOOM, MAX_ZOOM))} disabled={zoom <= MIN_ZOOM}>축소</button>
        <span aria-live="polite">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => setZoom((value) => clamp(value + ZOOM_STEP, MIN_ZOOM, MAX_ZOOM))} disabled={zoom >= MAX_ZOOM}>확대</button>
        <button type="button" onClick={() => setZoom(1)}>보기 초기화</button>
      </div>
      <div className="plan-canvas__layer-controls" aria-label="표시 레이어">
        <span>레이어</span>
        <button type="button" aria-pressed={showStructureLayer} disabled={Boolean(drawTool)} onClick={() => setLayers((current) => ({ ...current, structures: !current.structures }))}>구조 {showStructureLayer ? '표시' : '숨김'}</button>
        {showElements && <button type="button" aria-pressed={layers.elements} onClick={() => setLayers((current) => ({ ...current, elements: !current.elements }))}>요소 {layers.elements ? '표시' : '숨김'}</button>}
        {showCameras && <button type="button" aria-pressed={layers.cameras} onClick={() => setLayers((current) => ({ ...current, cameras: !current.cameras }))}>카메라 {layers.cameras ? '표시' : '숨김'}</button>}
      </div>
    </div>
    {plan.kind === 'uploaded' && (imageError || !sourceUri) && <p className="plan-canvas__image-status" role="alert">{imageError ?? '등록한 도면 이미지를 찾을 수 없습니다. 다시 등록해 주세요.'}</p>}
    {validationMessage && <div className="plan-canvas__validation" role="alert"><strong>표시를 저장하지 않았습니다.</strong><p>{validationMessage}</p></div>}
    <div className="plan-canvas__surface">
      <svg
        ref={svgRef}
        className={`plan-canvas__svg plan-canvas__svg--${mode}${drawTool ? ` plan-canvas__svg--draw-${drawTool}` : ''}`}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        role="group"
        aria-label={`${project.name} 공간 도면. ${plan.kind === 'schematic' ? '치수가 확인되지 않은 개략 도면' : '등록한 도면'}. Keep ${project.keeps.length}개${showElements ? `, 배치 요소 ${activeElements.length}개` : ''}${showCameras ? `, 카메라 ${project.cameras.length}개` : ''}.`}
        aria-describedby={instructionId}
        tabIndex={0}
        onClick={handleCanvasClick}
        onPointerDown={handleDrawStart}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onLostPointerCapture={() => { if (drawRef.current || dragRef.current) cancelGesture(); }}
        onKeyDown={(event) => { if (event.key === 'Escape' && (drawRef.current || dragRef.current)) { event.preventDefault(); cancelGesture(); setGestureHint('그리기를 취소했습니다. 저장된 도면은 그대로 유지됩니다.'); } }}
      >
        <g ref={contentRef} transform={`translate(${width / 2} ${height / 2}) scale(${zoom}) translate(${-width / 2} ${-height / 2})`}>
          <rect className="plan-canvas__backdrop" width={width} height={height} />
          {imageUri && <image className="plan-canvas__image" href={imageUri} x={0} y={0} width={width} height={height} preserveAspectRatio="xMidYMid meet" />}
          {floorAreas.map((area) => <rect key={area.id} className={`plan-canvas__floor${imageUri ? ' plan-canvas__floor--uploaded' : ''}`} x={area.bounds.x * width} y={area.bounds.y * height} width={area.bounds.width * width} height={area.bounds.height * height} />)}
          {mode === 'view' && plan.areas.filter((area) => area.kind !== 'floor').map((area) => <g key={area.id} className={`plan-canvas__area plan-canvas__area--${area.kind}`} aria-label={`${area.name} 영역`}>
            <rect x={area.bounds.x * width} y={area.bounds.y * height} width={area.bounds.width * width} height={area.bounds.height * height} />
            <text x={area.bounds.x * width + 10} y={area.bounds.y * height + 22}>{area.name}</text>
          </g>)}
          {showStructureLayer && <g className="plan-canvas__layer plan-canvas__layer--structures" aria-label="기존 구조 레이어">
            {mode === 'place' && plan.structures.filter((structure) => structure.clearance).map((structure) => <rect key={`${structure.id}-clearance`} className="plan-canvas__clearance" x={structure.clearance!.x * width} y={structure.clearance!.y * height} width={structure.clearance!.width * width} height={structure.clearance!.height * height} />)}
            {plan.structures.map(renderStructure)}
          </g>}
          {showElements && layers.elements && <g className="plan-canvas__layer plan-canvas__layer--elements" aria-label="적용 요소 레이어">{activeElements.map(renderElement)}</g>}
          {showCameras && layers.cameras && <g className="plan-canvas__layer plan-canvas__layer--cameras" aria-label="카메라 레이어">{project.cameras.map(renderCamera)}</g>}
          {wallDrawing && activeDrawWall?.geometry.kind === 'segment' && <line className="plan-canvas__active-wall" x1={activeDrawWall.geometry.start.x * width} y1={activeDrawWall.geometry.start.y * height} x2={activeDrawWall.geometry.end.x * width} y2={activeDrawWall.geometry.end.y * height} style={{ strokeWidth: 6 / contentPixelScale }} />}
          {wallDrawing && plan.structures.filter((wall) => wall.kind === 'wall' && wall.geometry.kind === 'segment').map(renderDrawWallLabel)}
          {drawDraft && <g className="plan-canvas__draw-preview" aria-hidden="true">
            {drawTool === 'point' && <circle cx={drawDraft.start.x * width} cy={drawDraft.start.y * height} r={15} />}
            {drawTool === 'segment' && <line x1={drawDraft.start.x * width} y1={drawDraft.start.y * height} x2={drawDraft.end.x * width} y2={drawDraft.end.y * height} />}
            {drawTool === 'rect' && <rect x={Math.min(drawDraft.start.x, drawDraft.end.x) * width} y={Math.min(drawDraft.start.y, drawDraft.end.y) * height} width={Math.abs(drawDraft.end.x - drawDraft.start.x) * width} height={Math.abs(drawDraft.end.y - drawDraft.start.y) * height} />}
          </g>}
        </g>
      </svg>
    </div>
    <p className="plan-canvas__instruction" id={instructionId}>{modeInstruction}</p>
    {gestureHint && <p className="plan-canvas__gesture-hint" role="status">{gestureHint}</p>}
    <div className="plan-canvas__legend" aria-label="도면 표기 설명">
      <span><i className="plan-canvas__legend-keep" aria-hidden="true" />고정 구조 / Keep</span>
      {!drawTool && mode !== 'camera' && movableStructures.length > 0 && <span><i className="plan-canvas__legend-movable" aria-hidden="true" />이동 가능한 구조 {movableStructures.length}개</span>}
      {showElements && layers.elements && <span><i className="plan-canvas__legend-element" aria-hidden="true" />적용 요소</span>}
      {showCameras && layers.cameras && <span>카메라 본체: 위치 이동 · 바깥 링/회전: 시선 변경</span>}
    </div>
  </section>;
}
