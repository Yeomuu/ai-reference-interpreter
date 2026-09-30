import { areaContainsPoint } from './geometry.js';
import type { Point, Project, Structure } from './types.js';

export type WallFace = 'a' | 'b';

/** A/B are tied to the saved start→end direction, so they survive zoom and reload. */
export function wallFaceOfPoint(project: Project, wall: Structure, point: Point): WallFace | null {
  const plan = project.floorPlan;
  if (!plan || wall.geometry.kind !== 'segment') return null;
  const { start, end } = wall.geometry;
  const dx = (end.x - start.x) * plan.width;
  const dy = (end.y - start.y) * plan.height;
  const px = (point.x - start.x) * plan.width;
  const py = (point.y - start.y) * plan.height;
  const signed = dx * py - dy * px;
  return Math.abs(signed) < 1e-6 ? null : signed > 0 ? 'a' : 'b';
}

export function wallFaceLine(wall: Structure, startFraction: number, endFraction: number, face: WallFace, width: number, height: number, offset = 15) {
  if (wall.geometry.kind !== 'segment') return null;
  const { start, end } = wall.geometry;
  const dx = (end.x - start.x) * width;
  const dy = (end.y - start.y) * height;
  const length = Math.hypot(dx, dy);
  if (!length) return null;
  const sign = face === 'a' ? 1 : -1;
  const ox = -dy / length * offset * sign;
  const oy = dx / length * offset * sign;
  return {
    start: { x: start.x * width + dx * startFraction + ox, y: start.y * height + dy * startFraction + oy },
    end: { x: start.x * width + dx * endFraction + ox, y: start.y * height + dy * endFraction + oy },
  };
}

export function wallFaceLabel(project: Project, wallId: string, face: WallFace): string {
  const plan = project.floorPlan;
  const wall = plan?.structures.find(item => item.id === wallId);
  if (!plan || !wall || wall.geometry.kind !== 'segment') return `${face.toUpperCase()}면`;
  const line = wallFaceLine(wall, .5, .5, face, plan.width, plan.height, 22);
  const sample = line && { x: line.start.x / plan.width, y: line.start.y / plan.height };
  const reverse = wallFaceLine(wall, .5, .5, face === 'a' ? 'b' : 'a', plan.width, plan.height, 22);
  const reverseSample = reverse && { x: reverse.start.x / plan.width, y: reverse.start.y / plan.height };
  // A later user-drawn zone names the visible side when zones overlap.
  const area = sample && plan.areas.filter(item => item.kind === 'spatial' && areaContainsPoint(item, sample) && (!reverseSample || !areaContainsPoint(item, reverseSample))).at(-1);
  return area ? `${face.toUpperCase()}면 · ${area.name} 쪽` : `${face.toUpperCase()}면 · 도면의 ${face.toUpperCase()} 표시 쪽`;
}
