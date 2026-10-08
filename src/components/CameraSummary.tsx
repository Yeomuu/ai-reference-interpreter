import type { Camera } from '../domain/types';
import NucleoIcon from './NucleoIcon';

const purposes={overview:'높은 위치에서 공간 전체를 내려다봅니다.',entry:'입구 근처에서 공간 안쪽을 바라봅니다.',secondary:'다른 쪽에서 전시 공간을 바라봅니다.',custom:'직접 정한 위치와 방향으로 바라봅니다.'};
export default function CameraSummary({cameras,selectedId,onSelect,onEdit}:{cameras:Camera[];selectedId?:string;onSelect:(id:string)=>void;onEdit:()=>void}) {
  const automatic=cameras.length>0&&cameras.every(camera=>camera.recommendation==='automatic');
  return <section className="camera-summary" aria-label="추천 시점 확인"><div className="group-heading"><div><h2><NucleoIcon name="camera" />시안에서 바라볼 위치</h2><p className="muted small">{automatic?`추천 시점 ${cameras.length}개가 설정되어 있습니다.`:'저장한 시점 중 하나를 선택해 확인하세요.'}</p></div><button className="button button-secondary" onClick={onEdit}><NucleoIcon name="edit" />시점 수정</button></div><p className="muted small camera-summary-hint">시점을 누르면 아래 도면에서 카메라 위치를 확인할 수 있습니다. 생성할 시점은 생성 설정에서 선택하세요.</p><div className="camera-summary-views">{cameras.map(camera=><button key={camera.id} aria-pressed={selectedId===camera.id} onClick={()=>onSelect(camera.id)}><NucleoIcon name="camera" /><span><strong>{camera.name}</strong><small>{purposes[camera.viewPreset??'custom']}</small></span></button>)}</div>{!cameras.length&&<p className="muted">카메라를 놓을 공간을 찾지 못했습니다. 실내 윤곽과 요소 배치를 확인하세요.</p>}</section>;
}
