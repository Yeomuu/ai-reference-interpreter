import type { Camera, Point, Project, Rect } from './types.js';
import { areaContainsPoint, areaContainsSegment } from './geometry.js';
import { physicalFloorBounds, validateCamera } from './validation.js';
import { CAMERA_PRESETS, CAMERA_RECOMMENDATION, MAX_CAMERAS } from './prototypeConfig.js';
import { updateCamera } from './revisions.js';

const center = (r: Rect): Point => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });
const contains = (r: Rect, p: Point) => p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
export function migrateCameraPresets(project: Project): Project {
  let changed = false;
  const cameras = project.cameras.map(camera => {
    if (camera.viewPreset !== undefined && camera.heightMeters !== undefined && camera.pitchDegrees !== undefined && camera.eyeHeightPreset !== undefined) return camera;
    changed = true;
    const preset = CAMERA_PRESETS[camera.viewPreset ?? 'custom'];
    return { ...camera, viewPreset: camera.viewPreset ?? 'custom' as const, heightMeters: camera.heightMeters ?? preset.heightMeters, pitchDegrees: camera.pitchDegrees ?? preset.pitchDegrees, eyeHeightPreset: camera.eyeHeightPreset ?? 'custom' as const };
  });
  return changed ? { ...project, cameras } : project;
}
function physical(project: Project, p: Point): Point {
  const plan = project.floorPlan!, short = Math.min(plan.width, plan.height);
  return { x: p.x * plan.width / short, y: p.y * plan.height / short };
}
function distance(project: Project, a: Point, b: Point) {
  const p = physical(project,a), q = physical(project,b);
  return Math.hypot(p.x-q.x,p.y-q.y);
}
function heading(project: Project, from: Point, to: Point) {
  const a=physical(project,from), b=physical(project,to);
  return (Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI+360)%360;
}
const angleDifference = (a: number,b: number) => Math.abs((a-b+540)%360-180);
function intersectsSegment(a: Point,b: Point,c: Point,d: Point) {
  const cross=(p:Point,q:Point,r:Point)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
  const ab1=cross(a,b,c),ab2=cross(a,b,d),cd1=cross(c,d,a),cd2=cross(c,d,b);
  return ab1*ab2<=0&&cd1*cd2<=0&&Math.max(Math.min(a.x,b.x),Math.min(c.x,d.x))<=Math.min(Math.max(a.x,b.x),Math.max(c.x,d.x))+1e-9&&Math.max(Math.min(a.y,b.y),Math.min(c.y,d.y))<=Math.min(Math.max(a.y,b.y),Math.max(c.y,d.y))+1e-9;
}
function rayIntersectsRect(a:Point,b:Point,r:Rect) {
  if(contains(r,a)||contains(r,b))return true;
  const corners=[{x:r.x,y:r.y},{x:r.x+r.width,y:r.y},{x:r.x+r.width,y:r.y+r.height},{x:r.x,y:r.y+r.height}];
  return corners.some((c,i)=>intersectsSegment(a,b,c,corners[(i+1)%4]));
}
function sightBlocked(project:Project,a:Point,b:Point,ignoreId?:string,overview=false):boolean {
  const plan=project.floorPlan!;
  if(!plan.areas.filter(area=>area.kind==='floor').some(area=>areaContainsSegment(area,a,b)))return true;
  for(const structure of plan.structures) {
    if(structure.id===ignoreId||!['wall','pillar'].includes(structure.kind))continue;
    const g=structure.geometry;
    if(g.kind==='segment'&&intersectsSegment(a,b,g.start,g.end))return true;
    if(g.kind==='rect'&&rayIntersectsRect(a,b,g.bounds))return true;
    if(g.kind==='circle') {
      const p=physical(project,a),q=physical(project,b),c=physical(project,g.center),dx=q.x-p.x,dy=q.y-p.y;
      const t=Math.max(0,Math.min(1,((c.x-p.x)*dx+(c.y-p.y)*dy)/(dx*dx+dy*dy||1)));
      if(Math.hypot(c.x-p.x-dx*t,c.y-p.y-dy*t)<=g.radius)return true;
    }
  }
  if(!overview)for(const item of project.elements) {
    if(item.status!=='apply'||item.id===ignoreId)continue;
    const occupied=physicalFloorBounds(project,item);
    if(occupied&&rayIntersectsRect(a,b,occupied))return true;
  }
  return false;
}
export function isRecommendationPositionValid(project:Project,point:Point):boolean {
  if(!project.floorPlan)return false;
  const camera:Camera={id:'recommendation-check',name:'검사',...point,directionDegrees:0,primary:false};
  if(!validateCamera({...project,cameras:[camera]},camera.id).valid)return false;
  return !project.floorPlan.structures.some(structure=>{
    if(structure.clearance&&contains(structure.clearance,point))return true;
    if(structure.kind!=='wall'||structure.geometry.kind!=='segment')return false;
    const a=physical(project,structure.geometry.start),b=physical(project,structure.geometry.end),p=physical(project,point);
    const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));
    return Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t)<CAMERA_RECOMMENDATION.wallMargin;
  });
}
function candidatePoints(project:Project):Point[] {
  const points:Point[]=[];
  for(const floor of project.floorPlan!.areas.filter(area=>area.kind==='floor')) {
    const r=floor.bounds,steps=CAMERA_RECOMMENDATION.gridSteps;
    for(let row=1;row<steps;row++)for(let col=1;col<steps;col++) {
      const point={x:r.x+r.width*col/steps,y:r.y+r.height*row/steps};
      if(areaContainsPoint(floor,point)&&isRecommendationPositionValid(project,point))points.push(point);
    }
  }
  return points.filter((point,index)=>points.findIndex(other=>distance(project,point,other)<.001)===index);
}
function targets(project:Project):{id:string;point:Point}[] {
  const plan=project.floorPlan!;
  const values=project.elements.filter(item=>item.status==='apply').flatMap(item=>{const r=physicalFloorBounds(project,item);return r?[{id:item.id,point:center(r)}]:[]});
  values.push(...plan.areas.filter(area=>area.kind==='spatial').map(area=>({id:area.id,point:center(area.bounds)})));
  if(!values.length) {
    // An empty room's bounding-box centre may be outside a concave outline or
    // inside a pillar. Use a valid interior focus instead of failing all views.
    const valid=candidatePoints(project);
    for(const area of plan.areas.filter(area=>area.kind==='floor')) {
      const point=valid.filter(p=>areaContainsPoint(area,p)).sort((a,b)=>distance(project,a,center(area.bounds))-distance(project,b,center(area.bounds)))[0];
      if(point)values.push({id:area.id,point});
    }
  }
  return values;
}
function visibleTargets(project:Project,position:Point,degrees:number,overview:boolean,focus=targets(project)) {
  return focus.filter(target=>distance(project,position,target.point)>.035&&(overview||angleDifference(heading(project,position,target.point),degrees)<55)&&!sightBlocked(project,position,target.point,target.id,overview)).map(target=>target.id);
}
function openFront(project:Project,position:Point,degrees:number):number {
  const plan=project.floorPlan!,short=Math.min(plan.width,plan.height);
  return [-32,-16,0,16,32].filter(delta=>{
    const a=(degrees+delta)*Math.PI/180,range=CAMERA_RECOMMENDATION.frontDistance;
    const end={x:position.x+Math.cos(a)*range*short/plan.width,y:position.y+Math.sin(a)*range*short/plan.height};
    return !sightBlocked(project,position,end);
  }).length/5;
}
function entryPoint(project:Project):Point {
  const plan=project.floorPlan!;
  const opening=plan.structures.find(item=>item.kind==='entrance'&&item.geometry.kind==='segment')??plan.structures.find(item=>item.kind==='door'&&item.geometry.kind==='segment');
  if(opening?.geometry.kind==='segment')return {x:(opening.geometry.start.x+opening.geometry.end.x)/2,y:(opening.geometry.start.y+opening.geometry.end.y)/2};
  const floor=plan.areas.find(area=>area.kind==='floor')!.bounds;
  return {x:floor.x+floor.width/2,y:floor.y+floor.height};
}
export function recommendCameras(project:Project):Camera[] {
  if(!project.floorPlan?.areas.some(area=>area.kind==='floor'))return [];
  const positions=candidatePoints(project),focus=targets(project),entry=entryPoint(project);
  if(!positions.length)return [];
  type Candidate=Point&{directionDegrees:number;visible:string[];score:number};
  const rank=(preset:'overview'|'entry'|'secondary',other?:Camera):Candidate[]=>positions.flatMap(point=>focus.flatMap(target=>{
    const degrees=heading(project,point,target.point),overview=preset==='overview',visible=visibleTargets(project,point,degrees,overview,focus),front=overview?1:openFront(project,point,degrees);
    const positionDiversity=other?distance(project,point,other):0,angularDiversity=other?angleDifference(degrees,other.directionDegrees):0;
    if(front<.6||!visible.length||other&&(positionDiversity<CAMERA_RECOMMENDATION.minViewDistance||angularDiversity<CAMERA_RECOMMENDATION.minViewAngle))return [];
    const previousVisible=other?visibleTargets(project,other,other.directionDegrees,false,focus):[];
    const different=visible.filter(id=>!previousVisible.includes(id)).length;
    const score=visible.length*1.5+front+different*.7+(preset==='entry'?-distance(project,point,entry)*12:positionDiversity*3)+angularDiversity/180;
    return [{...point,directionDegrees:degrees,visible,score}];
  })).sort((a,b)=>b.score-a.score||a.y-b.y||a.x-b.x);
  const main=rank('entry')[0];if(!main)return [];
  const make=(preset:'overview'|'entry'|'secondary',candidate:Candidate):Camera=>({id:`recommended-${preset}`,x:candidate.x,y:candidate.y,directionDegrees:Math.round(candidate.directionDegrees),...CAMERA_PRESETS[preset],viewPreset:preset,eyeHeightPreset:'custom',recommendation:'automatic',primary:preset==='entry'});
  const primary=make('entry',main),secondary=rank('secondary',primary)[0];
  const overview=rank('overview').find(candidate=>distance(project,candidate,primary)>.08&&(!secondary||distance(project,candidate,secondary)>.08));
  return [overview&&make('overview',overview),primary,secondary&&make('secondary',secondary)].filter((camera):camera is Camera=>!!camera);
}
/** Suggestions prepare once. Preserve manual/legacy cameras and history. On a
 * later layout edit only invalid, untouched automatic positions may recover. */
