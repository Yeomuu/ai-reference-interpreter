import { describe, expect, it } from 'vitest';
import { createSampleProject } from '../src/data/sample';
import { areaContainsPoint, areaContainsRect, areaContainsSegment, areaIntersectsRect, areaIntersectsCircle, areaIntersectsSegment, outlineBounds, validOutline } from '../src/domain/geometry';
import { displayPosition } from '../src/domain/display';
import { placeElement, removeDesignElement, removeReference, removeCamera, setStructurePreservation, updateElement } from '../src/domain/revisions';
import { validateCamera, validatePlacement, validateStructureDrawing, validatePreflight, validateAreaDrawing } from '../src/domain/validation';
import { reshapeStructure } from '../src/domain/structureEditing';
import { isProject } from '../src/services/persistence';
import { buildGenerationPrompt } from '../src/services/generationContract';
import { arrangePlanLabels } from '../src/components/plan-labels';
import type { Area, DesignElement } from '../src/domain/types';

const points = [{ x: .1, y: .1 }, { x: .9, y: .1 }, { x: .9, y: .4 }, { x: .4, y: .4 }, { x: .4, y: .9 }, { x: .1, y: .9 }];
const floor: Area = { id: 'traced', name: '직접 그린 바닥', kind: 'floor', bounds: outlineBounds(points), outline: points };
function productProject() {
  const project = createSampleProject();
  project.elements = [project.elements[0]];
  const support = project.elements[0];
  support.target = { kind: 'floor-point', x: .5, y: .5, footprint: { width: .12, height: .10 } };
  const product: DesignElement = { id: 'product', label: '진열 상품', sourceReferenceId: project.references[1].id, kind: 'display-product', status: 'apply', target: { kind: 'fixture-surface', fixtureElementId: support.id, offset: { x: .75, y: .5 } } };
  project.elements.push(product);
  return { project, support, product };
}
describe('manual outlines and display relations', () => {
  it('validates a concave passage against its interior rather than rejecting an object in its bounding-box cutout', () => {
    const passage={...floor,id:'passage',kind:'passage' as const};
    expect(areaIntersectsRect(passage,{x:.65,y:.65,width:.1,height:.1})).toBe(false);
    expect(areaIntersectsCircle(passage,{x:.7,y:.7},.05,1000,700)).toBe(false);
    expect(areaIntersectsCircle(passage,{x:.42,y:.42},.04,1000,700)).toBe(true);
    expect(areaIntersectsSegment(passage,{x:.5,y:.7},{x:.8,y:.7})).toBe(false);
    expect(areaIntersectsSegment(passage,{x:.1,y:.1},{x:.9,y:.1})).toBe(false);
    expect(areaIntersectsSegment(passage,{x:.2,y:.3},{x:.8,y:.3})).toBe(true);
    const project=createSampleProject();project.floorPlan!.structures=[];project.floorPlan!.areas=project.floorPlan!.areas.filter(area=>area.kind==='floor');
    project.elements=[{...project.elements[0],target:{kind:'floor-point',x:.7,y:.7,footprint:{width:.1,height:.1}}}];
    expect(validateAreaDrawing(project,passage).valid).toBe(true);
    project.floorPlan!.areas.push(passage);
    expect(validatePlacement(project,project.elements[0].id,project.elements[0].target).valid).toBe(true);
    expect(validatePlacement(project,project.elements[0].id,{kind:'floor-point',x:.3,y:.3}).valid).toBe(false);
  });
  it('preserves camera result history, reassigns primary and permits deleting the last camera', () => {
    const project=createSampleProject(); const id=project.cameras[0].id;
    project.cameras.push({...project.cameras[0],id:'extra-camera',name:'추가 시점',primary:false});
    const next=removeCamera(project,id);
    expect(next.results).toHaveLength(project.results.length);
    expect(next.results.filter(result=>result.cameraId===id).every(result=>result.stale)).toBe(true);
    expect(next.cameras.some(camera=>camera.primary)).toBe(true);
    const empty=next.cameras.reduce((current,camera)=>removeCamera(current,camera.id),next);
    expect(empty.cameras).toHaveLength(0); expect(validatePreflight(empty).valid).toBe(false);
  });
  it('rejects an opening across a pillar but permits removable art on a kept wall without a permission flag', () => {
    const project=createSampleProject(); const wall=project.floorPlan!.structures.find(item=>item.name==='후면 벽')!;
    const pillar=project.floorPlan!.structures.find(item=>item.kind==='pillar')!;
    pillar.geometry={kind:'rect',bounds:{x:.5,y:.09,width:.05,height:.05}};
    const opening={id:'opening',name:'문',kind:'door' as const,protected:true,parentWallId:wall.id,geometry:{kind:'segment' as const,start:{x:.5,y:.1},end:{x:.55,y:.1}}};
    expect(validateStructureDrawing(project,opening).valid).toBe(false);
    project.keeps.forEach(keep=>keep.allowedSurfaceTreatment=false);
    const graphic=project.elements.find(element=>element.kind==='wall-graphic')!;
    expect(validatePlacement(project,graphic.id,graphic.target).valid).toBe(true);
  });
  it('uses the actual concave outline for camera and footprint containment', () => {
    expect(validOutline(points)).toBe(true);
    expect(areaContainsPoint(floor, { x: .7, y: .7 })).toBe(false);
    expect(areaContainsRect(floor, { x: .2, y: .2, width: .1, height: .1 })).toBe(true);
    expect(areaContainsSegment(floor, { x: .8, y: .3 }, { x: .3, y: .8 })).toBe(false);
    const project = createSampleProject(); project.floorPlan!.structures = []; project.floorPlan!.areas = [floor]; project.elements = [project.elements[0]];
    expect(validatePlacement(project, project.elements[0].id, { kind: 'floor-point', x: .7, y: .7 }).valid).toBe(false);
    project.cameras[0].x = .7; project.cameras[0].y = .7;
    expect(validateCamera(project, project.cameras[0].id).valid).toBe(false);
    expect(isProject(project)).toBe(true);
    expect(isProject({ ...project, floorPlan: { ...project.floorPlan, areas: [{ ...floor, bounds: { x: 0, y: 0, width: 1, height: 1 } }] } })).toBe(false);
  });
  it('rejects crossed, touching, degenerate and oversized outlines', () => {
    expect(validOutline([{ x: .1, y: .1 }, { x: .9, y: .9 }, { x: .1, y: .9 }, { x: .9, y: .1 }])).toBe(false);
    expect(validOutline(points.slice(0, 2))).toBe(false);
    expect(validOutline([...points, points[0]])).toBe(false);
    expect(validOutline([...points, { x: 2, y: .4 }])).toBe(false);
  });
  it('permits a product on its support and carries it through support movement and rotation', () => {
    const { project, support, product } = productProject();
    expect(validatePlacement(project, product.id, product.target).valid).toBe(true);
    const before = displayPosition(project, product)!;
    expect(before.x).toBeCloseTo(.53);
    const moved = placeElement(project, support.id, { kind: 'floor-point', x: .6, y: .5, footprint: { width: .12, height: .1 }, rotationDegrees: 90 });
    expect(moved.validation.valid).toBe(true);
    const after = displayPosition(moved.project, product)!;
    expect(after.x).toBeCloseTo(.6); expect(after.y).toBeGreaterThan(.5);
    expect(isProject(moved.project)).toBe(true);
    expect(validatePlacement(project, product.id, { kind: 'floor-point', x: .5, y: .5 }).valid).toBe(false);
    expect(validatePlacement(project, product.id, { kind: 'fixture-surface', fixtureElementId: support.id, offset: { x: 1.1, y: .5 } }).valid).toBe(false);
  });
  it('retains physical collisions for the support, and rejects missing/excluded/wrong supports', () => {
    const { project, support, product } = productProject();
    expect(placeElement(project, support.id, { kind: 'floor-point', x: .25, y: .4, footprint: { width: .2, height: .2 } }).validation.valid).toBe(false);
    expect(validatePlacement(project, product.id, { kind: 'fixture-surface', fixtureElementId: 'missing', offset: { x: .5, y: .5 } }).valid).toBe(false);
    support.status = 'exclude'; expect(validatePlacement(project, product.id, product.target).valid).toBe(false);
  });
  it('releases dependents after support deletion, exclusion, type change or source removal', () => {
    const { project, support, product } = productProject();
    for (const next of [removeDesignElement(project, support.id), updateElement(project, support.id, { status: 'exclude' }), updateElement(project, support.id, { kind: 'ambient-light' }), removeReference(project, support.sourceReferenceId)]) {
      expect(next.elements.find(item => item.id === product.id)?.target).toBeNull();
      expect(next.results.length).toBe(project.results.length);
    }
  });
  it('respects preservation and validates a released wall direction correction', () => {
    let project = createSampleProject(); const wall = project.floorPlan!.structures.find(item => item.name === '오른쪽 벽')!;
    const geometry = { kind: 'segment' as const, start: { x: .9, y: .15 }, end: { x: .9, y: .85 } };
    expect(reshapeStructure(project, wall.id, geometry).validation.valid).toBe(false);
    project = setStructurePreservation(project, wall.id, false);
    expect(reshapeStructure(project, wall.id, geometry).validation.valid).toBe(true);
  });
  it('sends actual outline, product support and explicit basic-support origin to the image prompt', () => {
    const { project, support } = productProject(); project.floorPlan!.areas.push(floor); support.origin = 'basic-support';
    const prompt = buildGenerationPrompt(project, project.cameras[0].id, []);
    expect(prompt).toContain('manually traced polygon'); expect(prompt).toContain('overlap intentionally'); expect(prompt).toContain('not an object extracted');
  });
  it('packs crowded names without changing geometry or overlapping hit areas', () => {
    const input = Array.from({ length: 12 }, (_, i) => ({ id: String(i), x: 250, y: 160, width: 110, height: 40 }));
    const placed = [...arrangePlanLabels(input, 600, 400).values()];
    expect(placed).toHaveLength(12);
    for (const a of placed) { expect(a.x - a.width / 2).toBeGreaterThanOrEqual(0); expect(a.y + a.height / 2).toBeLessThanOrEqual(400);
      for (const b of placed.filter(item => item.id !== a.id)) expect(Math.abs(a.x - b.x) >= 110 || Math.abs(a.y - b.y) >= 40).toBe(true); }
    expect(input.every(item => item.x === 250 && item.y === 160)).toBe(true);
  });
  it('keeps clearance geometry visible when a label starts over it', () => {
    const clearance = { id: 'door-clearance', x: 200, y: 260, width: 100, height: 80 };
    const before = { ...clearance };
    const labels = [...arrangePlanLabels([{ id: 'door-name', x: 200, y: 260, width: 140, height: 40 }], 400, 320, [clearance]).values()];
    expect(labels).toHaveLength(1);
    expect(Math.abs(labels[0].x - clearance.x) >= 120 || Math.abs(labels[0].y - clearance.y) >= 60).toBe(true);
    expect(clearance).toEqual(before);
  });
});
