import { afterEach, describe, expect, it, vi } from 'vitest';
import { createStudyProject, BASELINE_STRUCTURE_IDS, STUDY_START } from './studyStart';
import { createCampusProject } from '../data/campus';
import { createConditionsSnapshot, removeKeep, setKeeps, setStructurePreservation, updateCommon } from './revisions';
import { moveStructure, reshapeStructure } from './structureEditing';
import { validatePlacement, validateStructureOperation } from './validation';
import { isProject, loadProjects, saveProject } from '../services/persistence';
import { buildGenerationPrompt } from '../services/generationContract';
import { prepareRecommendedCameras } from './cameraRecommendations';
import { ExperimentRecorder, assessmentOutput } from '../services/experiment';

afterEach(() => vi.unstubAllGlobals());
function memoryStorage() {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
}
describe('participant start and fixed baseline', () => {
  it('starts an empty layout with actual defaults and five named baseline categories', () => {
    const project = createStudyProject('one');
    expect(project.name).toBe(STUDY_START.projectName);
    expect(project.spaceType).toBe(STUDY_START.spaceType);
    expect(project.layoutVersion).toBe(2);
    expect(project.elements).toHaveLength(0);
    expect(BASELINE_STRUCTURE_IDS.map(id => project.floorPlan!.structures.find(item => item.id === id)!.preservationRequired)).toEqual([true, true, true, true, true]);
    expect(project.sourceImages.filter(image => image.role === 'existing-space')).toHaveLength(2);
    expect(isProject(project)).toBe(true);
  });
  it('cannot release, move, reshape, remove a keep, or delete a mandatory baseline', () => {
    const project = createStudyProject('one');
    expect(setStructurePreservation(project, 'campus-front', false)).toBe(project);
    expect(removeKeep(project, 'keep-campus-front')).toBe(project);
    expect(setKeeps(project, []).keeps).toHaveLength(project.keeps.length);
    expect(moveStructure(project, 'campus-front', { x: .01, y: .01 }).validation.valid).toBe(false);
    expect(reshapeStructure(project, 'campus-front', { kind: 'segment', start: { x: .2, y: .2 }, end: { x: .8, y: .2 } }).validation.valid).toBe(false);
    expect(validateStructureOperation(project, 'campus-front', 'remove').valid).toBe(false);
  });
  it('saves edited default text fields and keeps the same geometry and baseline', () => {
    const defaults = createStudyProject('one');
    const custom = createStudyProject('one', { projectName: '  새 전시 프로젝트  ', spaceType: '  미디어 전시 공간  ' });
    expect(custom.name).toBe('새 전시 프로젝트');
    expect(custom.spaceType).toBe('미디어 전시 공간');
    expect(custom.floorPlan).toEqual(defaults.floorPlan);
    expect(custom.keeps).toEqual(defaults.keeps);
    const storage = memoryStorage(); vi.stubGlobal('localStorage', storage);
    saveProject(custom);
    expect(loadProjects()[0]).toMatchObject({ name: custom.name, spaceType: custom.spaceType });
  });
  it('permits compatible removable graphics and wall lights on the fixed wall', () => {
    const project = createStudyProject('one');
    for (const kind of ['wall-graphic', 'wall-light'] as const) {
      const element = { id: 'decoration', label: '벽면 연출', kind, status: 'apply' as const, sourceReferenceId: project.references[0].id, target: null };
      const candidate = { ...project, elements: [element] };
      const checked = validatePlacement(candidate, element.id, { kind: 'wall-segment', wallId: 'campus-front', start: .3, end: .5 });
      expect(checked.issues.filter(issue => issue.code === 'keep-conflict' && issue.severity === 'error')).toHaveLength(0);
    }
  });
  it('preserves explicitly released legacy structures through reload', () => {
    const storage = memoryStorage(); vi.stubGlobal('localStorage', storage);
    const legacy = setStructurePreservation(createCampusProject('exhibition'), 'campus-front', false);
    saveProject(legacy);
    const restored = loadProjects()[0];
    expect(restored.floorPlan!.structures.find(item => item.id === 'campus-front')).toMatchObject({ immutable: false, protected: false });
    expect(restored.floorPlan!.structures.every(item => !item.preservationRequired)).toBe(true);
  });
  it('starts anonymous task A recording in the first step without extra setup', () => {
    const recorder = new ExperimentRecorder(memoryStorage(), () => 1000);
    recorder.start('P01', STUDY_START.task, createStudyProject('one'), 'space');
    expect(recorder.active).toMatchObject({ participant_id: 'P01', task_set: 'A', consent: true });
    expect(recorder.active!.events.map(event => event.event_name)).toEqual(['experiment_start', 'condition_start', 'step_enter']);
  });
});
describe('design goal data and generation', () => {
  it('round trips the goal and fixed baseline without requiring new fields on old projects', () => {
    const storage = memoryStorage(); vi.stubGlobal('localStorage', storage);
    const project = updateCommon(createStudyProject('one'), { designGoal: '모두의 작품이 돋보이는 모던한 전시 공간' });
    saveProject(project);
    expect(loadProjects()[0].designGoal).toBe(project.designGoal);
    expect(loadProjects()[0].floorPlan!.structures[0].preservationRequired).toBe(true);
    expect(isProject(createCampusProject('exhibition'))).toBe(true);
    expect(isProject({ ...project, designGoal: 5 })).toBe(false);
  });
  it('includes the user goal alongside existing architecture and snapshots it for history', () => {
    const project = prepareRecommendedCameras(updateCommon(createStudyProject('one'), { designGoal: '따뜻한 색감의 졸업전시' }));
    const prompt = buildGenerationPrompt(project, project.cameras[0].id, []);
    expect(prompt).toContain(project.designGoal);
    expect(prompt).toContain('화이트보드');
    expect(createConditionsSnapshot(project, project.cameras[0].id)!.common!.designGoal).toBe(project.designGoal);
    expect(assessmentOutput(project).design_goal).toBe(project.designGoal);
  });
  it('marks previous results stale after changing the goal and allows undo via common patch', () => {
    let project = prepareRecommendedCameras(createStudyProject('one'));
    const camera = project.cameras[0];
    project = { ...project, results: [{ id: 'old', cameraId: camera.id, commonRevision: project.commonRevision, createdAt: '2026-10-07', imageUri: '/sample/result.png', origin: 'sample', approved: false, stale: false, conditionsSnapshot: createConditionsSnapshot(project, camera.id)! }] };
    const edited = updateCommon(project, { designGoal: '밝은 전시 공간' });
    expect(edited.results[0].stale).toBe(true);
    expect(edited.results[0].conditionsSnapshot.common!.designGoal).toBe('');
    expect(updateCommon(edited, { designGoal: project.designGoal }).designGoal).toBe('');
  });
});
