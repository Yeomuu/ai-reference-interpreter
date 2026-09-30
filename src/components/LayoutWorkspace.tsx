import type { ReactNode } from 'react';
import type { Area, DesignElement, LayoutKind, Project, Structure } from '../domain/types';
import { LAYOUT_LABELS } from '../domain/layoutMapping';
import LayoutSymbol from './LayoutSymbol';

interface Props {
  project: Project; canvas: ReactNode; inspector: ReactNode; tools: ReactNode;
  tab: 'items' | 'areas'; onTab: (value: 'items' | 'areas') => void;
  activeTool?: LayoutKind | string; onItemTool: (kind: LayoutKind | null) => void;
  onStructureTool: (kind: Structure['kind'], role: 'base' | 'partition') => void;
  onAreaTool: (kind: Area['kind']) => void; onSelect: (item: DesignElement) => void;
  selectedId?: string;
}
export default function LayoutWorkspace({ project, canvas, inspector, tools, tab, onTab, activeTool, onItemTool, onStructureTool, onAreaTool, onSelect, selectedId }: Props) {
  return <div className="layout-editor">
    <aside className="layout-panel"><div className="panel-heading"><h2>레이아웃 도구</h2></div><div className="mapping-tabs"><button aria-pressed={tab==='items'} onClick={()=>onTab('items')}>요소 추가</button><button aria-pressed={tab==='areas'} onClick={()=>onTab('areas')}>구역 설정</button></div>
      <div className="layout-tool-scroll"><button className="button" aria-pressed={!activeTool} onClick={()=>onItemTool(null)}>선택·이동</button>
        {tab==='items' ? <><h3>구조</h3><div className="layout-tool-grid">{([{kind:'wall',role:'base',label:'벽'}, {kind:'window',role:'base',label:'창'}, {kind:'door',role:'base',label:'여닫이문'}, {kind:'entrance',role:'base',label:'열린 출입구'}, {kind:'wall',role:'partition',label:'가벽'}, {kind:'pillar',role:'base',label:'기둥'}] as const).map(tool=><button key={tool.label} aria-pressed={activeTool===`${tool.kind}-${tool.role}`} onClick={()=>onStructureTool(tool.kind,tool.role)}>{tool.label}</button>)}</div>
        <h3>공간 요소</h3><div className="layout-tool-grid">{(['display','table','chair','light','wall-art','product'] as const).map(kind=><button key={kind} aria-pressed={activeTool===kind} onClick={()=>onItemTool(kind)}><svg viewBox="-45 -32 90 64"><LayoutSymbol kind={kind} /></svg>{LAYOUT_LABELS[kind]}</button>)}</div></>
        : <><h3>그릴 구역</h3><div className="layout-tool-grid">{([{kind:'spatial',label:'전시·분위기 영역'}, {kind:'passage',label:'통행 동선'}, {kind:'floor',label:'사용 바닥'}, {kind:'ceiling',label:'천장 영역'}] as const).map(tool=><button key={tool.kind} aria-pressed={activeTool===tool.kind} onClick={()=>onAreaTool(tool.kind)}>{tool.label}</button>)}</div></>}
        {tools}
        <details className="layout-item-list"><summary>배치 목록 · {project.elements.filter(item=>item.status==='apply').length}개</summary>{project.elements.filter(item=>item.status==='apply').map(item=><button key={item.id} aria-pressed={selectedId===item.id} onClick={()=>onSelect(item)}>{item.label}{!item.target && <small>위치 미지정</small>}</button>)}</details>
      </div>
    </aside>
    <section className="layout-canvas-panel">{canvas}</section>
    <aside className="layout-panel layout-inspector"><div className="panel-heading"><h2>선택한 요소 설정</h2></div><div className="layout-tool-scroll">{inspector}</div></aside>
  </div>;
}
