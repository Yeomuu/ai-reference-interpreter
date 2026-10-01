import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCampusProject } from '../src/data/campus';
import { createSampleProject } from '../src/data/sample';
import { isRecommendationPositionValid, migrateCameraPresets, prepareRecommendedCameras, recommendCameras } from '../src/domain/cameraRecommendations';
import { CAMERA_RECOMMENDATION, CAMERA_EYE_HEIGHT_PRESETS } from '../src/domain/prototypeConfig';
import { createLayoutItem } from '../src/domain/layoutMapping';
import { createConditionsSnapshot, updateCamera, updateCommon } from '../src/domain/revisions';
import { isProject, loadProjects, saveProject } from '../src/services/persistence';
import { buildGenerationPrompt } from '../src/services/generationContract';
import type { Project } from '../src/domain/types';
import { validateStructureDrawing } from '../src/domain/validation';

afterEach(()=>vi.unstubAllGlobals());
function room():Project {const sample=createSampleProject();return {...sample,cameras:[],elements:[],results:[]};}
describe('floor-plan camera suggestions and compatible presets',()=>{
  it('prepares overview/entry/secondary on the fresh school scenario without a mandatory camera edit',()=>{
    const before=createCampusProject('exhibition');expect(before.cameras).toHaveLength(0);
    const next=prepareRecommendedCameras(before);
    expect(next.cameras.map(camera=>camera.viewPreset)).toEqual(['overview','entry','secondary']);
    expect(next.cameras.every(camera=>isRecommendationPositionValid(next,camera))).toBe(true);
    expect(next.cameras.filter(camera=>camera.primary)).toHaveLength(1);
    expect(prepareRecommendedCameras(next)).toBe(next);
    expect(before.cameras).toHaveLength(0);
  });
  it('uses distinct positions and headings, with a high overview and two eye-level suggestions',()=>{
    const next=prepareRecommendedCameras(room()),entry=next.cameras.find(c=>c.viewPreset==='entry')!,secondary=next.cameras.find(c=>c.viewPreset==='secondary')!;
    const plan=next.floorPlan!,short=Math.min(plan.width,plan.height);
    expect(Math.hypot((entry.x-secondary.x)*plan.width/short,(entry.y-secondary.y)*plan.height/short)).toBeGreaterThanOrEqual(CAMERA_RECOMMENDATION.minViewDistance);
    expect(Math.abs((entry.directionDegrees-secondary.directionDegrees+540)%360-180)).toBeGreaterThanOrEqual(CAMERA_RECOMMENDATION.minViewAngle-1);
    expect(next.cameras[0].pitchDegrees).toBeLessThan(0);
    expect(next.cameras[0].heightMeters).toBeGreaterThan(entry.heightMeters!);
  });
  it('avoids furniture, pillar, partition and doorway clearance',()=>{
    const project=room();project.elements=[{...createLayoutItem(project,'large-display','display'),target:{kind:'floor-point',x:.5,y:.75,footprint:{width:.2,height:.12}}}];
    project.floorPlan!.structures.push({id:'obstacle',name:'입구 앞 가벽',kind:'wall',role:'partition',protected:false,geometry:{kind:'segment',start:{x:.35,y:.7},end:{x:.65,y:.7}}});
    const cameras=recommendCameras(project);expect(cameras).toHaveLength(3);
    expect(cameras.every(camera=>isRecommendationPositionValid(project,camera))).toBe(true);
    const primary=cameras.find(camera=>camera.primary)!;
    expect(primary.x<.35||primary.x>.65||primary.y<.7).toBe(true);
    expect(primary.x===.5&&primary.y===.8).toBe(false);
    expect(isRecommendationPositionValid(project,{x:.5,y:.75})).toBe(false);
    expect(isRecommendationPositionValid(project,{x:.5,y:.7})).toBe(false);
  });
  it('handles concave portrait floor geometry and a blocked bounding-box centre',()=>{
    const project=room();project.floorPlan={kind:'schematic',width:600,height:1200,units:'unknown',geometryConfidence:'schematic',structures:[{id:'middle-pillar',name:'기둥',kind:'pillar',protected:true,geometry:{kind:'rect',bounds:{x:.20,y:.30,width:.08,height:.08}}}],areas:[{id:'l-floor',name:'사용 바닥',kind:'floor',bounds:{x:.1,y:.1,width:.8,height:.8},outline:[{x:.1,y:.1},{x:.4,y:.1},{x:.4,y:.6},{x:.9,y:.6},{x:.9,y:.9},{x:.1,y:.9}]}]};
    project.keeps=[];
    const cameras=recommendCameras(project);expect(cameras).toHaveLength(3);
    expect(cameras.every(camera=>isRecommendationPositionValid(project,camera))).toBe(true);
  });
  it('returns no invented camera when no floor or valid observer position exists',()=>{
    const project=room();project.floorPlan!.areas=[];expect(recommendCameras(project)).toEqual([]);
    expect(prepareRecommendedCameras(project)).toBe(project);
  });
  it('migrates legacy cameras additively, preserving geometry, names, primary flags and saved results',()=>{
    const before=createSampleProject(),snapshot=structuredClone(before.results),positions=before.cameras.map(({id,name,x,y,directionDegrees,primary})=>({id,name,x,y,directionDegrees,primary}));
    const next=migrateCameraPresets(before);
    expect(next.cameras.map(({id,name,x,y,directionDegrees,primary})=>({id,name,x,y,directionDegrees,primary}))).toEqual(positions);
    expect(next.results).toEqual(snapshot);expect(next.cameras[0]).toMatchObject({viewPreset:'custom',eyeHeightPreset:'custom',heightMeters:1.6,pitchDegrees:0});
    expect(migrateCameraPresets(next)).toBe(next);expect(isProject(next)).toBe(true);
  });
  it('preserves explicit custom and partially saved overview values during migration',()=>{
    const project=room();project.cameras=[{id:'old-overview',name:'내 전체 시점',x:.7,y:.4,directionDegrees:90,primary:true,viewPreset:'overview',heightMeters:4.5}];
    const camera=migrateCameraPresets(project).cameras[0];
    expect(camera).toMatchObject({heightMeters:4.5,pitchDegrees:-45,viewPreset:'overview'});
  });
  it('changes optional eye-height on the same camera, preserves historical height and stales only that view',()=>{
    const project=prepareRecommendedCameras(room()),entry=project.cameras.find(c=>c.primary)!;
    const snapshot=createConditionsSnapshot(project,entry.id)!;
    project.results=[{id:'result',cameraId:entry.id,createdAt:new Date().toISOString(),imageUri:'/sample/result.png',origin:'sample',commonRevision:project.commonRevision,stale:false,approved:false,conditionsSnapshot:snapshot}];
    const changed=updateCamera(project,entry.id,{eyeHeightPreset:'average-female',heightMeters:CAMERA_EYE_HEIGHT_PRESETS['average-female'].heightMeters});
    expect(changed.cameras).toHaveLength(3);expect(changed.cameras.find(c=>c.id===entry.id)).toMatchObject({x:entry.x,y:entry.y,recommendation:'modified'});
    expect(changed.results[0].stale).toBe(true);expect(changed.results[0].conditionsSnapshot.camera.heightMeters).toBe(entry.heightMeters);
    expect(isProject(changed)).toBe(true);
  });
  it('preserves user camera edits/deletion after recommendation and reload',()=>{
    let stored:string|null=null;vi.stubGlobal('localStorage',{getItem:()=>stored,setItem:(_key:string,value:string)=>{stored=value;}});
    const project=prepareRecommendedCameras(room()),entry=project.cameras.find(c=>c.primary)!;
    const changed=updateCamera(project,entry.id,{directionDegrees:entry.directionDegrees+10});
    const removed={...changed,cameras:changed.cameras.filter(camera=>camera.viewPreset!=='overview')};
    expect(()=>saveProject(removed)).not.toThrow();
    const restored=loadProjects().find(item=>item.id===removed.id)!;
    expect(prepareRecommendedCameras(restored).cameras).toEqual(restored.cameras);
    expect(restored.cameras).toHaveLength(2);
  });
  it('recovers an untouched automatic position after a layout edit and retains its ID',()=>{
    const project=prepareRecommendedCameras(room()),entry=project.cameras.find(c=>c.primary)!;
    const obstacle={...createLayoutItem(project,'new-block','display'),target:{kind:'floor-point' as const,x:entry.x,y:entry.y,footprint:{width:.06,height:.06}}};
    const changed=updateCommon(project,{elements:[obstacle]}),next=prepareRecommendedCameras(changed);
    const recovered=next.cameras.find(camera=>camera.id===entry.id)!;
    expect(isRecommendationPositionValid(next,recovered)).toBe(true);
    expect(recovered.recommendation).toBe('automatic');
    expect(recovered.x!==entry.x||recovered.y!==entry.y).toBe(true);
  });
  it('allows layout edits over provisional hidden recommendations, retaining collision checks for manual cameras',()=>{
    const project=prepareRecommendedCameras(createCampusProject('exhibition')),entry=project.cameras.find(c=>c.primary)!;
    const pillar={id:'new-pillar',name:'새 기둥',kind:'pillar' as const,protected:false,geometry:{kind:'rect' as const,bounds:{x:entry.x-.015,y:entry.y-.015,width:.03,height:.03}}};
    expect(validateStructureDrawing(project,pillar).issues.some(issue=>issue.cameraId===entry.id)).toBe(false);
    const manual={...project,cameras:project.cameras.map(camera=>camera.id===entry.id?{...camera,recommendation:'modified' as const}:camera)};
    expect(validateStructureDrawing(manual,pillar).issues.some(issue=>issue.cameraId===entry.id)).toBe(true);
  });
  it('passes the actual saved overview height/pitch to generation without promising surveyed geometry',()=>{
    const project=prepareRecommendedCameras(room()),overview=project.cameras.find(c=>c.viewPreset==='overview')!;
    const prompt=buildGenerationPrompt(project,overview.id,[]);
    expect(prompt).toContain('elevated oblique overview');expect(prompt).toContain('3.2');expect(prompt).toContain('-45');
  });
});
