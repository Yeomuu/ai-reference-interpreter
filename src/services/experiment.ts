import type { PlacementTarget, Project } from '../domain'
import { validatePreflight } from '../domain'
import type { Step } from '../app/routes'
import { STEPS } from '../app/routes'
import { textZip } from './zip'
import { countLayoutItems, countReferenceImages } from '../domain/prototypeLimits'
import { MAX_LAYOUT_ITEMS, MAX_REFERENCE_IMAGES } from '../domain/prototypeConfig'

export const EXPERIMENT_KEY = 'ai-reference-interpreter:experiment:v1'
export const SURVEY_QUESTIONS = [
  '원하는 공간 연출 조건을 명확하게 표현할 수 있었다.',
  '어떤 참고 이미지가 어디에 적용되는지 이해하기 쉬웠다.',
  '수정해야 할 부분을 찾기 쉬웠다.',
  '결과를 통제하고 있다고 느꼈다.',
  '작업 과정이 부담스럽지 않았다.',
  '실제 과제에서도 다시 사용할 의향이 있다.',
] as const
type EventResult = 'success' | 'invalid' | 'cancel' | 'failure'
type Payload = Record<string, string | number | boolean | null>
export interface ExperimentEvent {
  event_id: string; participant_id: string; session_id: string; condition: 'structured'; task_set: 'A' | 'B'
  event_name: string; step: string; object_type: string | null; object_id: string | null
  result: EventResult; payload: Payload; ts_client: string; ts_server: null; elapsed_ms: number
}
export interface ExperimentSession {
  schema_version: 1; participant_id: string; session_id: string; condition: 'structured'; task_set: 'A' | 'B'
  project_id: string; started_at: string; completed_at: string | null; consent: true
  events: ExperimentEvent[]; initial_output: unknown; final_output: unknown; survey: (number | null)[]
}
export interface ExperimentState { sessions: ExperimentSession[]; activeId: string | null; fault: string }
const stepNames: Record<Step, string> = { projects: 'projects', space: 'space', keep: 'preservation', references: 'reference', placement: 'placement', camera: 'viewpoint', review: 'review', results: 'result' }
const allowedPayload = new Set(['drag_kind', 'from_step', 'to_step', 'navigation', 'duration_ms', 'structure_type', 'mandatory', 'source', 'role', 'region_used', 'element_type', 'layout_kind', 'target_count', 'apply_state', 'target_type', 'target_id', 'wall_face', 'x_norm', 'y_norm', 'rotation', 'heading_deg', 'fov', 'invalid_reason', 'issue_count', 'common_revision', 'changed_fields', 'origin', 'edit_duration_ms', 'character_count', 'diff_length', 'request_id', 'outcome_unknown', 'approved'])
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
for(const key of ['count','limit','view_preset','height_m','pitch_deg'])allowedPayload.add(key);

/** Final assessment artifact only. Filenames, image pixels/URIs, credentials and browser history are excluded. */
export function assessmentOutput(project: Project) {
  const plan = project.floorPlan
  return {
    workflow_version: project.layoutVersion === 2 ? 'layout-first-v2' : 'reference-first-v1',
    reference_bindings: project.referenceBindings ?? [],
    schema_version: 1, common_revision: project.commonRevision, concept: project.concept,
    floor_plan: plan ? { kind: plan.kind, width: plan.width, height: plan.height, units: plan.units, geometryConfidence: plan.geometryConfidence,
      structures: plan.structures, areas: plan.areas } : null,
    preservation: project.keeps, references: project.references,
    source_roles: project.sourceImages.map(({ id, role, referenceId }) => ({ id, role, referenceId })),
    elements: project.elements, cameras: project.cameras,
    results: project.results.map((result) => ({ id: result.id, camera_id: result.cameraId, origin: result.origin,
      created_at: result.createdAt, common_revision: result.commonRevision, stale: result.stale, approved: result.approved,
      conditions: { keep_ids: result.conditionsSnapshot.keepIds, applied_ids: result.conditionsSnapshot.appliedElementIds,
        excluded_ids: result.conditionsSnapshot.excludedElementIds, camera: result.conditionsSnapshot.camera } })),
  }
}

