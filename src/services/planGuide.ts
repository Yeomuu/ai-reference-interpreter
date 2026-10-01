import type { DesignElement, Point, Project, Rect, StructureGeometry } from '../domain/types.js';
import { displayPosition } from '../domain/display.js';
import { arrangePlanLabels } from '../components/plan-labels.js';
import { planSymbol } from '../domain/planSymbols.js';
import { wallFaceLine } from '../domain/wallFaces.js';
import { isCountedLayoutItem } from '../domain/prototypeLimits.js';

export interface PlanGuideManifest {
  version: 1;
  commonRevision: number;
  cameraId: string;
  planKind: 'uploaded' | 'schematic';
  width: number;
  height: number;
  includesUploadedPlan: boolean;
}

export function planGuideManifest(project: Project, cameraId: string): PlanGuideManifest {
  if (!project.floorPlan || !project.cameras.some(camera => camera.id === cameraId)) throw new Error('도면과 시점을 확인해 주세요.');
  const plan = project.floorPlan;
  return { version: 1, commonRevision: project.commonRevision, cameraId, planKind: plan.kind, width: plan.width, height: plan.height, includesUploadedPlan: plan.kind === 'uploaded' };
}

export function matchesPlanGuide(project: Project, cameraId: string, value: unknown): boolean {
  if (!project.floorPlan || !project.cameras.some(camera => camera.id === cameraId) || !value || typeof value !== 'object' || Array.isArray(value)) return false;
  const expected = planGuideManifest(project, cameraId);
  const actual = value as Record<string, unknown>;
  return Object.keys(actual).length === Object.keys(expected).length && Object.entries(expected).every(([key, item]) => actual[key] === item);
}

/** Same normalized anchors as the editable canvas, including support rotation. */
export function elementPlanPosition(project: Project, element: DesignElement): Point | null {
  const target = element.target;
  if (!target || !project.floorPlan) return null;
  if (target.kind === 'floor-point') return target;
  if (target.kind === 'fixture-surface') return displayPosition(project, element);
  if (target.kind === 'wall-segment') {
    const wall = project.floorPlan.structures.find(item => item.id === target.wallId);
    if (wall?.geometry.kind !== 'segment') return null;
    const { start, end } = wall.geometry, fraction = (target.start + target.end) / 2;
    return { x: start.x + (end.x - start.x) * fraction, y: start.y + (end.y - start.y) * fraction };
  }
  const id = target.kind === 'ceiling-zone' ? target.zoneId : target.kind === 'floor-area' || target.kind === 'named-area' ? target.areaId : undefined;
  const area = project.floorPlan.areas.find(item => item.id === id);
  return area ? { x: area.bounds.x + area.bounds.width * (target.kind === 'ceiling-zone' ? target.offset?.x ?? .5 : .5), y: area.bounds.y + area.bounds.height * (target.kind === 'ceiling-zone' ? target.offset?.y ?? .5 : .5) } : null;
}

export interface PlanGuidePalette { paper: string; ink: string; structure: string; info: string; selected: string; subtle: string; border: string }
const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[char]!);
const short = (value: string, limit = 22) => value.length > limit ? `${value.slice(0, limit - 1)}…` : value;

