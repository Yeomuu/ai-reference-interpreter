import type { Area, DesignElement, PlacementTarget, Project } from '../domain/types';
import { allowedTargetKinds, validatePlacement } from '../domain/validation';
import { areaTargetOptions, scopeTargetKey } from '../domain/areaTargets';

interface Props {
  project: Project;
  element: DesignElement;
  onChange: (target: PlacementTarget | null) => void;
  onCreateArea: (kind: Area['kind']) => void;
  draft?: boolean;
}

/** The image crop and the element's application scope are separate user decisions. */
export default function AreaTargetPicker({ project, element, onChange, onCreateArea, draft = false }: Props) {
  const allowed = allowedTargetKinds(element.kind);
  if (!allowed.some(kind => ['whole-space', 'named-area', 'floor-area', 'ceiling-zone'].includes(kind))) return null;
  const options = areaTargetOptions(project.floorPlan, element.kind);
  const value = scopeTargetKey(element.target);
  const candidateProject = project.elements.some(item => item.id === element.id) ? project : { ...project, elements: [...project.elements, element] };
  const checkedOptions = options.map(option => ({ ...option, reason: validatePlacement(candidateProject, element.id, option.target).issues.find(issue => issue.severity === 'error')?.message }));
  const areaKind = allowed.includes('ceiling-zone') ? 'ceiling' : allowed.includes('named-area') ? 'spatial' : 'floor';
  const currentError = element.target && validatePlacement(candidateProject, element.id, element.target).issues.find(issue => issue.severity === 'error')?.message;
  return <div className="area-target-picker">
    <label className="field"><span>{allowed.includes('floor-point') ? '바닥 영역으로 배치 (선택)' : '적용할 위치'}</span><select aria-label={allowed.includes('floor-point') ? '바닥 영역으로 배치 (선택)' : '적용할 위치'} value={value} onChange={event => {
      if (!event.target.value) { if (draft) onChange(null); return; }
      const option = checkedOptions.find(item => item.key === event.target.value);
      if (!option || option.reason) return;
      const target = option.target.kind === 'ceiling-zone' && element.target?.kind === 'ceiling-zone' ? { ...element.target, zoneId: option.target.zoneId } : option.target;
      onChange(target);
    }}>
      <option value="" disabled={!draft}>{draft ? '배치에서 나중에 지정' : '적용할 위치 선택'}</option>
      {value && !options.some(option => option.key === value) && <option value={value} disabled>연결 위치 확인 필요</option>}
      {checkedOptions.map(option => <option key={option.key} value={option.key} disabled={!!option.reason}>{option.label}{option.reason ? ' · 연결 불가' : ''}</option>)}
    </select></label>
    <p className="muted small">{allowed.includes('whole-space') ? '전체 공간과 특정 영역을 구분해 연결하세요.' : allowed.includes('ceiling-zone') ? '등기구를 배치할 천장 영역을 연결하세요. 조명 분위기는 전체 공간·특정 영역에 연결하는 유형입니다.' : '이 요소를 적용할 바닥 영역을 연결하세요.'} 이미지에서 선택한 참조 범위와는 별도입니다.</p>
    {currentError && <p className="area-target-error" role="status">{currentError}</p>}
    {checkedOptions.some(option => option.reason) && <details className="area-target-reasons"><summary>연결할 수 없는 위치 확인</summary>{checkedOptions.filter(option => option.reason).map(option => <p key={option.key}><strong>{option.label}</strong><br />{option.reason}</p>)}</details>}
    {options.filter(option => option.target.kind !== 'whole-space').length === 0 && <p className="muted small">{areaKind === 'ceiling' ? '천장 영역' : areaKind === 'spatial' ? '특정 공간 영역' : '바닥 영역'}이 아직 없습니다.</p>}
    <button className="button button-quiet" type="button" onClick={() => onCreateArea(areaKind)}>도면에서 {areaKind === 'ceiling' ? '천장' : areaKind === 'spatial' ? '공간' : '바닥'} 영역 추가</button>
  </div>;
}