export function targetPayload(target: PlacementTarget | null): Payload {
  if (!target) return {}
  return { target_type: target.kind,
    ...('x' in target ? { x_norm: target.x, y_norm: target.y, rotation: target.rotationDegrees ?? 0 } : {}),
    ...('wallId' in target ? { target_id: target.wallId, wall_face: target.face ?? null } : {}),
    ...('areaId' in target ? { target_id: target.areaId } : {}),
    ...('zoneId' in target ? { target_id: target.zoneId } : {}),
    ...(target.kind === 'fixture-surface' ? { target_id: target.fixtureElementId, x_norm: target.offset.x, y_norm: target.offset.y } : {}) }
}

/** Local-only, explicit opt-in. The journal is saved on meaningful actions, never pointer frames or keystrokes. */
export class ExperimentRecorder {
  private state: ExperimentState = { sessions: [], activeId: null, fault: '' }
  private listeners = new Set<() => void>()
  private currentStep: Step = 'space'
  private stepStarted = 0
  private reviewAway = false
  private reviewEdited = false
  private blurred = false
  private projectMatches = true
  private cameraEditStart: Project | null = null
  constructor(private storage: Pick<Storage, 'getItem' | 'setItem'>, private now = () => Date.now()) {
    try {
      const raw = storage.getItem(EXPERIMENT_KEY)
      if (raw) {
        const value = JSON.parse(raw) as ExperimentState
        if (!Array.isArray(value.sessions) || value.sessions.length > 100 ||
          !value.sessions.every((s) => s.schema_version === 1 && /^P\d{2,4}$/.test(s.participant_id) && s.condition === 'structured' &&
            ['A', 'B'].includes(s.task_set) && typeof s.session_id === 'string' && typeof s.started_at === 'string' &&
            Array.isArray(s.events) && s.events.length <= 20000 && s.events.every((e) => typeof e.event_name === 'string' && typeof e.elapsed_ms === 'number') &&
            Array.isArray(s.survey) && s.survey.length === SURVEY_QUESTIONS.length) ||
          (value.activeId !== null && !value.sessions.some((s) => s.session_id === value.activeId && !s.completed_at))) throw new Error()
        this.state = { ...value, fault: '' }
      }
    } catch { this.state.fault = '실험 기록을 읽지 못했습니다. 기존 기록을 덮어쓰지 않습니다. 진행자에게 알려 주세요.' }
  }
  getSnapshot = () => this.state
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  get active() { return this.state.sessions.find((s) => s.session_id === this.state.activeId) }
  private publish() { this.state = { ...this.state }; this.listeners.forEach((listener) => listener()) }
  private save() {
    try {
      const json = JSON.stringify({ ...this.state, fault: '' })
      if (json.length > 4_000_000) throw new Error()
      this.storage.setItem(EXPERIMENT_KEY, json)
    } catch { this.state.fault = '실험 기록을 브라우저에 저장하지 못했습니다. 새로고침 전에 ZIP을 받아 진행자에게 전달해 주세요.' }
    this.publish()
  }
  start(participant: string, task: 'A' | 'B', project: Project, step: Step) {
    if (!/^P\d{2,4}$/.test(participant)) throw new Error('이름 대신 P01 형식의 익명 참여 번호를 입력해 주세요.')
    if (this.state.sessions.length >= 100) throw new Error('기록 보관 한도에 도달했습니다. 기존 ZIP을 전달하고 진행자에게 알려 주세요.')
    if (this.active || this.state.fault) throw new Error('진행 중인 기록이나 저장 문제를 먼저 확인해 주세요.')
    const session: ExperimentSession = { schema_version: 1, participant_id: participant, session_id: crypto.randomUUID(), condition: 'structured', task_set: task,
      project_id: project.id, started_at: new Date(this.now()).toISOString(), completed_at: null, consent: true,
      events: [], initial_output: assessmentOutput(project), final_output: null, survey: SURVEY_QUESTIONS.map(() => null) }
    this.state = { ...this.state, sessions: [...this.state.sessions, session], activeId: session.session_id }
    this.currentStep = step; this.stepStarted = this.now(); this.reviewAway = false; this.projectMatches = true
    this.record('experiment_start'); this.record('condition_start'); this.record('step_enter')
    if (step === 'review') this.review(project)
  }
  record(name: string, objectType: string | null = null, objectId: string | null = null, payload: Payload = {}, result: EventResult = 'success') {
    const active = this.active
    if (!active || !this.projectMatches) return
    if (active.events.length >= 20000) { this.state.fault = '실험 이벤트 한도에 도달했습니다. 기록을 종료하고 ZIP을 받아 주세요.'; this.publish(); return }
    const safePayload = Object.fromEntries(Object.entries(payload).filter(([key, value]) => allowedPayload.has(key) &&
      (value === null || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value)) ||
        (typeof value === 'string' && value.length <= 120))))
    const event: ExperimentEvent = { event_id: crypto.randomUUID(), participant_id: active.participant_id, session_id: active.session_id,
      condition: 'structured', task_set: active.task_set, event_name: name, step: stepNames[this.currentStep], object_type: objectType,
      object_id: objectId, result, payload: safePayload, ts_client: new Date(this.now()).toISOString(), ts_server: null,
      elapsed_ms: Math.max(0, this.now() - Date.parse(active.started_at)) }
    active.events.push(event); this.save()
  }
  transition(next: Step, project: Project, navigation: 'ui' | 'history' = 'ui') {
    if (!this.active) return
    const matches = project.id === this.active.project_id
    if (!matches) {
      if (this.projectMatches) { this.record('step_exit', null, null, { duration_ms: this.stepStarted ? Math.max(0, this.now() - this.stepStarted) : 0 }); this.record('project_context_leave') }
      this.projectMatches = false; this.stepStarted = 0
      return
    }
    const returning = !this.projectMatches
    this.projectMatches = true
    const previous = this.currentStep
    if (previous === next && this.stepStarted && !returning) return
    this.record('step_exit', null, null, { duration_ms: this.stepStarted ? Math.max(0, this.now() - this.stepStarted) : 0 })
    if (next !== 'projects' && STEPS.indexOf(next as typeof STEPS[number]) < STEPS.indexOf(previous as typeof STEPS[number])) {
      this.record('back_navigation', null, null, { from_step: stepNames[previous], to_step: stepNames[next], navigation })
    }
    if (previous === 'review' && next !== 'review' && next !== 'results' && next !== 'projects') {
      this.reviewAway = true
      this.reviewEdited = false
      this.record('review_edit_jump', null, null, { to_step: stepNames[next], navigation })
    }
    this.currentStep = next; this.stepStarted = this.now()
    this.record('step_enter', null, null, { from_step: stepNames[previous], navigation })
    if (next === 'review') {
      if (this.reviewAway) this.record('review_return', null, null, { changed_fields: this.reviewEdited ? 'edited' : 'none' })
      this.reviewAway = false; this.review(project)
    }
  }
  resume(step: Step, projectId: string) {
    if (!this.active || this.stepStarted) return
    this.projectMatches = projectId === this.active.project_id
    this.currentStep = step; this.stepStarted = this.now()
    this.record('session_resume', null, null, { duration_ms: Math.max(0, this.now() - Date.parse(this.active.events.at(-1)?.ts_client ?? this.active.started_at)) })
    this.record('step_enter')
  }
  focus(focused: boolean) {
    if (!this.active || this.blurred === !focused) return
    this.blurred = !focused; this.record(focused ? 'window_focus' : 'window_blur')
  }
  beginCameraEdit(project: Project) { if (this.active && !this.cameraEditStart) this.cameraEditStart = project }
  endCameraEdit(project: Project) {
    const before = this.cameraEditStart
    this.cameraEditStart = null
    if (before?.id === project.id) this.changes({ ...project, cameras: before.cameras }, project)
  }
  review(project: Project) {
    this.record('review_open')
    for (const issue of validatePreflight(project).issues) this.record('review_issue_detected', 'condition', issue.elementId ?? issue.structureId ?? null, { invalid_reason: issue.code }, 'invalid')
  }
  changes(before: Project, after: Project) {
    if (!this.active || this.active.project_id !== after.id || before.id !== after.id) return
    if(countLayoutItems(before)<MAX_LAYOUT_ITEMS&&countLayoutItems(after)>=MAX_LAYOUT_ITEMS)this.record('layout_limit_reached','project',after.id,{count:countLayoutItems(after),limit:MAX_LAYOUT_ITEMS});
    if(countReferenceImages(before)<MAX_REFERENCE_IMAGES&&countReferenceImages(after)>=MAX_REFERENCE_IMAGES)this.record('reference_limit_reached','project',after.id,{count:countReferenceImages(after),limit:MAX_REFERENCE_IMAGES});
    if (this.reviewAway && (before.commonRevision !== after.commonRevision || !same(before.cameras, after.cameras))) this.reviewEdited = true
    const previousKeeps = new Set(before.keeps.map((keep) => keep.structureId)), nextKeeps = new Set(after.keeps.map((keep) => keep.structureId))
    for (const id of new Set([...previousKeeps, ...nextKeeps])) {
      if (previousKeeps.has(id) !== nextKeeps.has(id)) this.record(nextKeeps.has(id) ? 'preservation_select' : 'preservation_unselect', 'structure', id,
        { structure_type: after.floorPlan?.structures.find((s) => s.id === id)?.kind ?? '', mandatory: nextKeeps.has(id), source: 'plan' })
    }
    for (const element of after.elements) {
      const old = before.elements.find((e) => e.id === element.id)
      if (!old) {
        this.record('element_create', 'element', element.id, { element_type: element.kind, region_used: !!element.sourceRegion, apply_state: element.status })
        if (element.sourceRegion) this.record('reference_region_select', 'element', element.id, { region_used: true })
        if (element.target) this.record('placement_commit', 'element', element.id, { ...targetPayload(element.target), common_revision: after.commonRevision })
      }
      else {
        if (old.status !== element.status) this.record(element.status === 'apply' ? 'element_apply' : 'element_exclude', 'element', element.id, { apply_state: element.status })
        if (!same(old.sourceRegion, element.sourceRegion)) this.record('reference_region_select', 'element', element.id, { region_used: !!element.sourceRegion })
        if (!same(old.target, element.target)) {
          if (old.target && element.target) this.record('placement_move', 'element', element.id, targetPayload(element.target))
          this.record(element.target ? 'placement_commit' : 'placement_remove', 'element', element.id, { ...targetPayload(element.target), common_revision: after.commonRevision })
        }
      }
    }
    for (const old of before.elements) if (!after.elements.some((e) => e.id === old.id)) {
      this.record('element_remove', 'element', old.id)
      if (old.target) this.record('placement_remove', 'element', old.id)
    }
    for (const ref of after.references) {
      const old = before.references.find((r) => r.id === ref.id)
      if (!old) this.record('reference_add', 'reference', ref.id, { role: ref.role })
      else if (old.role !== ref.role) this.record('reference_role_change', 'reference', ref.id, { role: ref.role })
    }
    for (const old of before.references) if (!after.references.some((r) => r.id === old.id)) this.record('reference_remove', 'reference', old.id)
    for (const camera of this.cameraEditStart ? [] : after.cameras) {
      const old = before.cameras.find((c) => c.id === camera.id)
      const payload = { x_norm: camera.x, y_norm: camera.y, heading_deg: camera.directionDegrees, fov: camera.fovPreset ?? 'standard', view_preset:camera.viewPreset??'custom',height_m:camera.heightMeters??null,pitch_deg:camera.pitchDegrees??null }
      if (!old) { this.record('camera_create', 'camera', camera.id, payload); if(camera.recommendation==='automatic')this.record('camera_recommendation_created','camera',camera.id,payload); }
      else if (!same(old, camera)) {
        if(old.recommendation==='automatic'&&camera.recommendation==='modified')this.record('camera_recommendation_modified','camera',camera.id,payload);
        if (old.x !== camera.x || old.y !== camera.y) this.record('camera_move', 'camera', camera.id, payload)
        if (old.directionDegrees !== camera.directionDegrees) this.record('camera_rotate', 'camera', camera.id, payload)
        this.record('camera_save', 'camera', camera.id, payload)
      }
    }
    for (const structure of after.floorPlan?.structures ?? []) {
      const old = before.floorPlan?.structures.find((s) => s.id === structure.id)
      if (!old) this.record('structure_create', 'structure', structure.id, { structure_type: structure.kind })
      else if (!same(old.geometry, structure.geometry)) this.record('structure_move', 'structure', structure.id, { structure_type: structure.kind })
    }
    for (const area of after.floorPlan?.areas ?? []) if (!before.floorPlan?.areas.some((a) => a.id === area.id)) this.record('area_create', 'area', area.id, { target_type: area.kind })
    for (const old of before.cameras) if (!after.cameras.some((c) => c.id === old.id)) this.record('camera_remove', 'camera', old.id)
    for (const result of after.results) {
      const old = before.results.find((r) => r.id === result.id)
      if (old && !old.stale && result.stale) this.record('result_mark_stale', 'result', result.id)
      if (old && old.approved !== result.approved) this.record('result_approve', 'result', result.id, { approved: result.approved, origin: result.origin })
    }
    if (before.commonRevision !== after.commonRevision) this.record('configuration_commit', 'project', after.id, { common_revision: after.commonRevision,
      changed_fields: ['floorPlan', 'keeps', 'references', 'elements', 'concept', 'sourceImages'].filter((field) => !same(before[field as keyof Project], after[field as keyof Project])).join(',') })
  }
  complete(project: Project) {
    if (!this.active || this.active.project_id !== project.id) throw new Error('기록을 시작한 프로젝트에서 종료해 주세요.')
    this.record('step_exit', null, null, { duration_ms: Math.max(0, this.now() - this.stepStarted) })
    this.record('condition_complete')
    const active = this.active!
    active.completed_at = new Date(this.now()).toISOString(); active.final_output = assessmentOutput(project)
    this.state.activeId = null; this.stepStarted = 0; this.save()
    return active.session_id
  }
  survey(id: string, index: number, score: number) {
    const session = this.state.sessions.find((s) => s.session_id === id)
    if (!session || !session.completed_at || index < 0 || index >= SURVEY_QUESTIONS.length || !Number.isInteger(score) || score < 1 || score > 5) return
    session.survey[index] = score; this.save()
  }
}

