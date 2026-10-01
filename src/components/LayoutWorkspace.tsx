import type { ReactNode } from 'react';
import type { Area, DesignElement, LayoutKind, Project, Structure } from '../domain/types';
import { LAYOUT_LABELS } from '../domain/layoutMapping';
import LayoutSymbol from './LayoutSymbol';
import PlanSymbol from './PlanSymbol';
import NucleoIcon from './NucleoIcon';
import { countLayoutItems, isCountedLayoutItem } from '../domain/prototypeLimits';
import { LAYOUT_LIMIT_MESSAGE, MAX_LAYOUT_ITEMS, USER_AREA_KINDS } from '../domain/prototypeConfig';

interface Props {
  project: Project; canvas: ReactNode; inspector: ReactNode; tools: ReactNode;
  activeTool?: LayoutKind | string; onItemTool: (kind: LayoutKind | null) => void;
  onStructureTool: (kind: Structure['kind'], role: 'base' | 'partition') => void;
  onAreaTool: (kind: Area['kind']) => void; onSelect: (item: DesignElement) => void;
  selectedId?: string; inspectorTitle?: string;
}
export default function LayoutWorkspace({ project, canvas, inspector, tools, activeTool, onItemTool, onStructureTool, onAreaTool, onSelect, selectedId, inspectorTitle = '선택 요소 설정' }: Props) {
  const count=countLayoutItems(project),limitReached=count>=MAX_LAYOUT_ITEMS;
  return <div className="layout-editor">
    <aside className="layout-panel"><div className="panel-heading"><h2><NucleoIcon name="layers" />레이아웃 도구</h2><span className="tool-count" aria-label={`배치 요소 ${count} / ${MAX_LAYOUT_ITEMS}`} role="status">배치 요소 {count} / {MAX_LAYOUT_ITEMS}</span></div>
      <div className="layout-tool-scroll"><button className="button" aria-pressed={!activeTool} onClick={()=>onItemTool(null)}><NucleoIcon name="edit" />선택·이동</button>
        {tools}
        <h3>구조</h3><div className="layout-tool-grid">{([{kind:'wall',role:'partition',label:'가벽'}, {kind:'window',role:'base',label:'창'}, {kind:'door',role:'base',label:'여닫이문'}, {kind:'entrance',role:'base',label:'열린 출입구'}, {kind:'pillar',role:'base',label:'기둥'}] as const).map(tool=><button key={tool.label} aria-pressed={activeTool===`${tool.kind}-${tool.role}`} onClick={()=>onStructureTool(tool.kind,tool.role)}><svg viewBox="0 0 70 55"><PlanSymbol width={70} height={55} structure={{id:tool.label,name:tool.label,kind:tool.kind,role:tool.role,protected:false,geometry:tool.kind==='pillar'?{kind:'rect',bounds:{x:.3,y:.2,width:.4,height:.5}}:{kind:'segment',start:{x:.2,y:.2},end:{x:.8,y:.2}},...(tool.kind==='door'?{doorSwing:{hinge:'start',side:1}}:{})}} /></svg>{tool.label}</button>)}</div>
        <h3>영역</h3><div className="layout-tool-grid">{USER_AREA_KINDS.map(kind=><button key={kind} aria-pressed={activeTool===kind} onClick={()=>onAreaTool(kind)}><NucleoIcon name={kind==='spatial'?'layers':'next'} />{kind==='spatial'?'분위기 영역':'통행 동선'}</button>)}</div>
        <h3>배치 요소</h3><div className="layout-tool-grid">{(['display','table','chair','light','product','wall-art'] as const).map(kind=><button key={kind} disabled={limitReached} aria-pressed={activeTool===kind} onClick={()=>onItemTool(kind)}><svg viewBox="-45 -32 90 64"><LayoutSymbol kind={kind} /></svg>{LAYOUT_LABELS[kind]}</button>)}</div>
        {limitReached&&<p className="limit-guidance" role="status"><NucleoIcon name="info" />{LAYOUT_LIMIT_MESSAGE}</p>}
        <details className="layout-item-list"><summary>배치 목록 · {count}개</summary>{project.elements.filter(isCountedLayoutItem).map(item=><button key={item.id} aria-pressed={selectedId===item.id} onClick={()=>onSelect(item)}>{item.label}{!item.target && <small>위치 미지정</small>}</button>)}</details>
      </div>
    </aside>
    <section className="layout-canvas-panel">{canvas}</section>
    <aside className="layout-panel layout-inspector"><div className="panel-heading"><h2><NucleoIcon name="edit" />{inspectorTitle}</h2></div><div className="layout-tool-scroll">{inspector}</div></aside>
  </div>;
}
