import { describe, expect, it } from 'vitest';
import { createSampleProject } from '../src/data/sample';
import { validateMovementPreview } from '../src/domain/movementFeedback';
import { moveStructure } from '../src/domain/structureEditing';
import { validateCamera, validatePlacement } from '../src/domain/validation';

describe('movement feedback before release', () => {
  it('matches floor footprint validation, including passages, without changing the saved project', () => {
    const project = createSampleProject(), before = JSON.stringify(project);
    const element = project.elements.find(item => item.id === 'element-display')!;
    const preview = validateMovementPreview(project, {kind:'element-move',id:element.id,point:{x:.5,y:.8}})!;
    expect(preview.valid).toBe(false);
    expect(preview.issues.some(issue => issue.code === 'passage-blocked')).toBe(true);
    expect(preview).toEqual(validatePlacement(project, element.id, {...element.target!,x:.5,y:.8} as typeof element.target & {kind:'floor-point'}));
    expect(JSON.stringify(project)).toBe(before);
  });
  it('matches released structure validation for an invisible-to-old-Keep passage conflict', () => {
    const project = createSampleProject();
    const pillar = project.floorPlan!.structures.find(item => item.id === 'pillar-west')!;
    pillar.immutable = false; pillar.protected = false;
    project.keeps = project.keeps.filter(item => item.structureId !== pillar.id);
    const delta = {x:.26,y:.35};
    const preview = validateMovementPreview(project,{kind:'structure-move',id:pillar.id,structure:delta})!;
    expect(preview).toEqual(moveStructure(project,pillar.id,delta).validation);
    expect(preview.issues.some(issue => issue.code === 'passage-blocked')).toBe(true);
  });
  it('allows a camera on circulation but shows occupancy conflicts before release', () => {
    const project = createSampleProject(), id = project.cameras[0].id;
    expect(validateMovementPreview(project,{kind:'camera-move',id,point:{x:.5,y:.80}})!.valid).toBe(true);
    const point = {x:.245,y:.455};
    const preview = validateMovementPreview(project,{kind:'camera-move',id,point})!;
    expect(preview.valid).toBe(false);
    expect(preview).toEqual(validateCamera({...project,cameras:project.cameras.map(camera => ({...camera,...point}))},id));
  });
  it('keeps wall attachment and Keep-compatible surface decoration checks', () => {
    const project = createSampleProject();
    const id = 'element-graphic';
    const wall = {wallId:'wall-east',start:.2,end:.35};
    expect(validateMovementPreview(project,{kind:'wall-element-move',id,wall})).toEqual(validatePlacement(project,id,{kind:'wall-segment',...wall}));
    expect(validateMovementPreview(project,null)).toBeUndefined();
  });
});
