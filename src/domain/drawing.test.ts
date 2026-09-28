import { describe, expect, it } from 'vitest';
import { createSampleProject } from '../data/sample';
import {
  placeElement,
  validateAreaDrawing,
  validatePartitionPlacement,
  validatePlacement,
  validatePreflight,
  validateStructureDrawing,
} from './index';
import type { Structure } from './types';

function northOpening(kind: 'window' | 'door' | 'entrance', start: number, end: number): Structure {
  return {
    id: 'new-opening', name: '새 개구부', kind, immutable: true, protected: true,
    parentWallId: 'wall-north', wallSpan: { start, end },
    geometry: { kind: 'segment', start: { x: .08 + .84 * start, y: .1 }, end: { x: .08 + .84 * end, y: .1 } },
  };
}

describe('drawing preserves distinct structures and semantic areas', () => {
  it('rejects reversed repeated wall spans and overlapping pillars without modifying original geometry', () => {
    const project = createSampleProject();
    const previous = structuredClone(project.floorPlan);
    const wall: Structure = {
      id: 'new-wall', name: '중복 벽', kind: 'wall', immutable: true, protected: true,
      geometry: { kind: 'segment', start: { x: .8, y: .1 }, end: { x: .2, y: .1 } },
    };
    expect(validateStructureDrawing(project, wall).issues).toContainEqual(expect.objectContaining({ code: 'structure-overlap', structureId: 'wall-north' }));
    const pillar: Structure = {
      id: 'new-pillar', name: '중복 기둥', kind: 'pillar', protected: true,
      geometry: { kind: 'circle', center: { x: .245, y: .45 }, radius: .035 },
    };
    expect(validateStructureDrawing(project, pillar).issues).toContainEqual(expect.objectContaining({ code: 'structure-overlap', structureId: 'pillar-west' }));
    expect(project.floorPlan).toEqual(previous);
  });

  it('permits new wall junctions but rejects partition overlap and interior wall crossing', () => {
    const project = createSampleProject();
    const partition: Structure = {
      id: 'partition', name: '추가 가벽', kind: 'wall', immutable: false, protected: false,
      geometry: { kind: 'segment', start: { x: .7, y: .6 }, end: { x: .8, y: .6 } },
    };
    project.floorPlan!.structures.push(partition);
    expect(validatePartitionPlacement(project, { x: .7, y: .6 }, { x: .8, y: .6 }, partition.id).valid).toBe(true);
    expect(validatePartitionPlacement(project, { x: .72, y: .6 }, { x: .82, y: .6 }).issues).toContainEqual(expect.objectContaining({ code: 'structure-overlap', structureId: partition.id }));
    expect(validatePartitionPlacement(project, { x: .75, y: .55 }, { x: .75, y: .65 }).issues).toContainEqual(expect.objectContaining({ code: 'structure-overlap', structureId: partition.id }));
    expect(validatePartitionPlacement(project, { x: .8, y: .6 }, { x: .8, y: .7 }).valid).toBe(true);
    expect(validatePreflight(project).valid).toBe(true);
  });

  it('checks original wall and pillar markings against already placed floor elements and cameras', () => {
    const project = createSampleProject();
    const baseWall: Structure = { id: 'base-wall', name: '기본 벽', kind: 'wall', immutable: true, protected: true, geometry: { kind: 'segment', start: { x: .3, y: .51 }, end: { x: .7, y: .51 } } };
    expect(validateStructureDrawing(project, baseWall).issues).toContainEqual(expect.objectContaining({ code: 'partition-conflict', elementId: 'element-display' }));
    const pillar: Structure = { id: 'pillar-camera', name: '추가 기둥', kind: 'pillar', immutable: true, protected: true, geometry: { kind: 'rect', bounds: { x: .49, y: .78, width: .04, height: .04 } } };
    expect(validateStructureDrawing(project, pillar).issues).toContainEqual(expect.objectContaining({ code: 'invalid-camera', cameraId: 'camera-entrance' }));
    project.floorPlan!.structures.push({ ...baseWall, geometry: { kind: 'segment', start: { x: .72, y: .3 }, end: { x: .72, y: .65 } } });
    expect(validatePlacement(project, 'element-display', { kind: 'floor-point', x: .72, y: .4, footprint: { width: .1, height: .1 } }).issues).toContainEqual(expect.objectContaining({ code: 'structure-overlap', structureId: 'base-wall' }));
    project.floorPlan!.areas = [];
    project.elements = [];
    project.cameras = [];
    expect(validateStructureDrawing(project, { ...baseWall, geometry: { kind: 'segment', start: { x: .1, y: .3 }, end: { x: .15, y: .3 } } }).valid).toBe(true);
  });

  it('rejects overlapping window/door markings and occupied wall decorations while allowing a free span', () => {
    const project = createSampleProject();
    expect(validateStructureDrawing(project, northOpening('door', .4, .5)).issues).toContainEqual(expect.objectContaining({ code: 'opening-overlap', structureId: 'window-north' }));
    expect(validateStructureDrawing(project, northOpening('window', .7, .8)).issues).toContainEqual(expect.objectContaining({ code: 'element-overlap', elementId: 'element-graphic' }));
    expect(validateStructureDrawing(project, northOpening('window', .1, .2)).valid).toBe(true);
    const offWall = northOpening('window', .1, .2);
    offWall.geometry = { kind: 'segment', start: { x: .16, y: .3 }, end: { x: .25, y: .3 } };
    expect(validateStructureDrawing(project, offWall).issues[0].code).toBe('invalid-coordinate');
  });

  it('allows a door and entrance to describe one exact opening, but not two overlapping openings', () => {
    const project = createSampleProject();
    project.floorPlan!.structures = project.floorPlan!.structures.filter((item) => item.id !== 'entrance-south');
    const door = project.floorPlan!.structures.find((item) => item.id === 'door-south')!;
    const entrance = { ...structuredClone(door), id: 'new-entrance', name: '출입구', kind: 'entrance' as const };
    expect(validateStructureDrawing(project, entrance).valid).toBe(true);
    entrance.wallSpan = { start: .4, end: .55 };
    expect(validateStructureDrawing(project, entrance).issues).toContainEqual(expect.objectContaining({ code: 'opening-overlap', structureId: door.id }));
    expect(validateStructureDrawing(project, { ...door, id: 'second-door' }).valid).toBe(false);
  });

  it('rejects a new doorway whose clearance covers a floor fixture, while allowing an entrance viewpoint', () => {
    const project = createSampleProject();
    const doorway = { ...northOpening('door', .15, .25), clearance: { x: .2, y: .1, width: .1, height: .25 } };
    project.elements.push({ ...project.elements[0], id: 'near-door-fixture', label: '입구 진열대', target: { kind: 'floor-point', x: .25, y: .25, footprint: { width: .06, height: .06 } } });
    expect(validateStructureDrawing(project, doorway).issues).toContainEqual(expect.objectContaining({ code: 'door-clearance', elementId: 'near-door-fixture' }));
    project.elements.find((item) => item.id === 'near-door-fixture')!.status = 'exclude';
    project.cameras.push({ id: 'door-view', name: '입구 시점', x: .25, y: .2, directionDegrees: 90, primary: false });
    expect(validateStructureDrawing(project, doorway).valid).toBe(true);
  });

  it('rejects an identical area while allowing nested floor zones and floor/ceiling layers', () => {
    const project = createSampleProject();
    const floor = project.floorPlan!.areas.find((item) => item.id === 'floor-main')!;
    expect(validateAreaDrawing(project, { ...floor, id: 'duplicate-floor' }).issues[0].code).toBe('area-overlap');
    expect(validateAreaDrawing(project, { ...floor, id: 'new-floor-zone', bounds: { x: .7, y: .3, width: .1, height: .1 } }).valid).toBe(true);
    expect(validateAreaDrawing(project, floor, floor.id).valid).toBe(true);
    project.floorPlan!.areas = project.floorPlan!.areas.filter((item) => item.kind !== 'ceiling');
    expect(validateAreaDrawing(project, { ...floor, id: 'new-ceiling', kind: 'ceiling' }).valid).toBe(true);
  });

  it('rejects passages across a fixture, pillar or partition, while allowing connecting passage sections', () => {
    const project = createSampleProject();
    const passage = { id: 'new-passage', name: '새 동선', kind: 'passage' as const, bounds: { x: .5, y: .48, width: .1, height: .1 } };
    expect(validateAreaDrawing(project, passage).issues).toContainEqual(expect.objectContaining({ code: 'element-overlap', elementId: 'element-display' }));
    expect(validateAreaDrawing(project, { ...passage, bounds: { x: .2, y: .4, width: .1, height: .1 } }).issues).toContainEqual(expect.objectContaining({ code: 'pillar-collision', structureId: 'pillar-west' }));
    project.floorPlan!.structures.push({ id: 'partition', name: '추가 가벽', kind: 'wall', protected: false, immutable: false, geometry: { kind: 'segment', start: { x: .7, y: .6 }, end: { x: .8, y: .6 } } });
    expect(validateAreaDrawing(project, { ...passage, bounds: { x: .7, y: .58, width: .1, height: .1 } }).issues).toContainEqual(expect.objectContaining({ code: 'partition-conflict', structureId: 'partition' }));
    expect(validateAreaDrawing(project, { ...passage, bounds: { x: .52, y: .75, width: .12, height: .1 } }).valid).toBe(true);
  });

  it('rejects passages crossing an original interior wall but permits ending on the entrance boundary', () => {
    const project = createSampleProject();
    project.floorPlan!.structures.push({ id: 'interior-base-wall', name: '기존 내부 벽', kind: 'wall', immutable: true, protected: true, geometry: { kind: 'segment', start: { x: .72, y: .3 }, end: { x: .72, y: .65 } } });
    const passage = { id: 'passage-test', name: '새 동선', kind: 'passage' as const, bounds: { x: .68, y: .35, width: .1, height: .1 } };
    expect(validateAreaDrawing(project, passage).issues).toContainEqual(expect.objectContaining({ code: 'structure-overlap', structureId: 'interior-base-wall' }));
    expect(validateAreaDrawing(project, { ...passage, bounds: { x: .44, y: .79, width: .1, height: .11 } }).valid).toBe(true);
  });
});

