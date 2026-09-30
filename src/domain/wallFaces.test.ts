import { describe, expect, it } from 'vitest';
import { createSampleProject } from '../data/sample';
import { validatePlacement, validatePreflight } from './validation';
import { wallFaceLabel, wallFaceOfPoint } from './wallFaces';
import { buildGenerationPrompt } from '../services/generationContract';
import { buildPlanGuideSvg } from '../services/planGuide';

function partitionProject() {
  const project = createSampleProject();
  project.floorPlan!.structures.push({
    id: 'partition-test', kind: 'wall', name: '전시 가벽', role: 'partition',
    geometry: { kind: 'segment', start: { x: .55, y: .2 }, end: { x: .55, y: .7 } },
    immutable: false, protected: false,
  });
  project.floorPlan!.areas.push(
    { id: 'room-left', name: '전시 1', kind: 'spatial', bounds: { x: .1, y: .2, width: .45, height: .5 } },
    { id: 'room-right', name: '전시 2', kind: 'spatial', bounds: { x: .55, y: .2, width: .35, height: .5 } },
  );
  const graphic = project.elements.find(item => item.id === 'element-graphic')!;
  graphic.target = { kind: 'wall-segment', wallId: 'partition-test', start: .2, end: .4, face: 'a' };
  return project;
}

describe('partition wall faces', () => {
  it('names the two sides by adjacent saved spaces and requires a side before generation', () => {
    const project = partitionProject();
    const wall = project.floorPlan!.structures.find(item => item.id === 'partition-test')!;
    expect(wallFaceLabel(project, wall.id, 'a')).toContain('전시 1');
    expect(wallFaceLabel(project, wall.id, 'b')).toContain('전시 2');
    expect(wallFaceOfPoint(project, wall, { x: .3, y: .45 })).toBe('a');
    expect(wallFaceOfPoint(project, wall, { x: .8, y: .45 })).toBe('b');
    const graphic = project.elements.find(item => item.id === 'element-graphic')!;
    graphic.target = { kind: 'wall-segment', wallId: wall.id, start: .2, end: .4 };
    expect(validatePreflight(project).issues.some(issue => issue.code === 'missing-wall-face' && issue.elementId === graphic.id)).toBe(true);
  });

  it('allows the same span on opposite faces but rejects overlapping items on one face', () => {
    const project = partitionProject();
    project.elements.push({ ...project.elements.find(item => item.id === 'element-graphic')!, id: 'second-graphic', label: '두 번째 포스터', target: null });
    const target = { kind: 'wall-segment' as const, wallId: 'partition-test', start: .2, end: .4 };
    expect(validatePlacement(project, 'second-graphic', { ...target, face: 'b' }).issues.some(issue => issue.code === 'element-overlap')).toBe(false);
    expect(validatePlacement(project, 'second-graphic', { ...target, face: 'a' }).issues.some(issue => issue.code === 'element-overlap')).toBe(true);
  });

  it('marks the selected face in the plan guide and hides it from a camera on the reverse face', () => {
    const project = partitionProject();
    project.cameras.push({ id: 'reverse-view', name: '전시 2에서', x: .8, y: .5, directionDegrees: 180, primary: false });
    const palette = { paper: '#fff', ink: '#111', structure: '#444', info: '#888', selected: '#555', subtle: '#eee', border: '#ccc' };
    expect(buildPlanGuideSvg(project, 'reverse-view', palette)).toContain('A면');
    const reversePrompt = buildGenerationPrompt(project, 'reverse-view', []);
    expect(reversePrompt).toContain('OPPOSITE face of this partition');
    const frontPrompt = buildGenerationPrompt(project, 'camera-entrance', []);
    expect(frontPrompt).toContain('selected camera is on the decorated face');
  });
});
