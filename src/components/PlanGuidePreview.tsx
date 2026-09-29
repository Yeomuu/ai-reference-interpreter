import { useEffect, useState } from 'react';
import type { Project } from '../domain/types';
import { preparePlanGuideImage } from '../services/imageProvider';

export default function PlanGuidePreview({ project, cameraId }: { project: Project; cameraId: string }) {
  const [image, setImage] = useState('');
  const [error, setError] = useState('');
  const input = JSON.stringify({ ...project, results: [] });
  useEffect(() => {
    let active = true;
    setImage(''); setError('');
    preparePlanGuideImage(JSON.parse(input) as Project, cameraId).then(value => { if (active) setImage(value); })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : '저장된 도면을 불러오지 못했습니다.'); });
    return () => { active = false; };
  }, [input, cameraId]);
  return <figure className="plan-guide-preview">{image ? <img src={image} alt="이 결과의 저장된 구조·배치와 시선 방향 도면" /> : <p role="status">{error || '배치 도면 준비 중…'}</p>}<figcaption>저장된 2D 배치 기록입니다. 결과의 벽·기둥·진열대 위치와 시선 방향을 대조해 주세요. 자동 일치 판정은 제공하지 않습니다.</figcaption></figure>;
}
