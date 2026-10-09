import { describe, expect, it } from 'vitest';
import { placementGridSize, snapPlacementPoint } from '../src/domain/placementGrid';

describe('schematic placement grid',()=>{
  it('uses square cells even on a non-square uploaded plan',()=>{
    const w=1200,h=800,cell=placementGridSize(w,h);
    const a=snapPlacementPoint({x:.333,y:.517},w,h);
    expect(a.x*w/cell).toBeCloseTo(Math.round(.333*w/cell));
    expect(a.y*h/cell).toBeCloseTo(Math.round(.517*h/cell));
    expect(snapPlacementPoint(a,w,h)).toEqual(a);
    expect(snapPlacementPoint({x:a.x+cell/w,y:a.y},w,h).x*w-a.x*w).toBeCloseTo(cell);
    expect(snapPlacementPoint({x:a.x,y:a.y+cell/h},w,h).y*h-a.y*h).toBeCloseTo(cell);
  });
  it('stays inside normalized bounds at edges',()=>{
    expect(snapPlacementPoint({x:-.1,y:1.1},900,1600)).toEqual({x:0,y:1});
  });
});
