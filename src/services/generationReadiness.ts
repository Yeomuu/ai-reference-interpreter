import type { Project } from '../domain/types';
import { validatePreflight } from '../domain/validation';
import type { GenerationPreparationState, GenerationStatus } from './imageProvider';

/** Review status, button and click handler share this one readiness result. */
export function generationReadiness(input:{project:Project;cameraIds:string[];existingPhotoId?:string;preparation:GenerationPreparationState|null;key:string;status:GenerationStatus|null;statusLoading:boolean;busy:boolean;saveFailed:boolean;outcomeUnknown:boolean}):{ready:boolean;waiting:boolean;title:string;message:string} {
  const blocked=(message:string)=>({ready:false,waiting:false,title:'생성 전에 확인해 주세요',message});
  const waiting=(title:string,message:string)=>({ready:false,waiting:true,title,message});
  if(input.busy)return waiting('AI 이미지를 생성하고 있습니다','선택한 시점의 결과를 기다려 주세요.');
  if(input.saveFailed)return blocked('저장 문제를 해결하고 다시 저장해 주세요.');
  if(input.outcomeUnknown)return blocked('이전 생성 요청의 결과와 사용량 확인이 필요합니다.');
  if(!input.cameraIds.length)return blocked('생성할 시점을 하나 이상 선택해 주세요.');
  const issue=input.cameraIds.flatMap(id=>validatePreflight(input.project,id).issues).find(i=>i.severity==='error');
  if(issue)return blocked(issue.message);
  if(!input.existingPhotoId)return blocked('생성 기준 기존 공간 사진을 선택해 주세요.');
  if(input.statusLoading||!input.status)return waiting('생성 가능 여부를 확인하고 있습니다','서버와 남은 생성 횟수를 확인하고 있습니다.');
  if(!input.status.available)return blocked(input.status.reason??'AI 생성 서버가 준비되지 않았습니다.');
  const quota=input.status.quota;
  if(!quota)return blocked('남은 생성 횟수를 확인하지 못했습니다. 생성 가능 여부를 다시 확인해 주세요.');
  if(quota?.busy)return waiting('다른 생성 요청이 처리 중입니다','처리가 끝나면 생성 가능 여부를 다시 확인해 주세요.');
  if(quota&&input.cameraIds.length>Math.min(quota.remaining,quota.dailyRemaining))return blocked('선택한 시점 수보다 남은 생성 횟수가 적습니다.');
  if(input.preparation?.key===input.key&&input.preparation.state==='error')return blocked(input.preparation.error??'입력 이미지와 조건을 준비하지 못했습니다.');
  if(!input.key||input.preparation?.key!==input.key||input.preparation.state!=='ready')return waiting('생성 자료를 준비하고 있습니다','공간 사진·레퍼런스·도면과 생성 조건을 확인하고 있습니다.');
  if(input.cameraIds.some(id=>!input.preparation!.requests.some(request=>request.request.cameraId===id)))return blocked('선택한 시점의 생성 자료를 확인해 주세요.');
  return {ready:true,waiting:false,title:'필수 조건이 준비되었습니다',message:'사진·레퍼런스·도면의 준비가 끝났습니다. 선택한 시점으로 생성할 수 있습니다.'};
}
