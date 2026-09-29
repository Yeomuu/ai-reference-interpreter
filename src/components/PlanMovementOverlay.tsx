import type { Project, Structure } from '../domain/types';
import { physicalFloorBounds } from '../domain/validation';

interface Props {
  project: Project;
  structures: Structure[];
  width: number;
  height: number;
  unit: number;
  patternId: string;
  showCameraOccupancy: boolean;
  ignoredElementId?: string;
  showStructureObstacles: boolean;
}

/** Visible evidence for existing validation constraints; never an all-clear map. */
export default function PlanMovementOverlay({ project, structures, width, height, unit, patternId, showCameraOccupancy, ignoredElementId, showStructureObstacles }: Props) {
  const plan = project.floorPlan;
  if (!plan) return null;
  return <g className="plan-movement-overlay" aria-label="사용 바닥과 이동 제한 범위">
    <defs><pattern id={patternId} width={8 * unit} height={8 * unit} patternUnits="userSpaceOnUse"><path d={`M ${-2 * unit} ${2 * unit} L ${2 * unit} ${-2 * unit} M 0 ${8 * unit} L ${8 * unit} 0 M ${6 * unit} ${10 * unit} L ${10 * unit} ${6 * unit}`} className="plan-movement-hatch" /></pattern></defs>
    {plan.areas.filter(area => area.kind === 'floor').map(area => <g key={area.id} className="plan-movement-floor" aria-label={`${area.name} · 바닥 요소와 시점의 배치 기준`}><title>{`${area.name} · 바닥 요소의 점유 범위와 카메라 위치가 이 안에 들어와야 합니다.`}</title>{area.outline ? <polygon points={area.outline.map(p => `${p.x * width},${p.y * height}`).join(' ')} /> : <rect x={area.bounds.x * width} y={area.bounds.y * height} width={area.bounds.width * width} height={area.bounds.height * height} />}</g>)}
    {plan.areas.filter(area => area.kind === 'passage').map(area => <g key={area.id} className="plan-movement-zone plan-canvas__area--passage" data-constraint-id={area.id} aria-label={`${area.name} · 통행 유지`}><title>{`${area.name} · 통행 유지: 바닥 요소·기둥·가벽으로 막을 수 없습니다.`}</title>{area.outline ? <polygon fill={`url(#${patternId})`} points={area.outline.map(p => `${p.x * width},${p.y * height}`).join(' ')} /> : <rect fill={`url(#${patternId})`} x={area.bounds.x * width} y={area.bounds.y * height} width={area.bounds.width * width} height={area.bounds.height * height} />}</g>)}
    {structures.filter(structure => structure.clearance).map(structure => <g key={structure.id} className="plan-movement-zone plan-movement-zone--clearance" data-constraint-id={structure.id} aria-label={`${structure.name} · 출입·여닫이 여유 공간`}><title>{`${structure.name} · 출입·여닫이 여유 공간: 바닥 요소·기둥·가벽으로 막을 수 없습니다.`}</title><rect fill={`url(#${patternId})`} x={structure.clearance!.x * width} y={structure.clearance!.y * height} width={structure.clearance!.width * width} height={structure.clearance!.height * height} /></g>)}
    {showStructureObstacles && structures.map(structure => {
      const geometry = structure.geometry;
      return <g key={structure.id} className="plan-movement-structure" data-obstacle-id={structure.id} aria-label={`${structure.name} · 구조 위치`}><title>{`${structure.name} · 구조 레이어를 꺼도 충돌 검사에 사용하는 위치는 표시합니다.`}</title>{geometry.kind === 'segment' ? <line x1={geometry.start.x * width} y1={geometry.start.y * height} x2={geometry.end.x * width} y2={geometry.end.y * height} /> : geometry.kind === 'rect' ? <rect x={geometry.bounds.x * width} y={geometry.bounds.y * height} width={geometry.bounds.width * width} height={geometry.bounds.height * height} /> : <circle cx={geometry.center.x * width} cy={geometry.center.y * height} r={geometry.radius * Math.min(width, height)} />}</g>;
    })}
    {project.elements.filter(element => element.status === 'apply' && element.id !== ignoredElementId).map(element => {
      const bounds = physicalFloorBounds(project, element);
      return bounds && <g key={element.id} className="plan-movement-occupancy" data-constraint-id={element.id} aria-label={`${element.label} · 배치 점유 범위`}><title>{`${element.label} · 배치 점유 범위. 다른 바닥 물체·기둥·가벽과 겹칠 수 없습니다. 연결된 진열 상품은 겹칠 수 있습니다.`}</title><rect x={bounds.x * width} y={bounds.y * height} width={bounds.width * width} height={bounds.height * height} /></g>;
    })}
    {showCameraOccupancy && project.cameras.map(camera => <g key={camera.id} className="plan-movement-camera" data-constraint-id={camera.id} aria-label={`${camera.name} · 시점 위치`}><title>{`${camera.name} · 이 시점 위치에 기둥·가벽을 놓을 수 없습니다. 시점 단계에서 수정하세요.`}</title><circle cx={camera.x * width} cy={camera.y * height} r={14 * unit} /><image href="/icons/nucleo/IconCameraOutline18.svg" x={camera.x * width - 9 * unit} y={camera.y * height - 9 * unit} width={18 * unit} height={18 * unit} aria-hidden="true" /></g>)}
  </g>;
}
