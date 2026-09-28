import { describe, expect, it } from 'vitest';
import { createSampleProject } from '../data/sample';
import { isProject } from '../services/persistence';
import { moveStructure, removeDesignElement, removeReference, setStructurePreservation, structureMovementReason, updateCommon, validatePreflight } from './index';

describe('user-controlled preservation and structure movement', () => {
  it('releases an original pillar, moves it and re-locks it with history intact', () => {
    const original = createSampleProject();
    const released = setStructurePreservation(original, 'pillar-west', false);
    expect(released.keeps.some((keep) => keep.structureId === 'pillar-west')).toBe(false);
    expect(released.results[0].stale).toBe(true);
    expect(released.results[0].imageUri).toBe(original.results[0].imageUri);
    const moved = moveStructure(released, 'pillar-west', { x: .06, y: 0 });
    expect(moved.validation).toEqual({ valid: true, issues: [] });
    expect(moved.project.floorPlan!.structures.find((item) => item.id === 'pillar-west')!.geometry).toEqual({ kind: 'rect', bounds: { x: .26, y: .4, width: .09, height: .11 } });
    const locked = setStructurePreservation(moved.project, 'pillar-west', true);
    const forbidden = moveStructure(locked, 'pillar-west', { x: .05, y: 0 });
    expect(forbidden.validation.valid).toBe(false);
    expect(forbidden.project).toBe(locked);
    expect(isProject(JSON.parse(JSON.stringify(locked)))).toBe(true);
  });
  it('retains custom preservation text and surface permission across off/on', () => {
    const original = createSampleProject();
    const on = setStructurePreservation(setStructurePreservation(original, 'wall-north', false), 'wall-north', true);
    expect(on.keeps.find((keep) => keep.structureId === 'wall-north')!.description).toBe(original.keeps[0].description);
    expect(on.keeps.find((keep) => keep.structureId === 'wall-north')!.allowedSurfaceTreatment).toBe(true);
  });
  it('does not mistake an unlocked original boundary for a newly added partition', () => {
    const released = setStructurePreservation(createSampleProject(), 'wall-south', false);
    expect(released.floorPlan!.structures.find((item) => item.id === 'wall-south')!.role).toBe('base');
    expect(validatePreflight(released).valid).toBe(true);
  });
  it('rejects a new furniture collision and leaves old geometry intact', () => {
    const released = setStructurePreservation(createSampleProject(), 'pillar-west', false);
    const moved = moveStructure(released, 'pillar-west', { x: .29, y: .06 });
    expect(moved.validation.issues.some((issue) => issue.code === 'element-overlap' || issue.code === 'pillar-collision')).toBe(true);
    expect(moved.project).toBe(released);
  });
  it('rejects a released pillar crossing a wall even when the wall lock is off', () => {
    const released = setStructurePreservation(setStructurePreservation(createSampleProject(), 'pillar-west', false), 'wall-west', false);
    const moved = moveStructure(released, 'pillar-west', { x: -.15, y: 0 });
    expect(moved.validation.issues.some((issue) => issue.code === 'structure-overlap')).toBe(true);
    expect(moved.project).toBe(released);
  });
  it('slides a released window along its parent and prevents an overlapping graphic', () => {
    const released = setStructurePreservation(createSampleProject(), 'window-north', false);
    const moved = moveStructure(released, 'window-north', { x: -.05, y: .2 });
    expect(moved.validation.valid).toBe(true);
    const window = moved.project.floorPlan!.structures.find((item) => item.id === 'window-north')!;
    expect(window.geometry.kind === 'segment' && window.geometry.start.y).toBe(.1);
    expect(window.wallSpan!.start).toBeLessThan(.34);
    expect(moveStructure(released, 'window-north', { x: .3, y: .1 }).validation.issues.some((issue) => issue.code === 'element-overlap')).toBe(true);
  });
  it('requires connected locks to be released and moves a wall and opening together', () => {
    const released = setStructurePreservation(createSampleProject(), 'wall-north', false);
    const wall = released.floorPlan!.structures.find((item) => item.id === 'wall-north')!;
    expect(structureMovementReason(released, wall)).toContain('후면 창');
    expect(moveStructure(released, 'wall-north', { x: 0, y: -.02 }).project).toBe(released);
    const unlocked = setStructurePreservation(released, 'window-north', false);
    const moved = moveStructure(unlocked, 'wall-north', { x: 0, y: -.02 });
    expect(moved.validation).toEqual({ valid: true, issues: [] });
    for (const id of ['wall-north', 'window-north']) {
      const geometry = moved.project.floorPlan!.structures.find((item) => item.id === id)!.geometry;
      expect(geometry.kind === 'segment' && geometry.start.y).toBe(.08);
    }
  });
  it('supports a released existing ceiling fixture while retaining its tone', () => {
    const project = createSampleProject();
    project.floorPlan!.structures.push({ id: 'light', kind: 'existing-light', name: '기존 천장 조명', role: 'base', immutable: true, protected: true, lightTone: '온백색', geometry: { kind: 'circle', center: { x: .7, y: .5 }, radius: .025 } });
    const moved = moveStructure(setStructurePreservation(project, 'light', false), 'light', { x: .02, y: .05 });
    expect(moved.validation.valid).toBe(true);
    expect(moved.project.floorPlan!.structures.at(-1)!.lightTone).toBe('온백색');
  });
  it('rejects malformed optional preservation and history metadata in storage', () => {
    const project = createSampleProject();
    const malformed = JSON.parse(JSON.stringify(project));
    malformed.floorPlan.structures[0].preservationSettings = { description: 5 };
    expect(isProject(malformed)).toBe(false);
    delete malformed.floorPlan.structures[0].preservationSettings;
    malformed.results[0].conditionsSnapshot.common.sourceImages[0].role = 'unknown';
    expect(isProject(malformed)).toBe(false);
  });
});

