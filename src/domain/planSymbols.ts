import type { Structure } from './types.js'

/** Drafting geometry, not UI icons. Scale/rotation use the actual plan aspect ratio. */
export function planSymbol(structure: Structure, width: number, height: number) {
  const g = structure.geometry
  if (g.kind !== 'segment' || !['window', 'door', 'entrance'].includes(structure.kind)) return null
  const x = g.start.x * width, y = g.start.y * height
  const dx = (g.end.x - g.start.x) * width, dy = (g.end.y - g.start.y) * height
  const length = Math.hypot(dx, dy)
  if (length < .001) return null
  const ux = dx / length, uy = dy / length
  const p = (along: number, across = 0) => `${x + ux * along - uy * across} ${y + uy * along + ux * across}`
  const jamb = Math.min(6, length / 8)
  const paths = [`M ${p(0, -jamb)} L ${p(0, jamb)} M ${p(length, -jamb)} L ${p(length, jamb)}`]
  if (structure.kind === 'window') {
    paths.push(`M ${p(0, -3)} L ${p(length, -3)} M ${p(0, 3)} L ${p(length, 3)} M ${p(length / 2, -3)} L ${p(length / 2, 3)}`)
  } else if (structure.kind === 'door') {
    const swing = structure.doorSwing
    if (!swing) paths.push(`M ${p(0)} L ${p(length)}`) // closed leaf; no invented hinge or swing
    else {
      const hinge = swing.hinge === 'start' ? 0 : length
      const closed = swing.hinge === 'start' ? length : 0
      const sweep = (swing.hinge === 'start' ? 1 : -1) * swing.side > 0 ? 1 : 0
      paths.push(`M ${p(hinge)} L ${p(hinge, swing.side * length)} M ${p(closed)} A ${length} ${length} 0 0 ${sweep} ${p(hinge, swing.side * length)}`)
    }
  }
  return { gap: `M ${p(0)} L ${p(length)}`, paths }
}
