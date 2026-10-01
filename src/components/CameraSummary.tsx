import type { Camera } from '../domain/types';
import NucleoIcon from './NucleoIcon';

const purposes={overview:'전체 배치와 동선',entry:'입구에서 공간 안쪽',secondary:'다른 방향의 전시 모습',custom:'저장한 관람 위치'};
export default function CameraSummary({cameras,selectedId,onSelect,onEdit}:{cameras:Camera[];selectedId?:string;onSelect:(id:string)=>void;onEdit:()=>void}) {
  const automatic=cameras.length>0&&cameras.every(camera=>camera.recommendation==='automatic');
  return <section className="camera-summary" aria-label="추천 시점 확인"><div className="group-heading"><div><h2><NucleoIcon name="camera" />{automatic?'추천 시점':'결과를 볼 시점'}</h2><p className="muted small">{automatic?`추천 시점 ${cameras.length}개가 설정되어 있습니다.`:'저장한 시점으로 생성할 수 있습니다.'}</p></div><button className="button button-secondary" onClick={onEdit}><NucleoIcon name="camera" />시점 수정</button></div><div className="camera-summary-views">{cameras.map(camera=><button key={camera.id} aria-pressed={selectedId===camera.id} onClick={()=>onSelect(camera.id)}><NucleoIcon name={camera.viewPreset==='overview'?'layers':'camera'} /><span><strong>{camera.name}</strong><small>{purposes[camera.viewPreset??'custom']}</small></span></button>)}</div>{!cameras.length&&<p className="muted">놓을 수 있는 관람 위치를 찾지 못했습니다. 실내 윤곽과 장애물을 확인해 주세요.</p>}</section>;
}
