import { describe,expect,it } from 'vitest';
import {createSampleProject} from '../src/data/sample';
import {generationReadiness} from '../src/services/generationReadiness';
import {generationPreparationKey,type GenerationPreparationState,type GenerationStatus} from '../src/services/imageProvider';

function fixture(){
 const project=createSampleProject(),cameraIds=['camera-entrance'],existingPhotoId='photo-existing',key=generationPreparationKey(project,cameraIds,existingPhotoId);
 const preparation:GenerationPreparationState={key,state:'ready',requests:[{key,request:{project,cameraId:cameraIds[0],images:[]},serialized:''}]};
 const status:GenerationStatus={available:true,requiresAccessCode:false,model:'gpt-image-2',quality:'high',size:'1536x1024',outputPriceUsd:null,pricingNote:'',quota:{totalLimit:60,used:0,remaining:60,dailyLimit:20,dailyRemaining:20,busy:false}};
 return {project,cameraIds,existingPhotoId,key,preparation,status,statusLoading:false,busy:false,saveFailed:false,outcomeUnknown:false};
}
describe('generation ready state shared with the action',()=>{
 it('is green only after actual image/condition preparation and retains history-neutral cache keys',()=>{
  const f=fixture();expect(generationReadiness(f).ready).toBe(true);
  expect(generationReadiness({...f,preparation:null})).toMatchObject({ready:false,waiting:true});
  expect(generationReadiness({...f,preparation:{...f.preparation,state:'preparing'}}).ready).toBe(false);
  expect(generationPreparationKey({...f.project,results:[]},f.cameraIds,f.existingPhotoId)).toBe(f.key);
  const project=structuredClone(f.project);project.cameras.push({...project.cameras[0],id:'unselected-view',primary:false,x:0,y:0});
  expect(generationReadiness({...f,project}).ready).toBe(true);
 });
 it('does not show green for missing assets, a stale prepared request, or a camera without prepared input',()=>{
  const f=fixture();expect(generationReadiness({...f,preparation:{...f.preparation,state:'error',error:'원본 이미지 없음'}})).toMatchObject({ready:false,message:'원본 이미지 없음'});
  expect(generationReadiness({...f,key:'changed'}).ready).toBe(false);
  expect(generationReadiness({...f,preparation:{...f.preparation,requests:[]}}).ready).toBe(false);
  expect(generationPreparationKey({...f.project,designGoal:'변경한 의도'},f.cameraIds,f.existingPhotoId)).not.toBe(f.key);
 });
 it('does not show green for quota, server, preservation/placement, saving or uncertain outcomes',()=>{
  const f=fixture();
  for(const state of [{busy:true},{saveFailed:true},{outcomeUnknown:true},{statusLoading:true},{existingPhotoId:undefined},{cameraIds:[]}])expect(generationReadiness({...f,...state}).ready).toBe(false);
  expect(generationReadiness({...f,status:{...f.status,available:false}}).ready).toBe(false);
  expect(generationReadiness({...f,status:{...f.status,quota:undefined}}).ready).toBe(false);
  expect(generationReadiness({...f,status:{...f.status,quota:{...f.status.quota!,remaining:0}}}).ready).toBe(false);
  expect(generationReadiness({...f,status:{...f.status,quota:{...f.status.quota!,busy:true}}}).ready).toBe(false);
  const project=structuredClone(f.project);project.elements[0].target={kind:'floor-point',x:0,y:0};expect(generationReadiness({...f,project}).ready).toBe(false);
 });
});
