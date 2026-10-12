import { areaIntersectsSegment } from './geometry.js';
import type { Area, PlacementTarget, Point, Project, Structure } from './types.js';
type FloorTarget=Extract<PlacementTarget,{kind:'floor-point'}>;
/** Saved plan units only, not physical centimetres. */
export function tableFootprint(target:FloorTarget,width:number,height:number):Area {
  const size=target.footprint??{width:.06,height:.06},a=(target.rotationDegrees??0)*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  const outline=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>({x:target.x+(x*size.width*width/2*c-y*size.height*height/2*s)/width,y:target.y+(x*size.width*width/2*s+y*size.height*height/2*c)/height}));
  const xs=outline.map(p=>p.x),ys=outline.map(p=>p.y),x=Math.min(...xs),y=Math.min(...ys);
  return {id:'table-footprint',name:'테이블 점유',kind:'floor',outline,bounds:{x,y,width:Math.max(...xs)-x,height:Math.max(...ys)-y}};
}
export function wallCrossesTable(target:FloorTarget,wall:Structure,width:number,height:number):boolean {
  return wall.geometry.kind==='segment'&&areaIntersectsSegment(tableFootprint(target,width,height),wall.geometry.start,wall.geometry.end);
}
function contact(project:Project,target:FloorTarget,wall:Structure,rotate:boolean):FloorTarget|null {
  const plan=project.floorPlan;if(!plan||wall.kind!=='wall'||wall.geometry.kind!=='segment')return null;
  const {start,end}=wall.geometry,dx=(end.x-start.x)*plan.width,dy=(end.y-start.y)*plan.height,l=Math.hypot(dx,dy);if(!l)return null;
  const tx=dx/l,ty=dy/l,nx=-ty,ny=tx,a=(rotate?Math.atan2(dy,dx):(target.rotationDegrees??0)*Math.PI/180),c=Math.cos(a),s=Math.sin(a);
  if(!rotate&&Math.min(Math.abs(tx*s-ty*c),Math.abs(tx*c+ty*s))>1e-6)return null;
  const size=target.footprint??{width:.06,height:.06},hw=size.width*plan.width/2,hh=size.height*plan.height/2;
  const along=Math.abs(tx*c+ty*s)*hw+Math.abs(-tx*s+ty*c)*hh,normal=Math.abs(nx*c+ny*s)*hw+Math.abs(-nx*s+ny*c)*hh;if(l<along*2)return null;
  const px=(target.x-start.x)*plan.width,py=(target.y-start.y)*plan.height,side=px*nx+py*ny>=0?1:-1;
  const t=Math.max(along,Math.min(l-along,px*tx+py*ty));
  return {...target,x:start.x+(tx*t+nx*normal*side)/plan.width,y:start.y+(ty*t+ny*normal*side)/plan.height,...(rotate?{rotationDegrees:(a*180/Math.PI+360)%360}:{})};
}
export function tableAgainstWall(project:Project,target:FloorTarget,wallId:string):FloorTarget|null {
  const wall=project.floorPlan?.structures.find(s=>s.id===wallId);return wall?contact(project,target,wall,true):null;
}
export function snapTableToWall(project:Project,target:FloorTarget):FloorTarget {
  const plan=project.floorPlan;if(!plan)return target;
  const threshold=Math.max(plan.width,plan.height)/32;
  return plan.structures.flatMap(wall=>{const next=contact(project,target,wall,false);return next?[{next,gap:Math.hypot((next.x-target.x)*plan.width,(next.y-target.y)*plan.height)}]:[];}).filter(c=>c.gap<=threshold).sort((a,b)=>a.gap-b.gap)[0]?.next??target;
}
export function tableContactPoint(project:Project,point:Point,footprint={width:.10,height:.07}):Point {
  return snapTableToWall(project,{kind:'floor-point',...point,footprint,rotationDegrees:0});
}
