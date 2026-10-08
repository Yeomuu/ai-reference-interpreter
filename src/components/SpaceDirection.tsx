import type { ReactNode } from 'react';
import type { Project, Structure } from '../domain';
import { isStructureLocked } from '../domain';
import { BASELINE_STRUCTURE_IDS, STUDY_START } from '../domain/studyStart';
import AssetImage from './AssetImage';
import PlanSymbol from './PlanSymbol';

const baselineIcons: Record<string, string> = {
  'campus-front': 'structure-front', 'campus-back': 'structure-back',
  'campus-left': 'structure-window', 'campus-right': 'structure-entrance-wall',
  'campus-door': 'structure-entrance',
};

export default function SpaceDirection({ project, tab, onTab, photos, plan, sourceActions, outlineControls, conceptUpload, onDeleteConcept, onToggleKeep, onSelectStructure, onGoal, onNext }: {
  project: Project; tab: 'photo' | 'plan'; onTab: (tab: 'photo' | 'plan') => void;
  photos: ReactNode; plan: ReactNode; sourceActions: ReactNode;
  outlineControls: ReactNode; conceptUpload: ReactNode;
  onDeleteConcept: (id: string) => void; onToggleKeep: (structure: Structure) => void;
  onSelectStructure: (id: string) => void; onGoal: (goal: string) => void; onNext: () => void;
}) {
  const directions = project.references.filter(reference => reference.role === 'ambience');
  const fixedScenario = project.floorPlan?.structures.some(item => item.preservationRequired);
  const structures = fixedScenario ? BASELINE_STRUCTURE_IDS.flatMap(id => project.floorPlan?.structures.find(item => item.id === id) ?? []) : project.floorPlan?.structures ?? [];
  return <div className="space-direction space-direction--figma">
    <div className="workspace-registration" aria-hidden="true"><img className="workspace-pin workspace-pin--top-left" src="/figma/source/corner-left.svg" alt="" /><img className="workspace-pin workspace-pin--bottom-left" src="/figma/source/corner-left.svg" alt="" /><img className="workspace-pin workspace-pin--top-right" src="/figma/source/corner-right.svg" alt="" /><img className="workspace-pin workspace-pin--bottom-right" src="/figma/source/corner-right.svg" alt="" /><img className="workspace-pin workspace-pin--center-top" src="/figma/source/center-top.svg" alt="" /><img className="workspace-pin workspace-pin--center-bottom" src="/figma/source/center-bottom.svg" alt="" /></div>
    <section className="layout-canvas-panel space-evidence" aria-label="기준 공간 자료">
      <div className="space-evidence__toolbar"><div className="mapping-tabs space-source-tabs"><button aria-pressed={tab === 'photo'} onClick={() => onTab('photo')}><img src={tab === 'photo' ? '/figma/source/tab-photo.svg' : '/figma/source/tab-photo-inactive.svg'} alt="" aria-hidden="true" />공간 사진</button><button aria-pressed={tab === 'plan'} onClick={() => onTab('plan')}><img src={tab === 'plan' ? '/figma/source/tab-plan-active.svg' : '/figma/source/tab-plan.svg'} alt="" aria-hidden="true" />평면도</button></div><div className="space-evidence__actions">{sourceActions}</div></div>
      <div className={`space-evidence__content space-evidence__content--${tab}`}>{tab === 'photo' ? photos : plan}</div>
    </section>
    <aside className={`layout-panel space-direction-panel ${fixedScenario ? 'space-direction-panel--fixed' : ''}`} aria-label="전체 분위기와 디자인 목표">
      <div className="layout-tool-scroll space-direction-scroll">
        <section className="space-direction-section space-atmosphere"><div className="space-section-title"><h2>전체 분위기 방향 <span>(선택)</span></h2><span className="meta">{directions.length} / {STUDY_START.maxConceptImages}</span></div><p className="space-section-help">원하는 공간의 색감, 조명, 분위기를 보여주는 이미지를 추가해 주세요. 최대 {STUDY_START.maxConceptImages}장</p>
          <div className="space-concept-images">{directions.map(reference => { const image = project.sourceImages.find(item => item.id === reference.imageId); return image && <div key={reference.id} className="space-concept-image"><AssetImage uri={image.uri} alt={image.name} /><button type="button" aria-label={`${image.name} 삭제`} onClick={() => onDeleteConcept(reference.id)}><img src="/figma/source/thumbnail-delete.svg" alt="" aria-hidden="true" /></button></div>; })}{conceptUpload}</div>
        </section>
        <section className="space-direction-section"><h2>기본 구조</h2><div className="space-baseline-list">{structures.map(structure => <div className="space-baseline-row" key={structure.id}>
          <button type="button" className="space-baseline-select" onClick={() => { onTab('plan'); onSelectStructure(structure.id); }}>{fixedScenario && baselineIcons[structure.id] ? <img src={`/figma/source/${baselineIcons[structure.id]}.svg`} alt="" aria-hidden="true" /> : <svg viewBox="0 0 70 55" width="24" height="24" aria-hidden="true"><PlanSymbol structure={{ ...structure, geometry: { kind: 'segment', start: { x: .2, y: .2 }, end: { x: .8, y: .2 } } }} width={70} height={55} /></svg>}<span>{structure.name}</span></button>
          {structure.preservationRequired ? <span className="space-required" title="위치·형태는 유지하며 호환되는 벽면 장식·조명은 적용할 수 있습니다.">필수</span> : <label className="space-preservation"><span className="sr-only">{structure.name} 필수 보존</span><input type="checkbox" checked={isStructureLocked(project, structure)} onChange={() => onToggleKeep(structure)} aria-label={`${structure.name} 필수 보존`} /></label>}
        </div>)}</div><p className={fixedScenario ? 'sr-only' : 'space-section-help'}>{fixedScenario ? '기본 구조의 위치·형태는 변경할 수 없습니다. ' : '보존한 구조의 위치·형태를 유지합니다. '}호환되는 벽면 장식·조명은 적용할 수 있습니다.</p></section>
        <section className="space-direction-section space-goal"><label className="field"><span>디자인 목표</span><textarea key={`${project.id}-${project.designGoal ?? ''}`} defaultValue={project.designGoal ?? ''} maxLength={STUDY_START.maxDesignGoalLength} placeholder="예: 모두의 작품이 돋보이는 깔끔하고 모던한 전시 공간" onBlur={event => onGoal(event.target.value)} aria-describedby="design-goal-help" /></label><p id="design-goal-help" className={fixedScenario ? 'sr-only' : 'space-section-help'}>원하는 공간을 적어주세요. 시안 생성에 함께 반영됩니다.</p></section>
        {outlineControls}
      </div>
      <div className="space-direction-footer"><button type="button" className="button button-primary" onClick={onNext}>다음으로</button></div>
    </aside>
  </div>;
}
