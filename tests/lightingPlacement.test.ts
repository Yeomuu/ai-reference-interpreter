import { describe, expect, it } from 'vitest';
import { createSampleProject } from '../src/data/sample';
import { createLayoutItem } from '../src/domain/layoutMapping';
import { LIGHT_PLAN_FOOTPRINT } from '../src/domain/layoutDefaults';
import { validatePlacement, validateStructureDrawing } from '../src/domain/validation';
import type { PlacementTarget, Structure } from '../src/domain/types';

function setup() {
  const project = createSampleProject();
  const floor = createLayoutItem(project, 'stand', 'display');
  floor.target = { kind: 'floor-point', x: .4, y: .4, footprint: { width: .1, height: .1 } };
  const ceiling = { ...createLayoutItem(project, 'ceiling', 'light'), kind: 'ceiling-light' as const };
  const second = { ...ceiling, id: 'second', label: '두 번째 조명' };
  project.elements = [floor, ceiling, second];
  project.floorPlan!.structures = [];
  project.floorPlan!.areas = [
    { id: 'floor', name: '바닥', kind: 'floor', bounds: { x: .1, y: .1, width: .8, height: .8 } },
    { id: 'ceiling', name: '천장', kind: 'ceiling', bounds: { x: .1, y: .1, width: .8, height: .8 } },
  ];
  const target = (x: number, y: number): PlacementTarget => ({ kind: 'ceiling-zone', zoneId: 'ceiling', offset: { x: (x - .1) / .8, y: (y - .1) / .8 } });
  return { project, floor, ceiling, second, target };
}

describe('light installation layers', () => {
  it('allows ceiling lights above furniture while standing lights occupy floor space', () => {
    const { project, ceiling, target } = setup();
    expect(validatePlacement(project, ceiling.id, target(.4, .4)).valid).toBe(true);
    const standing = createLayoutItem(project, 'standing', 'light');
    project.elements.push(standing);
    expect(standing.kind).toBe('standing-light');
    expect(validatePlacement(project, standing.id, { kind: 'floor-point', x: .4, y: .4, footprint: LIGHT_PLAN_FOOTPRINT }).issues).toContainEqual(expect.objectContaining({ code: 'element-overlap' }));
  });
  it('allows distinct positions in the same ceiling zone and rejects the same position', () => {
    const { project, ceiling, second, target } = setup();
    ceiling.target = target(.4, .4);
    expect(validatePlacement(project, second.id, target(.65, .65)).valid).toBe(true);
    expect(validatePlacement(project, second.id, target(.4, .4)).issues).toContainEqual(expect.objectContaining({ code: 'element-overlap' }));
    expect(validatePlacement(project, second.id, target(.41, .4)).valid).toBe(false);
  });
  it('checks existing ceiling lights by position in both editing directions', () => {
    const { project, ceiling, target } = setup();
    const fixture: Structure = { id: 'existing', name: '기존 등기구', kind: 'existing-light', protected: true, geometry: { kind: 'circle', center: { x: .4, y: .4 }, radius: .025 } };
    project.floorPlan!.structures.push(fixture);
    expect(validatePlacement(project, ceiling.id, target(.4, .4)).valid).toBe(false);
    expect(validatePlacement(project, ceiling.id, target(.65, .65)).valid).toBe(true);
    ceiling.target = target(.65, .65);
    expect(validateStructureDrawing(project, { ...fixture, id: 'second-existing', geometry: { kind: 'circle', center: { x: .65, y: .65 }, radius: .025 } }).valid).toBe(false);
    expect(validateStructureDrawing(project, { ...fixture, id: 'second-existing', geometry: { kind: 'circle', center: { x: .75, y: .75 }, radius: .025 } }).valid).toBe(true);
  });
  it('preserves the conservative zone check for legacy fixtures without a position', () => {
    const { project, ceiling, second, target } = setup();
    ceiling.target = { kind: 'ceiling-zone', zoneId: 'ceiling' };
    const before = JSON.stringify(project);
    expect(validatePlacement(project, second.id, target(.65, .65)).valid).toBe(false);
    expect(JSON.stringify(project)).toBe(before);
  });
  it('rejects invalid offsets and footprints outside the ceiling boundary', () => {
    const { project, ceiling, target } = setup();
    expect(validatePlacement(project, ceiling.id, target(.105, .4)).valid).toBe(false);
    expect(validatePlacement(project, ceiling.id, target(1.1, .4)).valid).toBe(false);
    expect(validatePlacement(project, ceiling.id, target(Number.NaN, .4)).valid).toBe(false);
  });
});