export function experimentMetrics(session: ExperimentSession) {
  const counts: Record<string, number> = {}, dwell: Record<string, number> = {}, recovery: number[] = []
  let invalidAt: number | null = null, blurAt: number | null = null, interruptions = 0, unobserved = 0
  const end = session.completed_at ? Date.parse(session.completed_at) - Date.parse(session.started_at) : session.events.at(-1)?.elapsed_ms ?? 0
  for (const event of session.events) {
    counts[event.event_name] = (counts[event.event_name] ?? 0) + 1
    if (event.event_name === 'step_exit') dwell[event.step] = (dwell[event.step] ?? 0) + Number(event.payload.duration_ms ?? 0)
    if (event.event_name === 'session_resume') unobserved += Number(event.payload.duration_ms ?? 0)
    if (event.event_name === 'window_blur' && blurAt === null) blurAt = event.elapsed_ms
    if (event.event_name === 'window_focus' && blurAt !== null) { interruptions += Math.max(0, event.elapsed_ms - blurAt); blurAt = null }
    if (event.event_name === 'placement_invalid' && invalidAt === null) invalidAt = event.elapsed_ms
    if (event.event_name === 'placement_commit' && invalidAt !== null) { recovery.push(Math.max(0, event.elapsed_ms - invalidAt)); invalidAt = null }
  }
  if (blurAt !== null) interruptions += Math.max(0, end - blurAt)
  return { wall_clock_ms: end, interruption_ms: interruptions, unobserved_ms: unobserved, active_ms: Math.max(0, end - interruptions),
    backtrack_count: counts.back_navigation ?? 0, review_correction_loops: session.events.filter((e) => e.event_name === 'review_return' && e.payload.changed_fields === 'edited').length,
    invalid_placement_count: counts.placement_invalid ?? 0, invalid_recovery_ms: recovery, unresolved_invalid: invalidAt !== null,
    revision_count: session.events.filter((e) => e.event_name === 'condition_edit_save' && e.payload.changed_fields !== 'none').length + (counts.placement_commit ?? 0) + (counts.camera_save ?? 0),
    step_dwell_ms: dwell, event_counts: counts, condition_coverage: null, omission_count: null, misconnection_count: null,
    invalid_reason_counts: session.events.filter((e) => e.event_name === 'placement_invalid').reduce<Record<string, number>>((map, e) => { const reason = String(e.payload.invalid_reason ?? 'unknown'); map[reason] = (map[reason] ?? 0) + 1; return map }, {}),
    camera_modification_count: counts.camera_save ?? 0, condition_cancel_ratio: counts.condition_edit_start ? (counts.condition_edit_cancel ?? 0) / counts.condition_edit_start : null,
    assessment_status: 'requires_ground_truth_and_human_coding' }
}

