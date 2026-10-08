import WorkspaceRegistration from './WorkspaceRegistration';
import { useRef, useState } from 'react';
import type { DragEvent, ReactNode } from 'react';
import type { Project, Rect, ReferenceBinding } from '../domain/types';
import AssetImage from './AssetImage';
import ReferenceRegionPicker, { validReferenceRegion } from './ReferenceRegionPicker';
import NucleoIcon from './NucleoIcon';
import { countReferenceImages } from '../domain/prototypeLimits';
import { MAX_REFERENCE_IMAGES, REFERENCE_LIMIT_MESSAGE } from '../domain/prototypeConfig';

export const REFERENCE_DRAG_TYPE = 'application/x-scene-reference';
const PREVIEW_COUNT = 3 * 3;
type Scope = NonNullable<ReferenceBinding['scope']>;
const SCOPE_LABELS = { appearance: '형태·디자인', lighting: '조명 분위기', material: '색·소재' };
interface Props {
  project: Project; canvas: ReactNode; targetOptions?: ReactNode; upload: ReactNode; selectedIds: string[];
  multi: boolean; onMulti: (value: boolean) => void;
  referenceId: string; onReference: (id: string) => void; region: Rect | null; onRegion: (region: Rect | null) => void;
  onApply: () => void; onUnbind: (id: string) => void; onBindingScope: (id: string, scope: Scope) => boolean;
  onDelete: (id: string) => void; onWholeSpace: () => void;
  scope: Scope; onScope: (value: Scope) => void; footer?: ReactNode;
}
export default function MappingWorkspace(props: Props) {
  const { project, canvas, upload, selectedIds, referenceId, onReference, region, onRegion } = props;
  const [tab, setTab] = useState<'references' | 'bindings'>('references');
  const [crop, setCrop] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [draftScope, setDraftScope] = useState<Scope>('appearance');
  const library = useRef<HTMLDialogElement>(null);
  const reference = project.references.find(item => item.id === referenceId);
  const image = project.sourceImages.find(item => item.id === reference?.imageId);
  const count = countReferenceImages(project);
  const sources = project.references.flatMap(item => {
    const source = project.sourceImages.find(source => source.id === item.imageId);
    return source ? [{ reference: item, source }] : [];
  });
  const previews = sources.slice(0, PREVIEW_COUNT);
  const focused = sources.find(item => item.reference.id === referenceId);
  if (focused && !previews.some(item => item.reference.id === referenceId)) previews[PREVIEW_COUNT - 1] = focused;
  const choose = (id: string) => { onReference(id); onRegion(null); setCrop(false); };
  const drag = (event: DragEvent, id: string) => {
    if (crop && id === referenceId && !(region !== null && validReferenceRegion(region))) { event.preventDefault(); return; }
    event.dataTransfer.setData(REFERENCE_DRAG_TYPE, JSON.stringify({ referenceId: id, region: id === referenceId && crop ? region : undefined }));
    event.dataTransfer.effectAllowed = 'copy';
  };
  return <div className="mapping-editor"><WorkspaceRegistration /><aside className="layout-panel mapping-panel">
    <div className="panel-heading"><h2><NucleoIcon name="images" />레퍼런스</h2><span role="status" aria-label={'레퍼런스 ' + count + ' / ' + MAX_REFERENCE_IMAGES}>{count} / {MAX_REFERENCE_IMAGES}</span></div>
    <div className="mapping-tabs"><button aria-pressed={tab === 'references'} onClick={() => setTab('references')}><NucleoIcon name="images" />레퍼런스</button><button aria-pressed={tab === 'bindings'} onClick={() => setTab('bindings')}><NucleoIcon name="structure" />매핑 현황</button></div>
    <div className="layout-tool-scroll">{tab === 'references' ? <>
      {upload}{count >= MAX_REFERENCE_IMAGES && <p className="limit-guidance" role="status"><NucleoIcon name="info" />{REFERENCE_LIMIT_MESSAGE}</p>}
      <div className="mapping-thumbnails">{previews.map(({ reference: item, source }) => <button className="reference-thumb" draggable key={item.id} aria-label={source.name + ' 선택'} aria-pressed={referenceId === item.id} onClick={() => choose(item.id)} onDragStart={event => drag(event, item.id)}><AssetImage uri={source.uri} alt={source.name} /></button>)}</div>
      {sources.length > PREVIEW_COUNT && <button className="button button-quiet reference-library-open" onClick={() => library.current?.showModal()}><NucleoIcon name="images" />전체 보기 · {sources.length}장</button>}
      {image ? <>
        <div className="group-heading"><h3>{image.name}</h3><button className="button button-danger-quiet" onClick={() => props.onDelete(referenceId)}><NucleoIcon name="trash" />삭제</button></div>
        <div className="mapping-tabs"><button aria-pressed={!crop} onClick={() => { setCrop(false); onRegion(null); }}><NucleoIcon name="image" />전체 이미지</button><button aria-pressed={crop} onClick={() => setCrop(true)}><NucleoIcon name="edit" />영역 선택</button></div>
        <ReferenceRegionPicker uri={image.uri} name={image.name} imageWidth={image.width} imageHeight={image.height} enabled={crop} selection={region} onChange={onRegion} onReferenceDragStart={event => drag(event, referenceId)} />
      </> : <p className="empty-state">참고 이미지를 추가한 뒤 도면에 적용하세요.</p>}
    </> : <>
      <h3>이미지별 연결 상태</h3>{!project.referenceBindings?.length && <p className="muted">연결된 이미지가 없습니다.</p>}
      {project.references.map(ref => {
        const bindings = project.referenceBindings?.filter(binding => binding.referenceId === ref.id) ?? [];
        if (!bindings.length) return null;
        const source = project.sourceImages.find(item => item.id === ref.imageId);
        return <section className="mapping-reference-group" key={ref.id}>
          {source && <div className="mapping-group-source"><AssetImage uri={source.uri} alt={source.name} /><strong>{source.name}</strong></div>}
          {bindings.map(binding => <div className="mapping-binding" key={binding.id}>
            <p>{binding.layoutItemIds.map(id => project.elements.find(item => item.id === id)?.label ?? '삭제된 요소').join(' · ')}</p>
            <span className="muted small">{SCOPE_LABELS[binding.scope ?? 'appearance']}</span>
            {editingId === binding.id ? <form onSubmit={event => { event.preventDefault(); if (props.onBindingScope(binding.id, draftScope)) setEditingId(''); }}>
              <label className="field"><span>가져올 내용</span><select value={draftScope} onChange={event => setDraftScope(event.target.value as Scope)}>{Object.entries(SCOPE_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
              <div className="mapping-binding-actions"><button type="submit" className="button"><NucleoIcon name="check" />변경 저장</button><button type="button" className="button button-quiet" onClick={() => setEditingId('')}>취소</button></div>
            </form> : <div className="mapping-binding-actions"><button className="button" onClick={() => { setEditingId(binding.id); setDraftScope(binding.scope ?? 'appearance'); }}><NucleoIcon name="edit" />변경</button><button className="button" onClick={() => props.onUnbind(binding.id)}><NucleoIcon name="minus" />연결 해제</button></div>}
          </div>)}
        </section>;
      })}
    </>}
    </div>
    {tab === 'references' && <div className="mapping-actions">
      {props.targetOptions}
      <div className="mapping-apply-options"><label className="field"><span>가져올 내용</span><select value={props.scope} onChange={event => props.onScope(event.target.value as Scope)}>{Object.entries(SCOPE_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><button className="button button-quiet" onClick={props.onWholeSpace}><NucleoIcon name="layers" />전체 공간 선택</button></div>
      <button className="button button-primary mapping-apply" disabled={!image || !selectedIds.length || (crop && !(region !== null && validReferenceRegion(region)))} onClick={props.onApply}><NucleoIcon name="check" />선택한 {selectedIds.length}개에 적용</button>
      <p className="muted small">{!image ? '먼저 레퍼런스를 등록하세요.' : crop && !region ? '이미지에서 필요한 부분을 먼저 선택하세요.' : !selectedIds.length ? '도면에서 대상을 고른 뒤 적용하세요. 이미지나 선택한 부분을 대상에 끌어 놓아도 됩니다.' : '선택한 내용만 연결합니다. 이미지나 선택한 부분을 대상에 끌어 놓아도 됩니다.'}</p>
    </div>}
    <dialog ref={library} className="reference-library" aria-labelledby="reference-library-title" onClick={event => { if (event.target === event.currentTarget) library.current?.close(); }}><div className="group-heading"><h2 id="reference-library-title">등록한 레퍼런스 · {sources.length}장</h2><button className="button button-quiet" aria-label="레퍼런스 전체 보기 닫기" onClick={() => library.current?.close()}><NucleoIcon name="close" /></button></div><div className="reference-library-grid">{sources.map(({ reference: item, source }) => <button key={item.id} aria-pressed={referenceId === item.id} onClick={() => { choose(item.id); library.current?.close(); }}><AssetImage uri={source.uri} alt="" /><span>{source.name}</span></button>)}</div></dialog>
  {props.footer}</aside><section className="layout-canvas-panel"><div className="mapping-selection-bar"><strong><NucleoIcon name="check" />{selectedIds.length ? selectedIds.length + '개 선택됨' : '적용할 요소를 선택하세요'}</strong><label><input type="checkbox" checked={props.multi} onChange={event => props.onMulti(event.target.checked)} /><NucleoIcon name="layers" />다중 선택</label><span>Shift로 여러 대상을 선택합니다. 배치 요소는 끌어서 위치를 조정할 수 있습니다.</span></div>{canvas}</section></div>;
}
