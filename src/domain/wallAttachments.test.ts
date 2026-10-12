import { describe, expect, it } from 'vitest';
import { createSampleProject } from '../data/sample';
import { createLayoutItem, bindReference } from './layoutMapping';
import { attachmentFraction, attachmentPoint, closestPillarFace, pillarSpanPoints, type AttachmentTarget } from './attachmentSurfaces';
import { snapTableToWall, tableAgainstWall, tableFootprint } from './tableWallContact';
import { validatePlacement } from './validation';
import { moveStructure, reshapeStructure } from './structureEditing';
import { buildGenerationPrompt } from '../services/generationContract';
import { buildPlanGuideSvg, elementPlanPosition } from '../services/planGuide';
import { targetPayload } from '../services/experiment';
import { isProject } from '../services/persistence';
import type { PlacementTarget } from './types';

const palette={paper:'#fff',ink:'#111',structure:'#444',info:'#888',selected:'#555',subtle:'#eee',border:'#ccc'};
function fixture() {
  const p=createSampleProject();
  p.elements=[createLayoutItem(p,'table-test','table'),createLayoutItem(p,'graphic-test','wall-art')];
  p.floorPlan!.structures.push({id:'partition',name:'전시 가벽',kind:'wall',role:'partition',protected:false,geometry:{kind:'segment',start:{x:.6,y:.2},end:{x:.6,y:.65}}},
    {id:'round-pillar',name:'원형 기둥',kind:'pillar',protected:true,geometry:{kind:'circle',center:{x:.8,y:.5},radius:.04}});
  return p;
}
const floor:Extract<PlacementTarget,{kind:'floor-point'}>={kind:'floor-point',x:.4,y:.3,footprint:{width:.1,height:.07},rotationDegrees:0};
const pillar:AttachmentTarget={kind:'wall-segment',wallId:'pillar-west',pillarFace:'top',start:.1,end:.7};

describe('floor table wall contact',()=>{
  it.each(['wall-north','wall-east','wall-south','wall-west','partition'])('allows boundary contact with %s without converting to a wall anchor',wallId=>{
    const p=fixture();
    const base={...floor,x:wallId==='wall-north'?.25:wallId==='wall-west'?.4:.75,y:wallId==='wall-south'?.7:.3};
    const next=tableAgainstWall(p,base,wallId)!;
    expect(next.kind).toBe('floor-point');
    expect(validatePlacement(p,'table-test',next).issues).toEqual([]);
  });
  it('keeps the wall interior blocked and preserves furniture, pillar, door and passage checks',()=>{
    const p=fixture();
    expect(validatePlacement(p,'table-test',{...floor,x:.6}).issues.some(i=>i.code==='partition-conflict')).toBe(true);
    expect(validatePlacement(p,'table-test',{...floor,x:.25,y:.45}).issues.some(i=>i.code==='pillar-collision')).toBe(true);
    expect(validatePlacement(p,'table-test',{...floor,x:.5,y:.8}).issues.some(i=>i.code==='door-clearance'||i.code==='passage-blocked')).toBe(true);
    const occupied=createLayoutItem(p,'other','display');occupied.target=floor;p.elements.push(occupied);
    expect(validatePlacement(p,'table-test',floor).issues.some(i=>i.code==='element-overlap')).toBe(true);
  });
  it('rejects wall contact that blocks a window or an entrance',()=>{
    const p=fixture();
    expect(validatePlacement(p,'table-test',tableAgainstWall(p,{...floor,x:.5},'wall-north')).issues.some(i=>i.code==='opening-overlap')).toBe(true);
    expect(validatePlacement(p,'table-test',tableAgainstWall(p,{...floor,x:.5,y:.8},'wall-south')).issues.some(i=>i.code==='door-clearance')).toBe(true);
  });
  it('magnetizes near a parallel wall but leaves distant and oblique tables alone',()=>{
    const p=fixture(),near={...floor,x:.25,y:.146};
    expect(snapTableToWall(p,near).y).toBeCloseTo(.135);
    expect(snapTableToWall(p,floor)).toEqual(floor);
    expect(snapTableToWall(p,{...near,rotationDegrees:45})).toEqual({...near,rotationDegrees:45});
  });
  it('uses the actual rotated table outline against a diagonal wall and traced floor',()=>{
    const p=fixture();
    p.floorPlan!.width=p.floorPlan!.height=1000;
    p.floorPlan!.structures=[{id:'diagonal',name:'대각선 벽',kind:'wall',protected:true,geometry:{kind:'segment',start:{x:.1,y:.1},end:{x:.9,y:.9}}}];
    p.floorPlan!.areas=[{id:'floor',name:'바닥',kind:'floor',bounds:{x:.1,y:.1,width:.8,height:.8},outline:[{x:.1,y:.1},{x:.9,y:.9},{x:.1,y:.9}]}];
    const next=tableAgainstWall(p,{...floor,x:.3,y:.6},'diagonal')!;
    expect(next.rotationDegrees).toBe(45);
    expect(validatePlacement(p,'table-test',next).valid).toBe(true);
    expect(tableFootprint(next,1000,1000).outline).toHaveLength(4);
    expect(validatePlacement(p,'table-test',{...next,x:next.x+.02,y:next.y-.02}).valid).toBe(false);
  });
  it('does not permit contact exceptions for a different floor fixture',()=>{
    const p=fixture();p.elements[0].layoutKind='display';p.elements[0].kind='freestanding-fixture';
    expect(validatePlacement(p,'table-test',tableAgainstWall(p,{...floor,x:.25},'wall-north')).valid).toBe(false);
  });
});

