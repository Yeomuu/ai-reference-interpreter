import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import NucleoIcon from './NucleoIcon';

export default function PlanLegend({ children, instruction, instructionId }: { children: ReactNode; instruction?: string; instructionId?: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const close = (event: globalThis.KeyboardEvent | globalThis.PointerEvent) => {
      if (ref.current?.open && (event instanceof KeyboardEvent ? event.key === 'Escape' : !ref.current.contains(event.target as Node))) {
        if (ref.current) ref.current.open = false;
        if (event instanceof KeyboardEvent) ref.current?.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('keydown', close);
    document.addEventListener('pointerdown', close);
    return () => { document.removeEventListener('keydown', close); document.removeEventListener('pointerdown', close); };
  }, []);
  return <details ref={ref} className="plan-canvas__legend" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary><NucleoIcon name="info" />도면 기호·조작 안내<span><NucleoIcon name={open ? 'minus' : 'add'} /></span></summary>
    <div className="plan-legend-popover"><div className="group-heading"><strong>도면 기호와 의미</strong><button type="button" className="button button-quiet" aria-label="범례 닫기" onClick={() => { if (ref.current) ref.current.open = false; ref.current?.querySelector('summary')?.focus(); }}><NucleoIcon name="close" /></button></div><div className="plan-legend-items">{children}</div>{instruction && <div className="plan-legend-instruction"><strong>도면 조작</strong><p id={instructionId}>{instruction}</p></div>}</div>
  </details>;
}