describe('physical elements reserve their own surface layer', () => {
  it('rejects fixture overlap during a move and preflight, preserving the previous placement', () => {
    const project = createSampleProject();
    const otherTarget = { kind: 'floor-point' as const, x: .75, y: .4, footprint: { width: .12, height: .1 } };
    project.elements.push({ ...project.elements[0], id: 'other-display', label: '두 번째 진열대', target: otherTarget });
    const oldTarget = project.elements[0].target;
    const rejected = placeElement(project, 'element-display', otherTarget);
    expect(rejected.validation.issues[0].code).toBe('element-overlap');
    expect(rejected.project).toBe(project);
    expect(rejected.project.elements[0].target).toBe(oldTarget);
    project.elements[0].target = otherTarget;
    expect(validatePreflight(project).issues.some((issue) => issue.code === 'element-overlap')).toBe(true);
    project.elements.find((item) => item.id === 'other-display')!.status = 'exclude';
    expect(validatePlacement(project, 'element-display', otherTarget).valid).toBe(true);
  });

  it('checks bounded floor fixtures against other fixtures but allows floor material underneath', () => {
    const project = createSampleProject();
    project.floorPlan!.areas.push({ id: 'display-zone', name: '진열대 영역', kind: 'floor', bounds: { x: .44, y: .45, width: .18, height: .12 } });
    project.elements.push({ ...project.elements[0], id: 'other-display', label: '다른 진열대', target: null });
    expect(validatePlacement(project, 'other-display', { kind: 'floor-area', areaId: 'display-zone' }).issues.some((issue) => issue.code === 'element-overlap')).toBe(true);
    project.elements.push({ ...project.elements[0], id: 'floor-finish', label: '바닥 마감', kind: 'floor-material', target: null });
    expect(validatePlacement(project, 'floor-finish', { kind: 'floor-area', areaId: 'floor-main' }).valid).toBe(true);
  });

  it('rejects another wall decoration on an occupied span while preserving kept-wall decoration', () => {
    const project = createSampleProject();
    project.elements.push({ ...project.elements.find((item) => item.id === 'element-graphic')!, id: 'other-art', label: '추가 벽 장식', target: null });
    expect(validatePlacement(project, 'other-art', { kind: 'wall-segment', wallId: 'wall-north', start: .7, end: .8 }).issues.some((issue) => issue.code === 'element-overlap')).toBe(true);
    expect(validatePlacement(project, 'other-art', { kind: 'wall-segment', wallId: 'wall-north', start: .1, end: .2 }).valid).toBe(true);
    expect(validatePlacement(project, 'element-graphic', project.elements.find((item) => item.id === 'element-graphic')!.target).valid).toBe(true);
  });

  it('allows furniture below a ceiling fixture and ambience across both, but refuses two fixtures in one ceiling zone', () => {
    const project = createSampleProject();
    project.floorPlan!.areas.push({ id: 'display-ceiling', name: '진열대 위 천장', kind: 'ceiling', bounds: { x: .44, y: .45, width: .18, height: .12 } });
    project.elements.push({ ...project.elements[0], id: 'ceiling-fixture', label: '행잉 조명', kind: 'ceiling-light', target: { kind: 'ceiling-zone', zoneId: 'display-ceiling' } });
    expect(validatePlacement(project, 'ceiling-fixture', { kind: 'ceiling-zone', zoneId: 'display-ceiling' }).valid).toBe(true);
    expect(validatePlacement(project, 'element-warm-light', { kind: 'whole-space' }).valid).toBe(true);
    project.elements.push({ ...project.elements[0], id: 'hanging-display', label: '행잉 장식', kind: 'hanging-display', target: null });
    expect(validatePlacement(project, 'hanging-display', { kind: 'ceiling-zone', zoneId: 'display-ceiling' }).issues[0].code).toBe('element-overlap');
    project.floorPlan!.areas.push({ id: 'free-ceiling', name: '다른 천장', kind: 'ceiling', bounds: { x: .7, y: .3, width: .1, height: .1 } });
    expect(validatePlacement(project, 'hanging-display', { kind: 'ceiling-zone', zoneId: 'free-ceiling' }).valid).toBe(true);
  });

  it('reserves a fixed existing ceiling light only on the ceiling layer', () => {
    const project = createSampleProject();
    const light: Structure = { id: 'existing-light', kind: 'existing-light', name: '기존 조명', immutable: true, protected: true, geometry: { kind: 'circle', center: { x: .53, y: .51 }, radius: .025 } };
    expect(validateStructureDrawing(project, light).valid).toBe(true);
    project.floorPlan!.structures.push(light);
    expect(validateStructureDrawing(project, { ...light, id: 'duplicate-light' }).issues[0].code).toBe('structure-overlap');
    project.elements.push({ ...project.elements[0], id: 'new-light', label: '추가 천장 조명', kind: 'ceiling-light', target: null });
    expect(validatePlacement(project, 'new-light', { kind: 'ceiling-zone', zoneId: 'ceiling-main' }).issues).toContainEqual(expect.objectContaining({ code: 'element-overlap', structureId: light.id }));
    expect(validatePlacement(project, 'element-display', project.elements[0].target).valid).toBe(true);
  });
});
