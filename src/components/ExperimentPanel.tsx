import { useState, useSyncExternalStore } from 'react'
import type { Project } from '../domain'
import type { Step } from '../app/routes'
import { ExperimentRecorder, exportExperiment, SURVEY_QUESTIONS } from '../services/experiment'
import TimedNotice from './TimedNotice'
import './experiment-panel.css'

export default function ExperimentPanel({ recorder, project, step }: { recorder: ExperimentRecorder; project: Project; step: Step }) {
  const state = useSyncExternalStore(recorder.subscribe, recorder.getSnapshot)
  const [participant, setParticipant] = useState(''), [task, setTask] = useState<'A' | 'B'>('A')
  const [consent, setConsent] = useState(false), [error, setError] = useState(''), [selectedId, setSelectedId] = useState('')
  const active = state.sessions.find((session) => session.session_id === state.activeId)
  const selected = state.sessions.find((session) => session.session_id === selectedId) ?? state.sessions.at(-1)
  function download() {
    if (!selected) return
    try {
      const uri = URL.createObjectURL(exportExperiment(selected)), anchor = document.createElement('a')
      anchor.href = uri; anchor.download = `${selected.participant_id}_${selected.task_set}_${selected.session_id.slice(0, 8)}.zip`
      anchor.click(); window.setTimeout(() => URL.revokeObjectURL(uri), 1000)
    } catch { setError('ZIP 파일을 준비하지 못했습니다. 탭을 유지하고 진행자에게 알려 주세요.') }
  }
  return <details className="experiment-panel"><summary>실험 기록 {active ? `· ${active.participant_id} · 과업 ${active.task_set} 기록 중` : '· 선택 사항'}</summary><div className="experiment-panel__content">
    <p className="muted small">진행자가 안내한 경우에만 시작하세요. 익명 번호, 단계 이동·수정·오류와 최종 조건을 이 브라우저에 저장합니다. 원본 이미지와 API 키는 제출 파일에 포함되지 않습니다. 이름·학번을 작업 내용에 적지 마세요.</p>
    <p className="experiment-panel__guide small">과업 A·B는 진행자가 배정한 서로 다른 자료 묶음의 이름입니다. 선택만으로 사진·도면이나 기능이 바뀌지 않습니다. <a href="/guide/index.html#experiment" target="_blank" rel="noopener noreferrer">실험 참여 가이드 열기</a></p>
    {(state.fault || error) && <TimedNotice lifetimeKey={state.fault || error} role="alert" className="experiment-panel__error" onDismiss={()=>setError('')}><span>{state.fault || error}</span></TimedNotice>}
    {state.fault && <p className="muted small">실험 기록을 저장할 수 없어 기록 시작이 중단됐습니다. 탭을 유지하고 진행자에게 알려 주세요.</p>}
    {active ? <div className="experiment-panel__actions"><p>{project.id !== active.project_id || step === 'projects' ? '기록을 시작한 프로젝트를 열어 과업을 종료해 주세요.' : '종료 후 설문에 응답하고 ZIP을 받아 진행자에게 전달하세요.'}</p><button className="button button-secondary" disabled={project.id !== active.project_id || step === 'projects'} onClick={() => {
      try { setSelectedId(recorder.complete(project)); setError('') } catch (cause) { setError(cause instanceof Error ? cause.message : '종료하지 못했습니다.') }
    }}>과업 종료</button></div> : <form className="experiment-panel__start" onSubmit={(event) => {
      event.preventDefault(); if (!consent) return
      try { recorder.start(participant.trim().toUpperCase(), task, project, step); setSelectedId(recorder.active?.session_id ?? ''); setError('') } catch (cause) { setError(cause instanceof Error ? cause.message : '시작하지 못했습니다.') }
    }}>
      <label className="field"><span>익명 참여 번호</span><input value={participant} maxLength={5} placeholder="P01" pattern="[Pp][0-9]{2,4}" required onChange={(event) => setParticipant(event.target.value)} /></label>
      <label className="field"><span>진행자가 지정한 과업</span><select value={task} onChange={(event) => setTask(event.target.value as 'A' | 'B')}><option value="A">과업 A</option><option value="B">과업 B</option></select></label>
      <label className="checkbox-row"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>안내받은 기록 수집에 동의합니다.</span></label>
      <button type="submit" className="button button-secondary" disabled={!consent || !!state.fault || step === 'projects'}>이 프로젝트 기록 시작</button>
    </form>}
    {selected && <div className="experiment-panel__export"><label className="field"><span>받을 기록</span><select value={selected.session_id} onChange={(event) => setSelectedId(event.target.value)}>{state.sessions.map((session) => <option key={session.session_id} value={session.session_id}>{session.participant_id} · 과업 {session.task_set} · {session.completed_at ? '완료' : '진행 중'} · {new Date(session.started_at).toLocaleString('ko-KR')}</option>)}</select></label>
      <button className="button button-secondary" onClick={download}>실험 기록 ZIP 받기{selected.completed_at ? '' : ' · 중간 백업'}</button>
      <p className="muted small">로그 JSONL·CSV, 시간·수정 지표, 최종 조건 JSON, 설문, 평가 기준·인터뷰 양식을 포함합니다. 서버로 자동 제출되지 않습니다.</p>
      {selected.completed_at && <fieldset className="experiment-survey"><legend>과업 직후 설문 · 1 전혀 그렇지 않다 — 5 매우 그렇다</legend>{SURVEY_QUESTIONS.map((question, index) => <label className="field" key={question}><span>{question}</span><select value={selected.survey[index] ?? ''} onChange={(event) => recorder.survey(selected.session_id, index, Number(event.target.value))}><option value="" disabled>응답 선택</option>{[1, 2, 3, 4, 5].map((score) => <option key={score} value={score}>{score}</option>)}</select></label>)}<p className="muted small">설문을 마친 뒤 ZIP을 다시 받으세요. 미응답은 빈 칸입니다.</p></fieldset>}
    </div>}
  </div></details>
}
