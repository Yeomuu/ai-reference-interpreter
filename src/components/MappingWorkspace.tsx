import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Project, Rect } from '../domain/types';
import AssetImage from './AssetImage';
import ReferenceRegionPicker, { validReferenceRegion } from './ReferenceRegionPicker';
import NucleoIcon from './NucleoIcon';
import { countReferenceImages } from '../domain/prototypeLimits';
import { MAX_REFERENCE_IMAGES, REFERENCE_LIMIT_MESSAGE } from '../domain/prototypeConfig';

export const REFERENCE_DRAG_TYPE = 'application/x-scene-reference';
interface Props {
  project: Project; canvas: ReactNode; targetOptions?: ReactNode; upload: ReactNode; selectedIds: string[];
  multi: boolean; onMulti: (value: boolean) => void;
  referenceId: string; onReference: (id: string) => void; region: Rect | null; onRegion: (region: Rect | null) => void;
  onApply: () => void; onUnbind: (id: string) => void; onChange: (referenceId: string, ids: string[], region?: Rect) => void;
  onDelete: (id: string) => void; onWholeSpace: () => void;
  scope: 'appearance' | 'lighting' | 'material'; onScope: (value: 'appearance' | 'lighting' | 'material') => void;
}
export default function MappingWorkspace(props: Props) {
  const { project, canvas, upload, selectedIds, referenceId, onReference, region, onRegion } = props;
  const [tab,setTab] = useState<'references'|'bindings'>('references');
  const [crop,setCrop] = useState(false);
  const reference = project.references.find(item=>item.id===referenceId);
  const image = project.sourceImages.find(item=>item.id===reference?.imageId);
  const count=countReferenceImages(project);
  const drag = (event: React.DragEvent, id: string) => { if (crop && id===referenceId && !(region !== null && validReferenceRegion(region))) { event.preventDefault(); return; } event.dataTransfer.setData(REFERENCE_DRAG_TYPE, JSON.stringify({referenceId:id,region:id===referenceId && crop ? region : undefined})); event.dataTransfer.effectAllowed='copy'; };
  return <div className="mapping-editor"><aside className="layout-panel mapping-panel">
    <div className="panel-heading"><h2><NucleoIcon name="images" />레퍼런스</h2><span role="status" aria-label={`레퍼런스 ${count} / ${MAX_REFERENCE_IMAGES}`}>{count} / {MAX_REFERENCE_IMAGES}</span></div>
    <div className="mapping-tabs"><button aria-pressed={tab==='references'} onClick={()=>setTab('references')}><NucleoIcon name="images" />레퍼런스</button><button aria-pressed={tab==='bindings'} onClick={()=>setTab('bindings')}><NucleoIcon name="structure" />매핑 현황</button></div>
    <div className="layout-tool-scroll">{props.targetOptions}{tab==='references' ? <>
      {upload}{count>=MAX_REFERENCE_IMAGES&&<p className="limit-guidance" role="status"><NucleoIcon name="info" />{REFERENCE_LIMIT_MESSAGE}</p>}<div className="mapping-thumbnails">{project.references.map(item=>{const source=project.sourceImages.find(source=>source.id===item.imageId); return source && <button draggable key={item.id} aria-label={`${source.name} 선택`} aria-pressed={referenceId===item.id} onClick={()=>{onReference(item.id);onRegion(null);setCrop(false)}} onDragStart={event=>drag(event,item.id)}><AssetImage uri={source.uri} alt={source.name} /></button>;})}</div>
      {image ? <><div className="group-heading"><h3>{image.name}</h3><button className="button button-danger-quiet" onClick={()=>props.onDelete(referenceId)}><NucleoIcon name="trash" />삭제</button></div>
      <div className="mapping-tabs"><button aria-pressed={!crop} onClick={()=>{setCrop(false);onRegion(null)}}><NucleoIcon name="image" />전체 이미지</button><button aria-pressed={crop} onClick={()=>setCrop(true)}><NucleoIcon name="edit" />영역 선택</button></div>
      <ReferenceRegionPicker uri={image.uri} name={image.name} imageWidth={image.width} imageHeight={image.height} enabled={crop} selection={region} onChange={onRegion} />
      <button className="mapping-drag-source" draggable={!crop || (region !== null && validReferenceRegion(region))} onDragStart={event=>drag(event,referenceId)} aria-label="선택한 이미지를 도면으로 드래그">{crop ? '선택한 영역을 끌어 적용' : '이미지를 끌어 적용'}</button>
      <label className="field"><span>가져올 내용</span><select value={props.scope} onChange={event=>props.onScope(event.target.value as Props['scope'])}><option value="appearance">형태·디자인</option><option value="lighting">조명 분위기</option><option value="material">색·소재</option></select></label>
      <p className="muted small">이미지 전체를 복제하지 않고, 선택한 대상의 디자인만 연결합니다.</p>
      <button className="button" onClick={props.onWholeSpace}><NucleoIcon name="layers" />전체 공간을 대상으로 선택</button>
      <button className="button button-primary mapping-apply" disabled={!selectedIds.length || (crop && !(region !== null && validReferenceRegion(region)))} onClick={props.onApply}><NucleoIcon name="check" />선택한 {selectedIds.length}개에 적용</button>
      </> : <p className="empty-state">참고 이미지를 추가한 뒤 도면에 적용하세요.</p>}
    </> : <><h3>이미지 → 적용 대상</h3>{!(project.referenceBindings?.length) && <p className="muted">연결된 이미지가 없습니다.</p>}{project.references.map(ref=>{const bindings=project.referenceBindings?.filter(binding=>binding.referenceId===ref.id)??[];if(!bindings.length)return null;const source=project.sourceImages.find(item=>item.id===ref.imageId);return <section className="mapping-reference-group" key={ref.id}>{source&&<div className="mapping-group-source"><AssetImage uri={source.uri} alt={source.name} /><strong>{source.name}</strong></div>}{bindings.map(binding=><div className="mapping-binding" key={binding.id}><p>{binding.layoutItemIds.map(id=>project.elements.find(item=>item.id===id)?.label??'삭제된 요소').join(' · ')}</p><div><button className="button" onClick={()=>{props.onChange(binding.referenceId,binding.layoutItemIds,binding.sourceRegion);setTab('references');setCrop(!!binding.sourceRegion)}}><NucleoIcon name="edit" />변경</button><button className="button" onClick={()=>props.onUnbind(binding.id)}><NucleoIcon name="minus" />연결 해제</button></div></div>)}</section>})}</>}
    </div>
  </aside><section className="layout-canvas-panel"><div className="mapping-selection-bar"><strong><NucleoIcon name="check" />{selectedIds.length ? `${selectedIds.length}개 선택됨` : '적용할 요소를 선택하세요'}</strong><label><input type="checkbox" checked={props.multi} onChange={event=>props.onMulti(event.target.checked)} /><NucleoIcon name="layers" />다중 선택</label><span>Shift를 누른 채 선택하면 여러 요소에 함께 적용할 수 있습니다.</span></div>{canvas}</section></div>;
}
