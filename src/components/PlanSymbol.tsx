import type { Structure } from '../domain/types'
import { planSymbol } from '../domain/planSymbols'

export default function PlanSymbol({ structure, width, height }: { structure: Structure; width: number; height: number }) {
  const symbol = planSymbol(structure, width, height)
  if (structure.kind === 'wall' && structure.geometry.kind === 'segment') return <g className={`plan-symbol plan-tool-wall${structure.role==='partition'?' plan-tool-wall--partition':''}`} aria-hidden="true"><line x1={structure.geometry.start.x*width} y1={structure.geometry.start.y*height} x2={structure.geometry.end.x*width} y2={structure.geometry.end.y*height} /></g>;
  if (structure.kind === 'pillar' && structure.geometry.kind === 'rect') { const r=structure.geometry.bounds; return <g className="plan-symbol plan-tool-pillar" aria-hidden="true"><rect x={r.x*width} y={r.y*height} width={r.width*width} height={r.height*height} /></g>; }
  return symbol && <g className="plan-symbol" aria-hidden="true">
    <path className="plan-symbol__gap" d={symbol.gap} />
    {symbol.paths.map((d, i) => <path key={i} className="plan-symbol__line" d={d} />)}
  </g>
}

export function PlanSymbolLegend() {
  return <details className="plan-symbol-legend"><summary>도면 기호 안내</summary><div>
    {(['window', 'door', 'entrance'] as const).map(kind => <span key={kind}><svg viewBox="0 0 70 55" role="img" aria-label={kind === 'window' ? '창 기호' : kind === 'door' ? '여닫이문 기호 예시' : '열린 출입구 기호'}><PlanSymbol width={70} height={55} structure={{ id: kind, kind, name: kind, protected: false, geometry: { kind: 'segment', start: { x: .2, y: .2 }, end: { x: .8, y: .2 } }, ...(kind === 'door' ? { doorSwing: { hinge: 'start', side: 1 } } : {}) }} /></svg>{kind === 'window' ? '창' : kind === 'door' ? '여닫이문' : '열린 출입구'}</span>)}
    <p>문 열림 방향을 지정하면 문짝과 회전 호가 표시됩니다. 미지정 문은 닫힌 선으로 표시합니다. 빗금은 비워 둘 공간입니다.</p>
  </div></details>
}
