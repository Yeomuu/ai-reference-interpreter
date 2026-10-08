import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { STUDY_START } from '../domain/studyStart';
import type { StudyProjectDetails } from '../domain/studyStart';
import NucleoIcon from './NucleoIcon';

export default function WelcomeScreen({ onPrepare, onEnter, library }: {
  onPrepare: (participant: string, details: StudyProjectDetails, edited: (keyof StudyProjectDetails)[]) => boolean;
  onEnter: () => void;
  library: ReactNode;
}) {
  const [participant, setParticipant] = useState('');
  const [projectName, setProjectName] = useState(STUDY_START.projectName);
  const [spaceType, setSpaceType] = useState(STUDY_START.spaceType);
  const editedFields = useRef(new Set<keyof StudyProjectDetails>());
  const [entering, setEntering] = useState(false);
  const illustration = useRef<HTMLDivElement>(null);
  const libraryDialog = useRef<HTMLDialogElement>(null);
  const timer = useRef<number | null>(null);
  const submitting = useRef(false);
  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current); }, []);
  const ready = !!projectName.trim() && !!spaceType.trim() && STUDY_START.participantPattern.test(participant.trim());
  function start(event: FormEvent) {
    event.preventDefault();
    if (!ready || submitting.current) return;
    submitting.current = true;
    if (!onPrepare(participant.trim(), { projectName, spaceType }, [...editedFields.current])) { submitting.current = false; return; }
    setEntering(true);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    timer.current = window.setTimeout(onEnter, reduced ? 0 : 720);
  }
  return <div className={`welcome ${entering ? 'is-entering' : ''}`} aria-busy={entering || undefined}>
    <section className="welcome-art" aria-labelledby="welcome-heading" onPointerMove={event => {
      if (!illustration.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      illustration.current.style.setProperty('--pointer-x', `${(event.clientX - bounds.left) / bounds.width * 2 - 1}`);
      illustration.current.style.setProperty('--pointer-y', `${(event.clientY - bounds.top) / bounds.height * 2 - 1}`);
    }} onPointerLeave={() => { illustration.current?.style.setProperty('--pointer-x', '0'); illustration.current?.style.setProperty('--pointer-y', '0'); }}>
      <div className="welcome-art__parallax" ref={illustration}><img className="welcome-art__image" src="/brand/home-spatial-collage.png" alt="공간 사진과 평면도, 레퍼런스가 공간 구상으로 연결되는 일러스트" /></div>
      <h1 id="welcome-heading"><strong>공간의 가능성</strong>을<br /><strong>새롭게</strong> 그려보세요.</h1>
    </section>
    <section className="welcome-panel" aria-label="프로젝트 시작">
      <div className="welcome-panel__surface" aria-hidden="true" />
      <form className="welcome-form" onSubmit={start}>
        <div className="welcome-title"><span className="welcome-wordmark">ReSpace</span><p>From <span>Re</span>ference to <span>Space</span></p></div>
        <label className="welcome-field welcome-field--project"><span>프로젝트 이름</span><input name="projectName" value={projectName} onChange={event => { setProjectName(event.target.value); editedFields.current.add('projectName'); }} required disabled={entering} /></label>
        <label className="welcome-field welcome-field--space"><span>공간 유형</span><input name="spaceType" value={spaceType} onChange={event => { setSpaceType(event.target.value); editedFields.current.add('spaceType'); }} required disabled={entering} /></label>
        <label className="welcome-field welcome-field--participant"><span>참가자 번호</span><input name="participant" placeholder="예: P01" value={participant} onChange={event => setParticipant(event.target.value.toUpperCase())} pattern="P[0-9]{2,4}" maxLength={5} autoComplete="off" spellCheck={false} required disabled={entering} aria-describedby="participant-help study-start-notice" /></label>
        <div className="welcome-guidance"><NucleoIcon name="info" /><div><p>교내 프로젝트룸을 졸업전시 공간으로 바꾸어보세요.</p><p>제공된 공간 자료와 레퍼런스 이미지로 원하는 공간을 자유롭게 구성할 수 있습니다.</p></div></div>
        <p id="study-start-notice" className="welcome-study-notice">시작하면 익명 참가자 번호와 편집 기록이 이 브라우저에 저장됩니다. 기록은 실험 기록 메뉴에서 종료·내보낼 수 있습니다.</p>
        <button className="button button-primary welcome-start" type="submit" disabled={!ready || entering}>{entering ? '프로젝트 여는 중' : '프로젝트 시작하기'}</button>
        <div className="welcome-form__footer"><span id="participant-help">이름·학번 대신 P01 형식으로 입력하세요.</span><button type="button" className="button button-quiet" onClick={() => libraryDialog.current?.showModal()} disabled={entering}>저장한 프로젝트·다른 공간</button></div>
      </form>
    </section>
    <dialog ref={libraryDialog} className="project-library" aria-labelledby="library-title"><div className="project-library__header"><h2 id="library-title">프로젝트 목록</h2><button type="button" className="button button-quiet" onClick={() => libraryDialog.current?.close()} aria-label="프로젝트 목록 닫기"><NucleoIcon name="close" /></button></div><div className="project-library__content">{library}</div></dialog>
  </div>;
}