export function prepareRecommendedCameras(project:Project):Project {
  const needsRecovery=(camera:Camera)=>camera.recommendation==='automatic'&&(!isRecommendationPositionValid(project,camera)||(camera.viewPreset!=='overview'&&openFront(project,camera,camera.directionDegrees)<.6));
  if(project.cameraRecommendationVersion===1&&!project.cameras.some(needsRecovery))return project;
  const proposed=recommendCameras(project);
  if(project.cameraRecommendationVersion===1) {
    let next=project;
    for(const camera of project.cameras) {
      if(!needsRecovery(camera))continue;
      const replacement=proposed.find(item=>item.viewPreset===camera.viewPreset);
      if(replacement)next=updateCamera(next,camera.id,{x:replacement.x,y:replacement.y,directionDegrees:replacement.directionDegrees},true);
    }
    return next;
  }
  if(!proposed.length)return project;
  if(!project.cameras.length)return {...project,cameras:proposed,cameraRecommendationVersion:1};
  const cameras=[...project.cameras];
  for(const camera of proposed) {
    if(cameras.length>=MAX_CAMERAS)break;
    if(cameras.some(existing=>distance(project,existing,camera)<CAMERA_RECOMMENDATION.minViewDistance))continue;
    cameras.push({...camera,id:project.cameras.some(item=>item.id===camera.id)?`${camera.id}-added`:camera.id,primary:false});
  }
  return {...project,cameras,cameraRecommendationVersion:1};
}
