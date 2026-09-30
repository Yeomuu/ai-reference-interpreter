import { describe, expect, it } from 'vitest'
import { planSymbol } from './planSymbols'
import type { Structure } from './types'
import { createCampusProject } from '../data/campus'
import { validatePreflight } from './validation'

const door: Structure = { id: 'door', name: '문', kind: 'door', protected: true, geometry: { kind: 'segment', start: { x: .2, y: .3 }, end: { x: .4, y: .3 } } }
describe('plan opening symbols', () => {
  it('does not invent a swing for unspecified existing doors', () => {
    expect(planSymbol(door, 1000, 600)?.paths.join(' ')).not.toContain(' A ')
    expect(planSymbol({ ...door, kind: 'entrance' }, 1000, 600)?.paths).toHaveLength(1)
    expect(planSymbol({ ...door, kind: 'window' }, 1000, 600)?.paths).toHaveLength(2)
  })
  it('keeps leaf length equal to the opening at horizontal and vertical aspect ratios', () => {
    const horizontal = planSymbol({ ...door, doorSwing: { hinge: 'start', side: 1 } }, 1000, 600)!
    expect(horizontal.paths[1]).toBe('M 200 180 L 200 380 M 400 180 A 200 200 0 0 1 200 380')
    const vertical = planSymbol({ ...door, geometry: { kind: 'segment', start: { x: .2, y: .3 }, end: { x: .2, y: .5 } }, doorSwing: { hinge: 'end', side: -1 } }, 1000, 600)!
    expect(vertical.paths[1]).toBe('M 200 300 L 320 300 M 200 180 A 120 120 0 0 1 320 300')
  })
  it('ignores degenerate spans and non-opening geometry', () => {
    expect(planSymbol({ ...door, geometry: { kind: 'segment', start: { x: .2, y: .3 }, end: { x: .2, y: .3 } } }, 1000, 600)).toBeNull()
    expect(planSymbol({ ...door, kind: 'wall' }, 1000, 600)).toBeNull()
  })
})
describe('school scenario provenance', () => {
  it('shares the room between two concepts, with valid initial targets and no pretend results', () => {
    const a = createCampusProject('exhibition'), b = createCampusProject('popup')
    expect(a.floorPlan).toEqual(b.floorPlan)
    expect(a.results).toHaveLength(0)
    expect(a.sourceImages.filter(image => image.role === 'existing-space').every(image => image.uri.startsWith('/sample/campus/') && image.note?.includes('tukorea.ac.kr'))).toBe(true)
    expect(validatePreflight(a).issues.some(issue => issue.severity === 'error')).toBe(true)
    expect(validatePreflight(b).issues.some(issue => issue.severity === 'error')).toBe(true)
    a.floorPlan!.structures[0].name = 'changed'
    expect(createCampusProject('exhibition').floorPlan!.structures[0].name).not.toBe('changed')
  })
})
