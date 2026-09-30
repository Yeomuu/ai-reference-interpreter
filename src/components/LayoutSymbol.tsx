import type { LayoutKind } from '../domain/types';

/** Top-down plan objects, not substitute UI icons. Geometry uses the actual footprint. */
export default function LayoutSymbol({ kind, x = 0, y = 0, width = 60, height = 40 }: { kind: LayoutKind; x?: number; y?: number; width?: number; height?: number }) {
  const w = width, h = height;
  return <g className={`layout-symbol layout-symbol--${kind}`} transform={`translate(${x} ${y})`} aria-hidden="true">
    {kind === 'table' ? <><ellipse cx={0} cy={0} rx={w / 2} ry={h / 2} /><ellipse className="layout-symbol__detail" cx={0} cy={0} rx={w * .43} ry={h * .4} /></>
      : kind === 'chair' ? <><rect x={-w / 2} y={-h / 2} width={w} height={h} rx={4} /><rect className="layout-symbol__detail" x={-w / 2} y={-h / 2} width={w} height={h * .24} rx={3} /><path className="layout-symbol__detail" d={`M ${-w*.38} ${h*.4} H ${w*.38}`} /></>
        : kind === 'light' ? <><circle r={Math.min(w,h)*.36} /><circle className="layout-symbol__detail" r={Math.min(w,h)*.17} />{[0,60,120,180,240,300].map(angle => { const r = Math.min(w,h)*.46, a=angle*Math.PI/180; return <line key={angle} className="layout-symbol__detail" x1={Math.cos(a)*r} y1={Math.sin(a)*r} x2={Math.cos(a)*r*1.22} y2={Math.sin(a)*r*1.22} />; })}</>
          : kind === 'product' ? <><rect x={-w*.3} y={-h*.4} width={w*.6} height={h*.8} rx={3} /><rect className="layout-symbol__detail" x={-w*.18} y={-h*.5} width={w*.36} height={h*.16} /></>
            : <><rect x={-w/2} y={-h/2} width={w} height={h} rx={3} /><rect className="layout-symbol__detail" x={-w*.4} y={-h*.35} width={w*.8} height={h*.7} rx={2} /><path className="layout-symbol__detail" d={`M ${-w*.4} ${h*.2} H ${w*.4}`} /></>}
  </g>;
}