describe('reference and element deletion', () => {
  it('removes one reference, its image and both applied/excluded elements, preserving historical attribution', () => {
    const original = createSampleProject();
    const deleted = removeReference(original, 'ref-atmosphere');
    expect(deleted.references).toHaveLength(2);
    expect(deleted.sourceImages.some((image) => image.id === 'photo-atmosphere')).toBe(false);
    expect(deleted.elements.map((element) => element.id)).toEqual(['element-display', 'element-graphic']);
    expect(deleted.results).toHaveLength(1);
    expect(deleted.results[0].conditionsSnapshot.common!.sourceImages!.some((image) => image.id === 'photo-atmosphere')).toBe(true);
    expect(deleted.results[0].stale).toBe(true);
    expect(deleted.floorPlan).toEqual(original.floorPlan);
    expect(deleted.keeps).toEqual(original.keeps);
    expect(isProject(JSON.parse(JSON.stringify(deleted)))).toBe(true);
  });
  it('captures the reference metadata for a legacy snapshot before deletion', () => {
    const original = createSampleProject();
    delete original.results[0].conditionsSnapshot.common!.sourceImages;
    const deleted = removeReference(original, 'ref-product');
    expect(deleted.results[0].conditionsSnapshot.common!.sourceImages!.find((image) => image.id === 'photo-product')!.name).toContain('진열대');
  });
  it('retains a shared image while another reference still uses it', () => {
    const original = createSampleProject();
    original.references.push({ ...original.references[0], id: 'shared' });
    expect(removeReference(original, 'ref-product').sourceImages.some((image) => image.id === 'photo-product')).toBe(true);
  });
  it('deletes a standalone element without deleting its source and clears its extraction link', () => {
    const original = createSampleProject();
    const deleted = removeDesignElement(original, 'element-display');
    expect(deleted.references).toHaveLength(3);
    expect(deleted.sourceImages).toEqual(original.sourceImages);
    expect(deleted.references[0].extractedElements).toEqual([]);
    expect(deleted.elements).toHaveLength(3);
  });
  it('undo restores the common conditions without erasing results or rolling back the revision', () => {
    const original = createSampleProject();
    const deleted = removeReference(original, 'ref-product');
    const undo = updateCommon(deleted, { references: original.references, elements: original.elements, sourceImages: original.sourceImages });
    expect(undo.references).toEqual(original.references);
    expect(undo.commonRevision).toBe(original.commonRevision + 2);
    expect(undo.results[0].stale).toBe(true);
    expect(undo.results[0].conditionsSnapshot.common!.elements).toEqual(original.results[0].conditionsSnapshot.common!.elements);
  });
});
