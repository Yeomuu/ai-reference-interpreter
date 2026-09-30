import type { Point, Project } from './types'

function center(bounds: { x: number; y: number; width: number; height: number }): Point {
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
}

function direction(from: Point, to: Point): number {
  return (Math.round(Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI) + 360) % 360
}

function toward(from: Point, to: Point, distance: number): Point {
  const length = Math.hypot(to.x - from.x, to.y - from.y) || 1
  return { x: from.x + (to.x - from.x) / length * distance, y: from.y + (to.y - from.y) / length * distance }
}

/** A starting suggestion only; the user confirms the actual viewpoint on the plan. */
export function suggestNextCamera(project: Project): Point & { directionDegrees: number } {
  const floor = project.floorPlan?.areas.find(area => area.kind === 'floor')
  const room = floor ? center(floor.bounds) : { x: .5, y: .5 }
  const openings = (project.floorPlan?.structures ?? []).filter(item => (item.kind === 'entrance' || item.kind === 'door') && item.geometry.kind === 'segment')
    .map(item => {
      const geometry = item.geometry as Extract<typeof item.geometry, { kind: 'segment' }>
      return { x: (geometry.start.x + geometry.end.x) / 2, y: (geometry.start.y + geometry.end.y) / 2 }
    }).filter((point, index, all) => all.findIndex(other => Math.hypot(other.x - point.x, other.y - point.y) < .06) === index)
    .slice(0, 2)
  for (const opening of openings) {
    const position = toward(opening, room, .16)
    if (project.cameras.every(camera => Math.hypot(camera.x - position.x, camera.y - position.y) > .18)) return { ...position, directionDegrees: direction(position, room) }
  }
  const zones = (project.floorPlan?.areas ?? []).filter(area => area.kind === 'spatial')
  const targets = [...zones.map(area => center(area.bounds)), room]
  const positions = floor ? [
    { x: floor.bounds.x + floor.bounds.width * .25, y: floor.bounds.y + floor.bounds.height * .75 },
    { x: floor.bounds.x + floor.bounds.width * .75, y: floor.bounds.y + floor.bounds.height * .75 },
    { x: floor.bounds.x + floor.bounds.width * .25, y: floor.bounds.y + floor.bounds.height * .25 },
    { x: floor.bounds.x + floor.bounds.width * .75, y: floor.bounds.y + floor.bounds.height * .25 },
  ] : [{ x: .3, y: .7 }, { x: .7, y: .7 }, { x: .3, y: .3 }, { x: .7, y: .3 }]
  const candidates = positions.flatMap(position => targets.map(target => ({ ...position, directionDegrees: direction(position, target), score: Math.min(...project.cameras.map(camera => Math.hypot(camera.x - position.x, camera.y - position.y)), 1) + (target === room ? 0 : .08) })))
  candidates.sort((a, b) => b.score - a.score)
  return candidates[0] ?? { x: room.x, y: room.y, directionDegrees: 270 }
}
