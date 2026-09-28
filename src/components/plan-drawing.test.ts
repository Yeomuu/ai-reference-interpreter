import { describe, expect, it } from 'vitest';
import type { Structure } from '../domain/types';
import { projectOntoWall, wallNearPointer } from './plan-drawing';

const horizontal: Structure = { id: 'top', kind: 'wall', name: '윗벽', protected: true, geometry: { kind: 'segment', start: { x: .1, y: .1 }, end: { x: .9, y: .1 } } };
const diagonal: Structure = { ...horizontal, id: 'diagonal', geometry: { kind: 'segment', start: { x: .1, y: .1 }, end: { x: .9, y: .9 } } };

describe('wall-bound drawing', () => {
  it('snaps near-wall pointers to the line and clamps at its endpoints', () => {
    const snapped = projectOntoWall({ x: .4, y: .12 }, horizontal, 1000, 700)!.point;
    expect(snapped.x).toBeCloseTo(.4);
    expect(snapped.y).toBeCloseTo(.1);
    expect(projectOntoWall({ x: 1, y: .2 }, horizontal, 1000, 700)?.point).toEqual({ x: .9, y: .1 });
  });
  it('uses the visible aspect ratio when projecting onto a diagonal wall', () => {
    const projection = projectOntoWall({ x: .5, y: .1 }, diagonal, 1000, 500)!;
    expect(projection.point.x).toBeCloseTo(.42);
    expect(projection.point.y).toBeCloseTo(.42);
  });
  it('keeps a 20 CSS pixel wall start zone across zoom and resize', () => {
    expect(wallNearPointer({ x: .4, y: .15 }, [horizontal], 1000, 700, .5)?.wall.id).toBe('top');
    expect(wallNearPointer({ x: .4, y: .15 }, [horizontal], 1000, 700, 1)).toBeNull();
    expect(wallNearPointer({ x: .4, y: .12 }, [horizontal], 1000, 700, 1)?.wall.id).toBe('top');
  });
  it('does not mistake the empty floor or a non-wall shape for a host wall', () => {
    expect(wallNearPointer({ x: .5, y: .5 }, [horizontal], 1000, 700, .5)).toBeNull();
    expect(projectOntoWall({ x: .5, y: .5 }, { ...horizontal, kind: 'pillar' }, 1000, 700)).toBeNull();
  });
});