export function csv(rows: (string | number | boolean | null)[][]) {
  return '\uFEFF' + rows.map((row) => row.map((cell) => {
    let value = cell === null ? '' : String(cell)
    if (/^[=+@-]/.test(value)) value = "'" + value
    return '"' + value.replaceAll('"', '""') + '"'
  }).join(',')).join('\r\n')
}

export function experimentFiles(session: ExperimentSession): Record<string, string> {
  const json = (value: unknown) => JSON.stringify(value, null, 2)
  const { events, initial_output, final_output, survey, ...metadata } = session
  const metrics = experimentMetrics(session)
  return {
    'manifest.json': json({ schema_version: 1, exported_at: new Date().toISOString(), session_id: session.session_id, completed: !!session.completed_at,
      storage: 'browser_local', server_timestamps: 'not_collected', images_included: false, condition: 'structured' }),
    'sessions.json': json(metadata),
    'sessions.csv': csv([['participant_id', 'session_id', 'condition', 'task_set', 'started_at', 'completed_at', 'wall_clock_ms', 'interruption_ms'],
      [session.participant_id, session.session_id, session.condition, session.task_set, session.started_at, session.completed_at, metrics.wall_clock_ms, metrics.interruption_ms]]),
    'events.jsonl': events.map((event) => JSON.stringify(event)).join('\n'),
    'events.csv': csv([['event_id', 'participant_id', 'session_id', 'condition', 'task_set', 'event_name', 'step', 'object_type', 'object_id', 'result', 'payload', 'ts_client', 'ts_server', 'elapsed_ms'],
      ...events.map((e) => [e.event_id, e.participant_id, e.session_id, e.condition, e.task_set, e.event_name, e.step, e.object_type, e.object_id, e.result, JSON.stringify(e.payload), e.ts_client, e.ts_server, e.elapsed_ms])]),
    'initial_conditions.json': json(initial_output), 'final_outputs.json': json(final_output), 'metrics.json': json(metrics),
    'surveys.csv': csv([['participant_id', 'session_id', 'item_id', 'question', 'score_1_to_5'],
      ...SURVEY_QUESTIONS.map((question, index) => [session.participant_id, session.session_id, `Q${index + 1}`, question, survey[index]])]),
    'task_ground_truth_template.csv': csv([['task_set', 'condition_id', 'type', 'expected_condition', 'evaluator_id', 'score_0_or_1', 'error_type'], [session.task_set, '', '', '', '', '', '']]),
    'interview_notes_template.csv': csv([['participant_id', 'topic', 'note', 'qualitative_code'], [session.participant_id, '', '', '']]),
    'README.txt': '실험 기록 제출 안내\n이 ZIP을 실험 진행자에게 전달하세요. 브라우저에만 저장되며 서버로 자동 제출되지 않습니다.\n현재 서비스는 structured 조건을 기록합니다. free_text 비교 조건과 교차 배정은 구현되지 않았습니다.\nfinal_outputs.json은 최종 평가용 조건이며 사용자 작성 문장을 포함할 수 있습니다. 이름·학번을 적지 마세요. 원본 이미지·파일명·API 키·접근 코드·매 프레임 좌표·키 입력 이력은 포함하지 않습니다.\n진행자가 실험 전에 task_ground_truth_template.csv를 완성하고 평가자가 필수 조건별 0/1과 오류 유형(omission/wrong_reference/wrong_element/wrong_location/wrong_viewpoint/ambiguous)을 코딩합니다. 자동 계산된 로그 지표가 조건 정확도 점수를 대신하지 않습니다.\nts_server는 서버 수집을 하지 않아 null입니다. 클라이언트 시계와 외부 중단 시간은 별도로 보고하세요. 재접속 사이 시간은 wall_clock_ms에 포함되며 session_resume로 표시됩니다. 완료 전 ZIP은 중간 백업입니다.\n설문 미응답은 빈 칸입니다. 실제 AI 이미지 품질은 생성한 경우에만 별도로 평가하세요.\n',
  }
}
export function exportExperiment(session: ExperimentSession) { return textZip(experimentFiles(session)) }
