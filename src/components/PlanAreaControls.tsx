import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Area } from '../domain/types';
import { AREA_LABELS } from '../domain/areaTargets';

export type AreaLayers = Record<Area['kind'], boolean>;
interface Props {
  areas: Area[];
  layers: AreaLayers;
  selectedId?: string;
  showNames: boolean;
  dimOthers: boolean;
  linkableIds?: Set<string>;
  onLayersChange: (layers: AreaLayers) => void;
  onNamesChange: (show: boolean) => void;
  onDimChange: (dim: boolean) => void;
  onSelect: (id: string) => void;
}

export default function PlanAreaControls({ areas, layers, selectedId, showNames, dimOthers, linkableIds, onLayersChange, onNamesChange, onDimChange, onSelect }: Props) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const panelId = useId();
  useLayoutEffect(() => {
    if (!open) return;
    const positionPanel = () => {
      const anchor = detailsRef.current?.getBoundingClientRect();
      const panel = panelRef.current?.getBoundingClientRect();
      if (!anchor || !panel) return;
      const styles = getComputedStyle(document.documentElement);
      const edge = parseFloat(styles.getPropertyValue('--space-16')) || 16;
      const gap = parseFloat(styles.getPropertyValue('--space-8')) || 8;
      const left = Math.max(edge, Math.min(window.innerWidth - panel.width - edge, anchor.right - panel.width));
      const below = anchor.bottom + gap;
      const preferred = below + panel.height <= window.innerHeight - edge ? below : anchor.top - gap - panel.height;
      const top = Math.max(edge, Math.min(window.innerHeight - panel.height - edge, preferred));
      setPosition(current => current.left === left && current.top === top ? current : { left, top });
    };
    positionPanel();
    window.addEventListener('resize', positionPanel);
    document.addEventListener('scroll', positionPanel, true);
    return () => { window.removeEventListener('resize', positionPanel); document.removeEventListener('scroll', positionPanel, true); };
  }, [open, selectedId, areas.length]);
  useEffect(() => {
    if (!open) return;
    const close = () => { if (detailsRef.current) detailsRef.current.open = false; setOpen(false); };
    const outside = (event: PointerEvent) => { if (event.target instanceof Node && !detailsRef.current?.contains(event.target) && !panelRef.current?.contains(event.target)) close(); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); close(); detailsRef.current?.querySelector('summary')?.focus({ preventScroll: true }); } };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  if (!areas.length) return null;
  return <><details ref={detailsRef} className="plan-area-controls" onToggle={event => setOpen(event.currentTarget.open)}><summary aria-expanded={open} aria-controls={panelId} onKeyDown={event => { if (open && event.key === 'Tab' && !event.shiftKey) { event.preventDefault(); panelRef.current?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true }); } }}>영역·동선 {areas.length}개</summary></details>
    {open && createPortal(<div ref={panelRef} id={panelId} className="plan-area-controls__panel" role="region" aria-label="영역·동선 표시 설정" style={position} onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const controls = panelRef.current?.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input, button:not(:disabled)');
      if (!controls?.length) return;
      if ((event.shiftKey && event.target === controls[0]) || (!event.shiftKey && event.target === controls[controls.length - 1])) {
        event.preventDefault();
        if (detailsRef.current) detailsRef.current.open = false;
        setOpen(false);
        const next = event.shiftKey ? detailsRef.current?.querySelector<HTMLElement>('summary') : detailsRef.current?.closest('.plan-canvas')?.querySelector<SVGSVGElement>('.plan-canvas__svg');
        next?.focus({ preventScroll: true });
      }
    }}>
      <strong>영역·동선 표시</strong><p>표시만 바뀌며 저장한 영역과 연결은 유지됩니다.</p>
      <div className="plan-area-controls__filters" role="group" aria-label="영역 종류별 표시">{(Object.keys(AREA_LABELS) as Area['kind'][]).map(kind => <label className="checkbox-row" key={kind}><input type="checkbox" checked={kind === 'passage' || layers[kind]} disabled={kind === 'passage'} onChange={event => onLayersChange({ ...layers, [kind]: event.target.checked })} /><span>{AREA_LABELS[kind]} · {areas.filter(area => area.kind === kind).length}개{kind === 'passage' ? ' · 항상 표시' : ''}</span></label>)}</div>
      <label className="checkbox-row"><input type="checkbox" checked={showNames} onChange={event => onNamesChange(event.target.checked)} /><span>이름표 모두 표시</span></label>
      <label className="checkbox-row"><input type="checkbox" checked={dimOthers} onChange={event => onDimChange(event.target.checked)} /><span>다른 영역 옅게 표시</span></label>
      <p>{linkableIds ? '아래에서 영역을 선택하면 현재 요소와 연결합니다.' : '목록에서 선택한 영역을 도면에 강조합니다.'} 선택한 영역은 표시 설정과 관계없이 보입니다.</p>
      <div className="plan-area-controls__list" aria-label="영역·동선 목록">{[...areas].sort((a, b) => Number(b.id === selectedId) - Number(a.id === selectedId)).map(area => <button key={area.id} type="button" className={`plan-area-choice${selectedId === area.id ? ' is-selected' : ''}`} aria-pressed={selectedId === area.id} disabled={linkableIds !== undefined && !linkableIds.has(area.id)} onClick={() => onSelect(area.id)}><strong>{area.name}</strong><span>{AREA_LABELS[area.kind]}{selectedId === area.id ? ' · 선택됨' : ''}{linkableIds !== undefined && !linkableIds.has(area.id) ? ' · 이 유형에 연결 불가' : ''}</span></button>)}</div>
    </div>, document.body)}
  </>;
}
