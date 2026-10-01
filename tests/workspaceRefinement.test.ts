import { describe, expect, it } from 'vitest';
import { createCampusProject } from '../src/data/campus';
import { bindReference, changeBindingScope, createLayoutItem, targetCondition } from '../src/domain/layoutMapping';
import { translatedElementTarget, validateMovementPreview } from '../src/domain/movementFeedback';
import { displayPosition } from '../src/domain/display';
import { elementPlanPosition } from '../src/services/planGuide';

function projectWithItem() {
  const project = createCampusProject('exhibition');
  project.elements = [{ ...createLayoutItem(project, 'table', 'table'), target: { kind: 'floor-point', x: .4, y: .4, footprint: { width: .1, height: .08 } } }];
  return project;
}
describe('reference interpretation changes within the current workspace', () => {
  it('preserves binding identity, source, crop, targets and cameras when changing to material', () => {
    let project = projectWithItem();
    const crop = { x: .1, y: .2, width: .4, height: .3 };
    project = bindReference(project, project.references[0].id, ['table'], crop).project;
    const binding = project.referenceBindings![0];
    const result = changeBindingScope(project, binding.id, 'material');
    expect(result.error).toBeUndefined();
    expect(result.project.referenceBindings![0]).toEqual({ ...binding, scope: 'material' });
    expect(result.project.elements).toEqual(project.elements);
    expect(result.project.cameras).toEqual(project.cameras);
    expect(result.project.references).toEqual(project.references);
  });
  it('rejects lighting on furniture atomically without changing the previous binding', () => {
    let project = projectWithItem();
    project = bindReference(project, project.references[0].id, ['table']).project;
    const result = changeBindingScope(project, project.referenceBindings![0].id, 'lighting');
    expect(result.error).toContain('조명');
    expect(result.project).toBe(project);
  });
  it('changes the type of a mapped atmosphere condition without duplicating it', () => {
    let project = createCampusProject('exhibition');
    const item = targetCondition(project, 'atmosphere', { kind: 'whole-space' }, 'appearance');
    project.elements = [item];
    project = bindReference(project, project.references[0].id, [item.id]).project;
    const result = changeBindingScope(project, project.referenceBindings![0].id, 'lighting');
    expect(result.error).toBeUndefined();
    expect(result.project.elements).toHaveLength(1);
    expect(result.project.elements[0]).toMatchObject({ id: item.id, kind: 'ambient-light', target: item.target });
  });
  it('returns a missing-binding reason and leaves data unchanged', () => {
    const project = projectWithItem();
    expect(changeBindingScope(project, 'deleted', 'material')).toMatchObject({ project, error: expect.any(String) });
  });
});
describe('moving mapped objects preserves their typed hosts', () => {
  it('moves a floor item with the existing footprint and validates a blocked location', () => {
    const project = projectWithItem();
    expect(translatedElementTarget(project, 'table', { x: .5, y: .5 })).toMatchObject({ kind: 'floor-point', x: .5, y: .5, footprint: { width: .1, height: .08 } });
    expect(validateMovementPreview(project, { kind: 'element-move', id: 'table', point: { x: 0, y: 0 } })?.valid).toBe(false);
  });
  it('moves ceiling lighting inside its existing zone and rejects a point outside it', () => {
    const project = projectWithItem(), zone = project.floorPlan!.areas.find(area => area.kind === 'ceiling')!;
    project.elements.push({ ...createLayoutItem(project, 'ceiling-light', 'light'), kind: 'ceiling-light', target: { kind: 'ceiling-zone', zoneId: zone.id } });
    const point = { x: zone.bounds.x + zone.bounds.width * .3, y: zone.bounds.y + zone.bounds.height * .4 };
    expect(translatedElementTarget(project, 'ceiling-light', point)).toMatchObject({ kind: 'ceiling-zone', zoneId: zone.id, offset: { x: expect.closeTo(.3), y: expect.closeTo(.4) } });
    expect(elementPlanPosition(project, { ...project.elements.at(-1)!, target: translatedElementTarget(project, 'ceiling-light', point)! })).toEqual(point);
    expect(validateMovementPreview(project, { kind: 'element-move', id: 'ceiling-light', point: { x: -1, y: -1 } })?.valid).toBe(false);
  });
  it('inverts a rotated display surface without detaching the product', () => {
    const project = projectWithItem();
    project.elements[0].target = { kind: 'floor-point', x: .4, y: .4, footprint: { width: .12, height: .09 }, rotationDegrees: 35 };
    const product = { ...createLayoutItem(project, 'product', 'product'), target: { kind: 'fixture-surface' as const, fixtureElementId: 'table', offset: { x: .7, y: .3 } } };
    project.elements.push(product);
    const target = translatedElementTarget(project, product.id, displayPosition(project, product)!);
    expect(target).toMatchObject({ kind: 'fixture-surface', fixtureElementId: 'table', offset: { x: expect.closeTo(.7), y: expect.closeTo(.3) } });
    expect(validateMovementPreview(project, { kind: 'element-move', id: product.id, point: { x: .8, y: .8 } })?.valid).toBe(false);
  });
});