/** Deterministic 2D guide, not image analysis, 3D reconstruction, or measured geometry. */
export function buildPlanGuideSvg(project: Project, cameraId: string, palette: PlanGuidePalette, uploadedBackground?: string, cameraIcon?: string): string {
  const manifest = planGuideManifest(project, cameraId), plan = project.floorPlan!;
  if (manifest.includesUploadedPlan && !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(uploadedBackground ?? '')) throw new Error('등록한 도면 이미지를 불러오지 못했습니다.');
  const camera = project.cameras.find(item => item.id === cameraId)!;
  const scale = 960 / Math.max(plan.width, plan.height), width = plan.width * scale, height = plan.height * scale;
  const margin = 48, header = 64, footer = 64, outputWidth = width + margin * 2, outputHeight = height + header + footer;
  const color = Object.fromEntries(Object.entries(palette).map(([key, value]) => [key, escape(value)])) as unknown as PlanGuidePalette;
  const rect = (bounds: Rect) => `x="${bounds.x * width}" y="${bounds.y * height}" width="${bounds.width * width}" height="${bounds.height * height}"`;
  const areaShape = (area: typeof plan.areas[number], attrs: string) => area.outline
    ? `<polygon points="${area.outline.map(point => `${point.x * width},${point.y * height}`).join(' ')}" ${attrs}/>` : `<rect ${rect(area.bounds)} ${attrs}/>`;
  const center = (geometry: StructureGeometry): Point => geometry.kind === 'segment' ? { x: (geometry.start.x + geometry.end.x) / 2, y: (geometry.start.y + geometry.end.y) / 2 } : geometry.kind === 'circle' ? geometry.center : { x: geometry.bounds.x + geometry.bounds.width / 2, y: geometry.bounds.y + geometry.bounds.height / 2 };
  const kept = new Set(project.keeps.map(item => item.structureId));
  const physical = project.elements.filter(item => item.status === 'apply' && item.target && (isCountedLayoutItem(item) || item.target.kind === 'wall-segment'));
  const anchors = [
    ...plan.structures.map(item => ({ id: item.id, name: item.name, point: center(item.geometry), preserved: kept.has(item.id) })),
    ...physical.flatMap(item => { const point = elementPlanPosition(project, item); return point ? [{ id: item.id, name: item.label, point, preserved: false }] : []; }),
  ];
  const obstacles = [
    ...physical.flatMap(item => item.target?.kind === 'floor-point' ? [{ id: item.id, x: item.target.x * width, y: item.target.y * height, width: (item.target.footprint?.width ?? .06) * width + 12, height: (item.target.footprint?.height ?? .06) * height + 12 }] : []),
    { id: camera.id, x: camera.x * width, y: camera.y * height, width: 48, height: 48 },
  ];
  const labelText = (item: typeof anchors[number]) => short(item.name, Math.max(5, Math.min(22, Math.floor(width / 16) - 2)));
  const labels = arrangePlanLabels(anchors.map(item => ({ id: item.id, x: item.point.x * width, y: item.point.y * height + 26, width: Math.min(width - 8, labelText(item).length * 16 + 16), height: 26 })), width, height, obstacles);
  const structureShapes = [...plan.structures].sort((a, b) => Number(a.kind === 'door') - Number(b.kind === 'door')).map(item => {
    const geometry = item.geometry, opening = ['window', 'door', 'entrance'].includes(item.kind);
    const stroke = item.kind === 'wall' ? color.ink : opening ? color.info : color.structure;
    const attrs = `fill="${item.kind === 'pillar' ? color.subtle : 'none'}" stroke="${stroke}" stroke-width="${item.kind === 'wall' ? 5 : 2}"`;
    if (geometry.kind === 'segment') {
      const symbol = planSymbol(item, width, height);
      if (symbol) return `<g data-structure-id="${escape(item.id)}"><path d="${symbol.gap}" fill="none" stroke="${color.paper}" stroke-width="8"/>${symbol.paths.map(d => `<path d="${d}" fill="none" stroke="${color.ink}" stroke-width="2"/>`).join('')}</g>`;
      const line = `x1="${geometry.start.x * width}" y1="${geometry.start.y * height}" x2="${geometry.end.x * width}" y2="${geometry.end.y * height}"`;
      return `${opening ? `<line ${line} stroke="${color.paper}" stroke-width="8"/>` : ''}<line data-structure-id="${escape(item.id)}" ${line} ${attrs} ${item.kind === 'door' || item.kind === 'entrance' ? 'stroke-dasharray="6 4"' : ''}/>`;
    }
    return geometry.kind === 'rect' ? `<rect data-structure-id="${escape(item.id)}" ${rect(geometry.bounds)} ${attrs}/>` : `<circle data-structure-id="${escape(item.id)}" cx="${geometry.center.x * width}" cy="${geometry.center.y * height}" r="${geometry.radius * Math.min(width, height)}" ${attrs}/>`;
  }).join('');
  const elementShapes = physical.map(item => {
    const target = item.target!, point = elementPlanPosition(project, item);
    if (!point) return '';
    if (target.kind === 'floor-point') {
      const footprint = target.footprint ?? { width: .06, height: .06 };
      return `<rect data-element-id="${escape(item.id)}" x="${(point.x - footprint.width / 2) * width}" y="${(point.y - footprint.height / 2) * height}" width="${footprint.width * width}" height="${footprint.height * height}" rx="8" transform="rotate(${target.rotationDegrees ?? 0} ${point.x * width} ${point.y * height})" fill="${color.paper}" stroke="${color.structure}" stroke-width="2"/>`;
    }
    if (target.kind === 'wall-segment') {
      const wall = plan.structures.find(structure => structure.id === target.wallId);
      if (wall?.geometry.kind !== 'segment') return '';
      const { start, end } = wall.geometry;
      const faceLine = wall.role === 'partition' && target.face ? wallFaceLine(wall, target.start, target.end, target.face, width, height) : null;
      const x1 = faceLine?.start.x ?? (start.x + (end.x - start.x) * target.start) * width;
      const y1 = faceLine?.start.y ?? (start.y + (end.y - start.y) * target.start) * height;
      const x2 = faceLine?.end.x ?? (start.x + (end.x - start.x) * target.end) * width;
      const y2 = faceLine?.end.y ?? (start.y + (end.y - start.y) * target.end) * height;
      return `<line data-element-id="${escape(item.id)}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color.selected}" stroke-width="5"/>${faceLine ? `<text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 8}" text-anchor="middle" fill="${color.selected}" font-size="12">${target.face!.toUpperCase()}면</text>` : ''}`;
    }
    if (target.kind === 'floor-area') {
      const area = plan.areas.find(area => area.id === target.areaId);
      return area ? areaShape(area, `data-element-id="${escape(item.id)}" fill="none" stroke="${color.structure}" stroke-width="2"`) : '';
    }
    if (target.kind === 'ceiling-zone') {
      return `<g data-element-id="${escape(item.id)}"><circle cx="${point.x * width}" cy="${point.y * height}" r="10" fill="${color.paper}" stroke="${color.structure}" stroke-width="2"/><text x="${point.x * width + 14}" y="${point.y * height + 5}" font-size="12" fill="${color.ink}">천장</text></g>`;
    }
    return `<circle data-element-id="${escape(item.id)}" cx="${point.x * width}" cy="${point.y * height}" r="8" fill="${color.paper}" stroke="${color.structure}" stroke-width="2"/>`;
  }).join('');
  const heading = camera.directionDegrees * Math.PI / 180, dx = Math.cos(heading), dy = Math.sin(heading);
  const x = camera.x * width, y = camera.y * height, length = 82;
  const cameraCaptionX = x > width - 120 ? x - 22 : x + 22;
  const cameraCaptionAnchor = x > width - 120 ? 'end' : 'start';
  const lighting = project.elements.filter(item => item.status === 'apply' && item.kind === 'ambient-light').map(item => `${item.label} · ${item.target?.kind === 'whole-space' ? '전체 공간' : '지정 영역'}`).join(' / ');
  const captionLimit = Math.max(12, Math.floor((outputWidth - margin * 2) / 14));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${outputWidth}" height="${outputHeight}" viewBox="0 0 ${outputWidth} ${outputHeight}">
    <rect width="100%" height="100%" fill="${color.paper}"/>
    <g font-family="Noto Sans KR, sans-serif" fill="${color.ink}"><text x="${margin}" y="26" font-size="18" font-weight="600">${escape(short(project.name, 35))} · 편집 도면</text><text x="${margin}" y="48" font-size="14">${plan.kind === 'uploaded' ? '등록 도면 위에 저장한 구조·배치' : '직접 지정한 개략 도면 · 치수 미확인'}</text></g>
    <g transform="translate(${margin} ${header})">
      ${uploadedBackground ? `<image href="${escape(uploadedBackground)}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid meet"/>` : ''}
      ${plan.areas.filter(area => area.kind === 'floor').map(area => areaShape(area, `fill="${uploadedBackground ? 'none' : color.paper}" stroke="${color.border}" stroke-width="1"`)).join('')}
      ${plan.areas.filter(area => area.kind === 'passage').map(area => areaShape(area, `fill="none" stroke="${color.info}" stroke-dasharray="6 4" stroke-width="1"`)).join('')}
      ${plan.structures.filter(item => item.clearance).map(item => `<rect ${rect(item.clearance!)} fill="none" stroke="${color.info}" stroke-width="1" stroke-dasharray="2 4"/>`).join('')}
      ${structureShapes}${elementShapes}
      <g font-family="Noto Sans KR, sans-serif" font-size="16">${anchors.map(item => { const label = labels.get(item.id); if (!label) return ''; return `<line x1="${item.point.x * width}" y1="${item.point.y * height}" x2="${label.x}" y2="${label.y}" stroke="${color.border}" stroke-width="1"/><text data-label-id="${escape(item.id)}" x="${label.x}" y="${label.y + 5}" text-anchor="middle" fill="${color.ink}" stroke="${color.paper}" stroke-width="4" paint-order="stroke">${escape(labelText(item))}</text>`; }).join('')}</g>
      <g data-camera-id="${escape(camera.id)}"><line x1="${x}" y1="${y}" x2="${x + dx * length}" y2="${y + dy * length}" stroke="${color.ink}" stroke-width="3"/><path d="M ${x + dx * length - dx * 12 + dy * 7} ${y + dy * length - dy * 12 - dx * 7} L ${x + dx * length} ${y + dy * length} L ${x + dx * length - dx * 12 - dy * 7} ${y + dy * length - dy * 12 + dx * 7}" fill="none" stroke="${color.ink}" stroke-width="3"/>${cameraIcon ? `<image href="${escape(cameraIcon)}" x="${x - 14}" y="${y - 14}" width="28" height="28"/>` : `<circle cx="${x}" cy="${y}" r="9" fill="${color.paper}" stroke="${color.ink}" stroke-width="2"/>`}<text x="${cameraCaptionX}" y="${y + 6}" text-anchor="${cameraCaptionAnchor}" font-family="Noto Sans KR, sans-serif" font-size="16" fill="${color.ink}" stroke="${color.paper}" stroke-width="4" paint-order="stroke">선택 시점</text></g>
    </g><g font-family="Noto Sans KR, sans-serif" font-size="14" fill="${color.ink}"><text x="${margin}" y="${outputHeight - 38}">${escape(short(`화살표: ${camera.name}의 시선 · 실측/3D 모델이 아닙니다.`, captionLimit))}</text><text x="${margin}" y="${outputHeight - 16}">${escape(short(lighting ? `조명 조건: ${lighting}` : '배치와 구조를 참고하여 선택 시점의 실내 이미지로 표현', captionLimit))}</text></g>
  </svg>`;
}
