import type { PlacementTarget, Point, Project, Structure } from './types.js';

export type PillarFace = 'top' | 'right' | 'bottom' | 'left' | 'round';
export type AttachmentTarget = Extract<PlacementTarget,{kind:'wall-segment'}>;
export const PILLAR_FACE_LABELS: Record<PillarFace,string> = {top:'도면 위쪽 면',right:'도면 오른쪽 면',bottom:'도면 아래쪽 면',left:'도면 왼쪽 면',round:'원형 기둥 둘레'};
export function isAttachmentHost(structure: Structure): boolean {
  return structure.kind==='wall'&&structure.geometry.kind==='segment'||structure.kind==='pillar'&&['rect','circle'].includes(structure.geometry.kind);
}
export function pillarFaces(structure?: Structure): PillarFace[] {
  return structure?.kind!=='pillar'?[]:structure.geometry.kind==='circle'?['round']:structure.geometry.kind==='rect'?['top','right','bottom','left']:[];
}
/** A face is derived from saved geometry, never inserted as another plan structure. */
export function attachmentSurface(project: Project, target: AttachmentTarget) {
  const host=project.floorPlan?.structures.find(s=>s.id===target.wallId);
  if(!host||!isAttachmentHost(host))return null;
  if(host.kind==='wall'&&host.geometry.kind==='segment')return {host,geometry:host.geometry};
  if(!target.pillarFace||!pillarFaces(host).includes(target.pillarFace))return null;
  if(host.geometry.kind==='circle')return {host,geometry:host.geometry};
  if(host.geometry.kind!=='rect')return null;
  const {x,y,width,height}=host.geometry.bounds;
  const edges:Record<string,{kind:'segment';start:Point;end:Point}>={
    top:{kind:'segment',start:{x,y},end:{x:x+width,y}},right:{kind:'segment',start:{x:x+width,y},end:{x:x+width,y:y+height}},
    bottom:{kind:'segment',start:{x:x+width,y:y+height},end:{x,y:y+height}},left:{kind:'segment',start:{x,y:y+height},end:{x,y}},
  };
  return {host,geometry:edges[target.pillarFace]};
}
export function attachmentPoint(project: Project,target: AttachmentTarget,fraction=(target.start+target.end)/2): Point|null {
  const surface=attachmentSurface(project,target),plan=project.floorPlan;
  if(!surface||!plan)return null;
  const g=surface.geometry;
  if(g.kind==='segment')return {x:g.start.x+(g.end.x-g.start.x)*fraction,y:g.start.y+(g.end.y-g.start.y)*fraction};
  const radius=g.radius*Math.min(plan.width,plan.height),angle=fraction*Math.PI*2;
  return {x:g.center.x+Math.sin(angle)*radius/plan.width,y:g.center.y-Math.cos(angle)*radius/plan.height};
}
export function attachmentFraction(project: Project,target: AttachmentTarget,point: Point): number {
  const surface=attachmentSurface(project,target),plan=project.floorPlan;
  if(!surface||!plan)return 0;
  const g=surface.geometry;
  if(g.kind==='circle')return (Math.atan2((point.x-g.center.x)*plan.width,-(point.y-g.center.y)*plan.height)+Math.PI*2)%(Math.PI*2)/(Math.PI*2);
  const dx=(g.end.x-g.start.x)*plan.width,dy=(g.end.y-g.start.y)*plan.height;
  return ((point.x-g.start.x)*plan.width*dx+(point.y-g.start.y)*plan.height*dy)/(dx*dx+dy*dy||1);
}
export function closestPillarFace(project: Project,host: Structure,point: Point): PillarFace {
  if(host.geometry.kind==='circle')return 'round';
  const plan=project.floorPlan!;
  return pillarFaces(host).map(pillarFace=>{
    const target:AttachmentTarget={kind:'wall-segment',wallId:host.id,pillarFace,start:0,end:1};
    const p=attachmentPoint(project,target,Math.max(0,Math.min(1,attachmentFraction(project,target,point))))!;
    return {pillarFace,distance:Math.hypot((p.x-point.x)*plan.width,(p.y-point.y)*plan.height)};
  }).sort((a,b)=>a.distance-b.distance)[0]?.pillarFace??'top';
}
/** Display offset only. Rect faces run clockwise; their outside is the right normal. */
export function pillarSpanPoints(project: Project,target: AttachmentTarget,offset=0): Point[] {
  const surface=attachmentSurface(project,target),plan=project.floorPlan;
  if(!surface||!plan)return [];
  const g=surface.geometry,steps=g.kind==='circle'?Math.max(2,Math.ceil((target.end-target.start)*64)):1;
  return Array.from({length:steps+1},(_,i)=>{
    const f=target.start+(target.end-target.start)*i/steps,p=attachmentPoint(project,target,f)!;
    if(g.kind==='circle'){const a=f*Math.PI*2;return{x:p.x*plan.width+Math.sin(a)*offset,y:p.y*plan.height-Math.cos(a)*offset};}
    const dx=(g.end.x-g.start.x)*plan.width,dy=(g.end.y-g.start.y)*plan.height,l=Math.hypot(dx,dy)||1;
    return {x:p.x*plan.width+dy/l*offset,y:p.y*plan.height-dx/l*offset};
  });
}
