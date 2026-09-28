import type { Point, Structure } from '../domain/types';

/** Project a pointer onto the visible wall using the plan's actual aspect ratio. */
export function projectOntoWall(point: Point, wall: Structure, width: number, height: number): { point: Point; distance: number } | null {
  if (wall.kind !== 'wall' || wall.geometry.kind !== 'segment') return null;
  const { start, end } = wall.geometry;
  const dx = (end.x - start.x) * width;
  const dy = (end.y - start.y) * height;
  const lengthSquared = dx * dx + dy * dy;
  if (!lengthSquared) return null;
  const fraction = Math.max(0, Math.min(1, (((point.x - start.x) * width) * dx + ((point.y - start.y) * height) * dy) / lengthSquared));
  const snapped = { x: start.x + (end.x - start.x) * fraction, y: start.y + (end.y - start.y) * fraction };
  return { point: snapped, distance: Math.hypot((point.x - snapped.x) * width, (point.y - snapped.y) * height) };
}

export function wallNearPointer(point: Point, walls: Structure[], width: number, height: number, screenScale: number, hitPixels = 20): { wall: Structure; point: Point } | null {
  let nearest: { wall: Structure; point: Point; distance: number } | null = null;
  for (const wall of walls) {
    const projection = projectOntoWall(point, wall, width, height);
    if (!projection || projection.distance * screenScale > hitPixels) continue;
    if (!nearest || projection.distance < nearest.distance) nearest = { wall, ...projection };
  }
  return nearest && { wall: nearest.wall, point: nearest.point };
}
