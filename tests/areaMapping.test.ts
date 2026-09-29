import { describe, expect, it } from 'vitest';
import { createSampleProject } from '../src/data/sample';
import { areaTargetOptions, targetForArea } from '../src/domain/areaTargets';
import { placeElement, createConditionsSnapshot } from '../src/domain/revisions';
import { isProject } from '../src/services/persistence';
import { buildGenerationPrompt } from '../src/services/generationContract';

describe('reference elements mapped to independent scopes', () => {
  it('preserves whole-space lighting alongside a second scoped reference through serialization and generation conditions', () => {
    const project = createSampleProject();
    const area = project.floorPlan!.areas.find(item => item.kind === 'spatial')!;
    project.elements.push({ id: 'local-light', sourceReferenceId: 'ref-product', label: '부분 조명 분위기', kind: 'ambient-light', status: 'apply', target: null });
    const target = targetForArea('ambient-light', area)!;
    const placed = placeElement(project, 'local-light', target);
    expect(placed.validation.valid).toBe(true);
    expect(placed.project.elements.find(item => item.id === 'element-warm-light')!.target).toEqual({ kind: 'whole-space' });
    expect(placed.project.elements.find(item => item.id === 'local-light')!.target).toEqual({ kind: 'named-area', areaId: area.id });
    expect(isProject(JSON.parse(JSON.stringify(placed.project)))).toBe(true);
    expect(createConditionsSnapshot(placed.project, placed.project.cameras[0].id).common!.elements.find(item => item.id === 'local-light')!.target).toEqual(target);
    expect(buildGenerationPrompt(placed.project, placed.project.cameras[0].id, [])).toContain(area.name);
  });
  it('never offers a passage or ceiling as an ambience scope, nor an area for a wall/floor-point light', () => {
    const plan = createSampleProject().floorPlan!;
    const ambience = areaTargetOptions(plan, 'ambient-light');
    expect(ambience[0].target).toEqual({ kind: 'whole-space' });
    for (const area of plan.areas.filter(item => item.kind === 'passage' || item.kind === 'ceiling')) expect(targetForArea('ambient-light', area)).toBeNull();
    expect(areaTargetOptions(plan, 'wall-light')).toEqual([]);
    expect(areaTargetOptions(plan, 'standing-light')).toEqual([]);
  });
  it('only maps suspended lighting to ceiling zones, retaining occupancy rejection', () => {
    const project = createSampleProject();
    project.elements.push({ id: 'ceiling-a', sourceReferenceId: 'ref-atmosphere', label: '천장 조명 A', kind: 'ceiling-light', status: 'apply', target: null }, { id: 'ceiling-b', sourceReferenceId: 'ref-atmosphere', label: '천장 조명 B', kind: 'ceiling-light', status: 'apply', target: null });
    const options = areaTargetOptions(project.floorPlan, 'ceiling-light');
    expect(options.every(option => option.target.kind === 'ceiling-zone')).toBe(true);
    const first = placeElement(project, 'ceiling-a', options[0].target);
    expect(first.validation.valid).toBe(true);
    const second = placeElement(first.project, 'ceiling-b', options[0].target);
    expect(second.validation.valid).toBe(false);
    expect(second.project.elements.find(item => item.id === 'ceiling-b')!.target).toBeNull();
  });
  it('rejects a missing mapped area instead of silently changing the scope', () => {
    const project = createSampleProject();
    const before = project.elements.find(item => item.id === 'element-warm-light')!.target;
    const placed = placeElement(project, 'element-warm-light', { kind: 'named-area', areaId: 'deleted-area' });
    expect(placed.validation.valid).toBe(false);
    expect(placed.project.elements.find(item => item.id === 'element-warm-light')!.target).toEqual(before);
  });
});
