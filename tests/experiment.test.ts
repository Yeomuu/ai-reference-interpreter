import { describe, expect, it } from 'vitest'
import { createSampleProject } from '../src/data/sample'
import { updateCommon, updateCamera } from '../src/domain'
import { EXPERIMENT_KEY, ExperimentRecorder, experimentFiles, experimentMetrics, csv } from '../src/services/experiment'
import { textZip } from '../src/services/zip'

function setup(raw: string | null = null) {
  let stored = raw, now = Date.parse('2026-09-28T00:00:00Z')
  const storage = { getItem: () => stored, setItem: (_: string, value: string) => { stored = value } }
  return { recorder: new ExperimentRecorder(storage, () => now), storage, advance: (ms: number) => { now += ms }, getStored: () => stored }
}
describe('opt-in experiment journal', () => {
  it('records nothing before consented start and rejects direct identifiers', () => {
    const { recorder, getStored } = setup()
    recorder.record('step_enter'); expect(getStored()).toBeNull()
    expect(() => recorder.start('홍길동', 'A', createSampleProject(), 'space')).toThrow('익명')
  })
  it('calculates dwell, backtrack, interruption and recovery from meaningful events', () => {
    const { recorder, advance } = setup(), project = createSampleProject()
    recorder.start('P01', 'A', project, 'placement')
    advance(1000); recorder.record('placement_invalid', 'element', 'element-display', { invalid_reason: 'pillar-collision' }, 'invalid')
    advance(500); recorder.focus(false); advance(2000); recorder.focus(true)
    advance(500); recorder.record('placement_commit', 'element', 'element-display')
    recorder.transition('review', project); recorder.transition('references', project, 'history')
    advance(1000); const changed = updateCommon(project, { concept: '수정' }); recorder.changes(project, changed)
    recorder.transition('review', changed); recorder.complete(changed)
    const metrics = experimentMetrics(recorder.getSnapshot().sessions[0])
    expect(metrics.wall_clock_ms).toBe(5000); expect(metrics.interruption_ms).toBe(2000)
    expect(metrics.invalid_recovery_ms).toEqual([3000]); expect(metrics.backtrack_count).toBe(1)
    expect(metrics.review_correction_loops).toBe(1); expect(metrics.condition_coverage).toBeNull()
  })
  it('keeps saved logs on reload and excludes raw image filenames and secrets from exports', () => {
    const setupState = setup(), project = createSampleProject()
    project.sourceImages[0].name = '홍길동-원본사진.jpg'
    project.sourceImages[0].uri = 'asset://private-original'
    setupState.recorder.start('P02', 'B', project, 'camera')
    setupState.recorder.record('test', null, null, { api_key: 'secret', arbitrary_text: '홍길동', x_norm: .3 })
    const changed = updateCamera(project, project.cameras[0].id, { directionDegrees: 135 })
    setupState.recorder.changes(project, changed)
    const restored = new ExperimentRecorder(setupState.storage)
    expect(restored.active?.participant_id).toBe('P02')
    restored.complete(changed)
    const files = experimentFiles(restored.getSnapshot().sessions[0]), all = JSON.stringify(files)
    expect(all).not.toContain('홍길동'); expect(all).not.toContain('private-original'); expect(all).not.toContain('secret')
    expect(all).not.toContain('imageUri'); expect(files['events.jsonl']).toContain('camera_rotate')
    expect(files['final_outputs.json']).toContain('135')
  })
  it('preserves malformed stored data and makes a failed save visible', () => {
    const { recorder, getStored } = setup('{broken')
    expect(recorder.getSnapshot().fault).toContain('덮어쓰지')
    expect(() => recorder.start('P01', 'A', createSampleProject(), 'space')).toThrow()
    expect(getStored()).toBe('{broken')
    const failing = new ExperimentRecorder({ getItem: () => null, setItem: () => { throw new Error('full') } })
    failing.start('P01', 'A', createSampleProject(), 'space')
    expect(failing.getSnapshot().fault).toContain('ZIP')
    expect(failing.active?.events.length).toBe(3)
    expect(EXPERIMENT_KEY).toContain(':v1')
  })
  it('does not mix actions from another project or fabricate a correction loop', () => {
    const { recorder } = setup(), project = createSampleProject()
    recorder.start('P01', 'A', project, 'review')
    recorder.transition('placement', project); recorder.transition('review', project)
    recorder.transition('references', { ...project, id: 'other' }); recorder.record('reference_select', 'reference', 'other')
    recorder.transition('review', project); recorder.complete(project)
    const session = recorder.getSnapshot().sessions[0]
    expect(session.events.some((e) => e.object_id === 'other')).toBe(false)
    expect(experimentMetrics(session).review_correction_loops).toBe(0)
  })
  it('counts a continuous camera direction gesture once rather than every slider update', () => {
    const { recorder } = setup(), project = createSampleProject()
    recorder.start('P01', 'A', project, 'camera'); recorder.beginCameraEdit(project)
    const first = updateCamera(project, project.cameras[0].id, { directionDegrees: 120 })
    const final = updateCamera(first, project.cameras[0].id, { directionDegrees: 150 })
    recorder.changes(project, first); recorder.changes(first, final); recorder.endCameraEdit(final)
    recorder.complete(final)
    expect(experimentMetrics(recorder.getSnapshot().sessions[0]).camera_modification_count).toBe(1)
  })
  it('records the committed target when an element is created with its location already assigned', () => {
    const { recorder } = setup(), project = createSampleProject()
    recorder.start('P03', 'B', project, 'references')
    const mapped = { ...project.elements[1], id: 'new-scoped-light', target: { kind: 'named-area' as const, areaId: 'zone-rear' } }
    const changed = updateCommon(project, { elements: [...project.elements, mapped] })
    recorder.changes(project, changed)
    recorder.complete(changed)
    const events = recorder.getSnapshot().sessions[0].events.filter(event => event.object_id === mapped.id)
    expect(events.map(event => event.event_name)).toEqual(['element_create', 'placement_commit'])
    expect(events[1].payload).toMatchObject({ target_type: 'named-area', target_id: 'zone-rear' })
  })
  it('escapes spreadsheet formulas and emits a ZIP with UTF-8 file flags', async () => {
    expect(csv([['=CMD()', '정상']])).toContain("'=CMD()")
    const bytes = new Uint8Array(await textZip({ 'events.csv': '한글\n', 'manifest.json': '{}' }).arrayBuffer())
    const view = new DataView(bytes.buffer)
    expect(view.getUint32(0, true)).toBe(0x04034b50)
    expect(view.getUint16(6, true)).toBe(0x0800)
    expect(view.getUint32(bytes.length - 22, true)).toBe(0x06054b50)
    expect(() => textZip({ '../secret.txt': 'no' })).toThrow()
  })
})
