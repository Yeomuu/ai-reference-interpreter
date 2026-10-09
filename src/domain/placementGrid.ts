import type { Point } from './types.js';

// An editing aid: equal SVG-unit cells, never a measured centimetre grid.
export const PLACEMENT_GRID_DIVISIONS = 32;
export function placementGridSize(width: number, height: number): number {
  return Math.max(width, height) / PLACEMENT_GRID_DIVISIONS;
}
export function snapPlacementPoint(point: Point, width: number, height: number): Point {
  const cell = placementGridSize(width, height);
  return {
    x: Math.max(0, Math.min(1, Math.round(point.x * width / cell) * cell / width)),
    y: Math.max(0, Math.min(1, Math.round(point.y * height / cell) * cell / height)),
  };
}