describe('attachments on preserved pillar surfaces',()=>{
  it.each(['top','right','bottom','left','round'] as const)('validates a removable graphic on %s and shares its saved coordinates with the guide',face=>{
    const p=fixture(),target={...pillar,wallId:face==='round'?'round-pillar':'pillar-west',pillarFace:face};
    p.elements[1].target=target;
    expect(validatePlacement(p,'graphic-test',target).valid).toBe(true);
    const point=attachmentPoint(p,target)!;
    expect(elementPlanPosition(p,p.elements[1])).toEqual(point);
    expect(attachmentFraction(p,target,point)).toBeCloseTo(.4);
    expect(pillarSpanPoints(p,target).length).toBeGreaterThan(1);
    expect(buildPlanGuideSvg(p,'camera-entrance',palette)).toContain(`data-pillar-face="${face}"`);
    expect(buildGenerationPrompt(p,'camera-entrance',[])).toContain(`saved surface ${face}`);
    expect(targetPayload(target).pillar_face).toBe(face);
  });
  it('allows opposite faces, rejects overlapping spans on one face and requires a valid face',()=>{
    const p=fixture();p.elements[1].target=pillar;p.elements.push({...p.elements[1],id:'second',target:null});
    expect(validatePlacement(p,'second',{...pillar,pillarFace:'bottom'}).valid).toBe(true);
    expect(validatePlacement(p,'second',pillar).issues.some(i=>i.code==='element-overlap')).toBe(true);
    expect(validatePlacement(p,'second',{...pillar,pillarFace:undefined}).valid).toBe(false);
    expect(validatePlacement(p,'second',{...pillar,pillarFace:'round'}).valid).toBe(false);
    expect(validatePlacement(p,'second',{...pillar,face:'a'}).valid).toBe(false);
    expect(validatePlacement(p,'second',{...pillar,wallId:'wall-north'}).valid).toBe(false);
    expect(validatePlacement(p,'table-test',pillar).valid).toBe(false);
  });
  it('keeps geometry preservation, material replacement and moved-host validation intact',()=>{
    const p=fixture();p.elements[1].target=pillar;
    const before=structuredClone(p.floorPlan!.structures);
    expect(moveStructure(p,'pillar-west',{x:.1,y:0}).validation.valid).toBe(false);
    p.elements[1].kind='wall-material';
    expect(validatePlacement(p,'graphic-test',pillar).issues.some(i=>i.code==='keep-conflict')).toBe(true);
    expect(p.floorPlan!.structures).toEqual(before);
    p.elements[1].kind='wall-graphic';const host=p.floorPlan!.structures.find(s=>s.id==='pillar-west')!;
    host.immutable=false;host.protected=false;p.keeps=p.keeps.filter(k=>k.structureId!==host.id);
    expect(reshapeStructure(p,host.id,{kind:'circle',center:{x:.25,y:.45},radius:.04}).validation.valid).toBe(false);
  });
  it('binds a reference without changing the pillar anchor and identifies the closest clicked face',()=>{
    const p=fixture();p.elements[1].target=pillar;
    const bound=bindReference(p,'ref-graphic',['graphic-test']);
    expect(bound.project.elements.find(e=>e.id==='graphic-test')!.target).toEqual(pillar);
    const host=p.floorPlan!.structures.find(s=>s.id==='pillar-west')!;
    expect(closestPillarFace(p,host,{x:.292,y:.455})).toBe('right');
    expect(attachmentPoint(p,{...pillar,wallId:'round-pillar',pillarFace:'round'},0)).toEqual({x:.8,y:.46});
  });
  it('accepts saved pillar faces and legacy wall anchors but rejects corrupted face data',()=>{
    const p=fixture();p.elements[1].target=pillar;
    expect(isProject(JSON.parse(JSON.stringify(p)))).toBe(true);
    p.elements[1].target={...pillar,pillarFace:'made-up' as never};expect(isProject(p)).toBe(false);
    p.elements[1].target={kind:'wall-segment',wallId:'wall-north',start:.7,end:.9};expect(isProject(p)).toBe(true);
  });
});
