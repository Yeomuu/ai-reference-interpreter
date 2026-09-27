import { describe, expect, it } from 'vitest';
import { createSampleProject } from '../data/sample';
import {
  addCamera,
  allowedTargetKinds,
  cameraConditionsChanged,
  createConditionsSnapshot,
  placeElement,
  removeKeep,
  setKeeps,
  updateCamera,
  updateElement,
  updatePhotoAnchor,
  validateCamera,
  validatePlacement,
  validatePartitionPlacement,
  validatePreflight,
  validateStructureOperation,
} from './index';

describe('typed spatial placement', () => {
  it('accepts the complete AURA POP-UP sample and keeps excluded items out of applied snapshot', () => {
    const project = createSampleProject();
    expect(validatePreflight(project)).toEqual({ valid: true, issues: [] });
    expect(project.results[0].origin).toBe('sample');
    expect(project.results[0].conditionsSnapshot.appliedElementIds).not.toContain('element-cool-light');
    expect(allowedTargetKinds('wall-graphic')).toEqual(['wall-segment']);
    expect(allowedTargetKinds('ambient-light')).toEqual(['whole-space', 'named-area']);
  });

  it('permits removable graphics on an allowed kept wall, but rejects replacement and opening overlap', () => {
    const project = createSampleProject();
    expect(validatePlacement(project, 'element-graphic', {
      kind: 'wall-segment', wallId: 'wall-north', start: 0.68, end: 0.90,
    }).valid).toBe(true);
    expect(validateStructureOperation(project, 'wall-north', 'surface-treatment').valid).toBe(true);
    expect(validateStructureOperation(project, 'wall-north', 'remove').issues[0].code).toBe('keep-conflict');
    expect(validatePlacement(project, 'element-graphic', {
      kind: 'wall-segment', wallId: 'wall-north', start: 0.40, end: 0.50,
    }).issues.some((issue) => issue.code === 'opening-overlap')).toBe(true);
    const materialProject = updateElement(project, 'element-graphic', { kind: 'wall-material' });
    expect(validatePlacement(materialProject, 'element-graphic', {
      kind: 'wall-segment', wallId: 'wall-north', start: 0.68, end: 0.90,
    }).issues.some((issue) => issue.code === 'keep-conflict')).toBe(true);
  });

  it('rejects pillar, door, passage and incompatible targets without changing the prior valid placement', () => {
    const project = createSampleProject();
    const previousTarget = project.elements.find((element) => element.id === 'element-display')?.target;
    const pillar = placeElement(project, 'element-display', {
      kind: 'floor-point', x: 0.245, y: 0.45, footprint: { width: 0.10, height: 0.10 },
    });
    expect(pillar.validation.issues.some((issue) => issue.code === 'pillar-collision')).toBe(true);
    expect(pillar.project).toBe(project);
    expect(pillar.project.elements.find((element) => element.id === 'element-display')?.target).toEqual(previousTarget);
    const doorway = validatePlacement(project, 'element-display', {
      kind: 'floor-point', x: 0.50, y: 0.81, footprint: { width: 0.11, height: 0.10 },
    });
    expect(doorway.issues.map((issue) => issue.code)).toContain('door-clearance');
    expect(doorway.issues.map((issue) => issue.code)).toContain('passage-blocked');
    expect(validatePlacement(project, 'element-display', {
      kind: 'wall-segment', wallId: 'wall-east', start: 0.1, end: 0.3,
    }).issues[0].code).toBe('invalid-target-kind');
    expect(validatePlacement(project, 'element-graphic', {
      kind: 'floor-point', x: 0.5, y: 0.5,
    }).issues[0].code).toBe('invalid-target-kind');
    expect(validatePlacement(project, 'element-warm-light', {
      kind: 'floor-point', x: 0.5, y: 0.5,
    }).issues[0].code).toBe('invalid-target-kind');
  });

  it('checks the footprint after rotation against kept pillars', () => {
    const project = createSampleProject();
    const target = { kind: 'floor-point' as const, x: 0.245, y: 0.57,
      footprint: { width: 0.20, height: 0.04 } };
    expect(validatePlacement(project, 'element-display', { ...target, rotationDegrees: 0 }).valid).toBe(true);
    expect(validatePlacement(project, 'element-display', { ...target, rotationDegrees: 90 }).issues)
      .toContainEqual(expect.objectContaining({ code: 'pillar-collision', structureId: 'pillar-west' }));
  });

  it('checks circular pillars when a fixture occupies a floor area', () => {
    const project = createSampleProject();
    const plan = project.floorPlan!;
    const pillar = plan.structures.find((structure) => structure.id === 'pillar-west')!;
    pillar.geometry = { kind: 'circle', center: { x: 0.25, y: 0.45 }, radius: 0.04 };
    plan.areas.push({ id: 'floor-pillar', name: '기둥 주변 바닥', kind: 'floor',
      bounds: { x: 0.20, y: 0.40, width: 0.10, height: 0.12 } });
    expect(validatePlacement(project, 'element-display', { kind: 'floor-area', areaId: 'floor-pillar' }).issues)
      .toContainEqual(expect.objectContaining({ code: 'pillar-collision', structureId: 'pillar-west' }));
  });

  it('uses the plan aspect ratio for circular pillar clearance', () => {
    const project = createSampleProject();
    const pillar = project.floorPlan!.structures.find((structure) => structure.id === 'pillar-west')!;
    pillar.geometry = { kind: 'circle', center: { x: 0.25, y: 0.45 }, radius: 0.04 };
    expect(validatePlacement(project, 'element-display', {
      kind: 'floor-point', x: 0.305, y: 0.45,
      footprint: { width: 0.04, height: 0.04 },
    }).valid).toBe(true);
  });

  it('blocks preview when an applied element lacks a placement and points to it', () => {
    const project = createSampleProject();
    project.elements.find((element) => element.id === 'element-display')!.target = null;
    const preflight = validatePreflight(project);
    expect(preflight.valid).toBe(false);
    expect(preflight.issues).toContainEqual(expect.objectContaining({
      code: 'missing-target', elementId: 'element-display',
    }));
  });

  it('validates the selected extra camera as well as the required primary camera', () => {
    const project = addCamera(createSampleProject(), {
      id: 'camera-outside', name: '도면 밖', x: 0.99, y: 0.99,
      directionDegrees: 180, primary: false,
    });
    expect(validatePreflight(project).valid).toBe(true);
    expect(validatePreflight(project, 'camera-outside').issues).toContainEqual(expect.objectContaining({
      code: 'invalid-camera', cameraId: 'camera-outside',
    }));
    expect(validatePreflight(project, 'camera-missing').issues).toContainEqual(expect.objectContaining({
      code: 'invalid-camera', cameraId: 'camera-missing',
    }));
  });

  it('rejects cameras inside a circular pillar or an applied floor fixture', () => {
    const project = createSampleProject();
    const pillar = project.floorPlan!.structures.find((structure) => structure.id === 'pillar-west')!;
    pillar.geometry = { kind: 'circle', center: { x: .25, y: .45 }, radius: .04 };
    const insidePillar = updateCamera(project, 'camera-entrance', { x: .25, y: .45 });
    expect(validateCamera(insidePillar, 'camera-entrance').issues)
      .toContainEqual(expect.objectContaining({ code: 'invalid-camera', structureId: 'pillar-west' }));

    const insideFixture = updateCamera(project, 'camera-entrance', { x: .53, y: .51 });
    expect(validateCamera(insideFixture, 'camera-entrance').issues)
      .toContainEqual(expect.objectContaining({ code: 'invalid-camera', elementId: 'element-display' }));
    insideFixture.elements.find((element) => element.id === 'element-display')!.status = 'exclude';
    expect(validateCamera(insideFixture, 'camera-entrance').valid).toBe(true);
  });

  it('rejects cameras on either original or removable wall segments while allowing nearby floor', () => {
    const project = createSampleProject();
    const onOriginalWall = updateCamera(project, 'camera-entrance', { x: .30, y: .10 });
    expect(validateCamera(onOriginalWall, 'camera-entrance').issues)
      .toContainEqual(expect.objectContaining({ code: 'invalid-camera', structureId: 'wall-north' }));

    project.floorPlan!.structures.push({
      id: 'temporary-partition', kind: 'wall', name: '추가 가벽',
      geometry: { kind: 'segment', start: { x: .4, y: .6 }, end: { x: .6, y: .6 } },
      immutable: false, protected: false,
    });
    const onPartition = updateCamera(project, 'camera-entrance', { x: .5, y: .6 });
    expect(validateCamera(onPartition, 'camera-entrance').issues)
      .toContainEqual(expect.objectContaining({ code: 'invalid-camera', structureId: 'temporary-partition' }));
    expect(validateCamera(updateCamera(project, 'camera-entrance', { x: .5, y: .63 }), 'camera-entrance').valid).toBe(true);
  });

  it('rejects a camera in a physical fixture assigned to a floor zone', () => {
    const project = createSampleProject();
    project.elements.find((element) => element.id === 'element-display')!.target = { kind: 'floor-area', areaId: 'floor-main' };
    expect(validateCamera(project, 'camera-entrance').issues)
      .toContainEqual(expect.objectContaining({ code: 'invalid-camera', elementId: 'element-display' }));
  });

  it('does not mistake inspiration for a required existing-space photo', () => {
    const project = createSampleProject();
    project.sourceImages = project.sourceImages.filter((image) => image.role !== 'existing-space');
    expect(validatePreflight(project).issues.map((issue) => issue.code)).toContain('missing-existing-photo');
  });

  it('blocks preview while a replacement plan awaits alignment review', () => {
    const project = createSampleProject();
    project.planAlignmentPending = true;
    const preflight = validatePreflight(project);
    expect(preflight.valid).toBe(false);
    expect(preflight.issues).toContainEqual(expect.objectContaining({
      code: 'plan-alignment-pending', severity: 'error',
    }));
  });

  it('blocks a project without an applied reference element from opening the fixed demo image', () => {
    const project = createSampleProject();
    project.elements = project.elements.map((element) => ({ ...element, status: 'exclude' }));
    const preflight = validatePreflight(project);
    expect(preflight.valid).toBe(false);
    expect(preflight.issues).toContainEqual(expect.objectContaining({ code: 'missing-applied-element' }));
  });
});

describe('revision scope', () => {
  it('keeps compatible placement through a kind change but clears an incompatible anchor', () => {
    const project = createSampleProject();
    const displayTarget = project.elements.find((element) => element.id === 'element-display')!.target;
    const furniture = updateElement(project, 'element-display', { kind: 'furniture' });
    expect(furniture.elements.find((element) => element.id === 'element-display')?.target).toEqual(displayTarget);
    expect(furniture.elements.find((element) => element.id === 'element-graphic')).toEqual(
      project.elements.find((element) => element.id === 'element-graphic'),
    );
    expect(updateElement(project, 'element-display', { kind: 'wall-graphic' })
      .elements.find((element) => element.id === 'element-display')?.target).toBeNull();
    expect(updateElement(project, 'element-graphic', { kind: 'wall-material' })
      .elements.find((element) => element.id === 'element-graphic')?.target).toBeNull();
  });

  it('stales all prior results after a common edit while preserving unrelated settings', () => {
    const project = createSampleProject();
    const next = updateElement(project, 'element-display', { conditions: '진열대를 이동식으로 유지' });
    expect(next.commonRevision).toBe(project.commonRevision + 1);
    expect(next.results[0].stale).toBe(true);
    expect(next.elements.find((element) => element.id === 'element-graphic')).toEqual(
      project.elements.find((element) => element.id === 'element-graphic'),
    );
    expect(next.results[0].conditionsSnapshot.common?.elements.find((element) => element.id === 'element-display')?.conditions)
      .toBe('이동 가능한 독립형 구조');
    expect(project.results[0].stale).toBe(false);
    expect(updateElement(project, 'element-display', { conditions: project.elements[0].conditions })).toBe(project);
  });

  it('stales only an edited camera’s result and retains common revision', () => {
    const project = createSampleProject();
    const withSecond = addCamera(project, {
      id: 'camera-side', name: '측면', x: 0.75, y: 0.55, directionDegrees: 180, primary: false,
    });
    withSecond.results.push({
      ...structuredClone(withSecond.results[0]), id: 'result-side', cameraId: 'camera-side',
      conditionsSnapshot: {
        ...structuredClone(withSecond.results[0].conditionsSnapshot),
        camera: { id: 'camera-side', x: 0.75, y: 0.55, directionDegrees: 180 },
      },
    });
    const next = updateCamera(withSecond, 'camera-side', { directionDegrees: 160 });
    expect(next.commonRevision).toBe(withSecond.commonRevision);
    expect(next.results.find((result) => result.id === 'result-side')?.stale).toBe(true);
    expect(next.results.find((result) => result.id === 'result-sample-entrance')?.stale).toBe(false);
    expect(next.elements).toBe(withSecond.elements);
    expect(next.cameras.find((camera) => camera.id === 'camera-entrance')?.primary).toBe(true);
  });

  it('marks an in-flight result stale when the camera field of view changes', () => {
    const project = createSampleProject();
    const existingPhotoId = project.sourceImages.find((image) => image.role === 'existing-space')!.id;
    const saved = createConditionsSnapshot(project, 'camera-entrance', existingPhotoId)!;
    const current = project.cameras.find((camera) => camera.id === 'camera-entrance')!;
    expect(saved.existingPhotoId).toBe(existingPhotoId);
    expect(saved.camera.fovPreset).toBe(current.fovPreset ?? 'standard');
    expect(cameraConditionsChanged(current, saved.camera)).toBe(false);

    const edited = updateCamera(project, current.id, { fovPreset: 'wide' });
    expect(cameraConditionsChanged(edited.cameras.find((camera) => camera.id === current.id), saved.camera)).toBe(true);
    expect(edited.results.find((result) => result.cameraId === current.id)?.stale).toBe(true);

    const legacySnapshot = { ...saved.camera, fovPreset: undefined };
    expect(cameraConditionsChanged({ ...current, fovPreset: 'standard' }, legacySnapshot)).toBe(false);
    expect(cameraConditionsChanged({ ...current, fovPreset: 'wide' }, legacySnapshot)).toBe(true);
  });

  it('stales results when Keep permissions change', () => {
    const project = createSampleProject();
    const keeps = project.keeps.map((keep) => keep.id === 'keep-wall' ? { ...keep, allowedSurfaceTreatment: false } : keep);
    const next = setKeeps(project, keeps);
    expect(next.results[0].stale).toBe(true);
    expect(validatePreflight(next).issues.map((issue) => issue.code)).toContain('keep-conflict');
  });

  it('keeps original structures fixed while allowing an optional partition to be removed', () => {
    const project = createSampleProject();
    expect(removeKeep(project, 'keep-pillar')).toBe(project);
    const stripped = setKeeps(project, []);
    expect(stripped.keeps.some((keep) => keep.structureId === 'pillar-west')).toBe(true);
    expect(stripped.floorPlan?.structures.find((item) => item.id === 'pillar-west')?.protected).toBe(true);
    project.floorPlan!.structures.push({
      id: 'temporary-partition', kind: 'wall', name: '추가 가벽',
      geometry: { kind: 'segment', start: { x: .7, y: .6 }, end: { x: .8, y: .6 } },
      immutable: false, protected: false,
    });
    expect(validateStructureOperation(project, 'temporary-partition', 'remove').valid).toBe(true);
    expect(validateStructureOperation(project, 'pillar-west', 'move').valid).toBe(false);
  });

  it('rejects a proposed partition crossing furniture, a pillar, or an entrance passage', () => {
    const project = createSampleProject();
    expect(validatePartitionPlacement(project, { x: .7, y: .6 }, { x: .8, y: .6 }).valid).toBe(true);
    expect(validatePartitionPlacement(project, { x: .01, y: .6 }, { x: .07, y: .6 }).issues)
      .toContainEqual(expect.objectContaining({ code: 'outside-floor' }));
    expect(validatePartitionPlacement(project, { x: .3, y: .51 }, { x: .7, y: .51 }).issues)
      .toContainEqual(expect.objectContaining({ code: 'partition-conflict', elementId: 'element-display' }));
    expect(validatePartitionPlacement(project, { x: .23, y: .3 }, { x: .23, y: .6 }).issues)
      .toContainEqual(expect.objectContaining({ code: 'pillar-collision', structureId: 'pillar-west' }));
    const entrance = validatePartitionPlacement(project, { x: .5, y: .7 }, { x: .5, y: .89 });
    expect(entrance.issues.map((issue) => issue.code)).toContain('door-clearance');
    expect(entrance.issues.map((issue) => issue.code)).toContain('passage-blocked');
  });

  it('prevents a new partition from being placed through an existing camera', () => {
    const project = addCamera(createSampleProject(), {
      id: 'camera-side', name: '측면 카메라', x: .75, y: .6,
      directionDegrees: 180, primary: false,
    });
    expect(validatePartitionPlacement(project, { x: .7, y: .6 }, { x: .8, y: .6 }).issues)
      .toContainEqual(expect.objectContaining({ code: 'partition-conflict', cameraId: 'camera-side' }));
    expect(validatePartitionPlacement(project, { x: .7, y: .63 }, { x: .8, y: .63 }).valid).toBe(true);
  });

  it('prevents later furniture placement across an optional partition and flags an old conflict before preview', () => {
    const project = createSampleProject();
    project.floorPlan!.structures.push({
      id: 'temporary-partition', kind: 'wall', name: '추가 가벽',
      geometry: { kind: 'segment', start: { x: .7, y: .6 }, end: { x: .8, y: .6 } },
      immutable: false, protected: false,
    });
    const oldTarget = project.elements.find((element) => element.id === 'element-display')!.target;
    const rejected = placeElement(project, 'element-display', {
      kind: 'floor-point', x: .75, y: .6, footprint: { width: .1, height: .08 },
    });
    expect(rejected.validation.issues.map((issue) => issue.code)).toContain('partition-conflict');
    expect(rejected.project.elements.find((element) => element.id === 'element-display')?.target).toBe(oldTarget);
    project.floorPlan!.structures.find((structure) => structure.id === 'temporary-partition')!.geometry = {
      kind: 'segment', start: { x: .3, y: .51 }, end: { x: .7, y: .51 },
    };
    expect(validatePreflight(project).issues.map((issue) => issue.code)).toContain('partition-conflict');
  });

  it('allows only a registered existing ceiling fixture to change light tone', () => {
    const project = createSampleProject();
    project.floorPlan!.structures.push({
      id: 'existing-fixture', kind: 'existing-light', name: '기존 천장 조명',
      geometry: { kind: 'circle', center: { x: .6, y: .3 }, radius: .025 },
      immutable: true, protected: true, lightTone: '온백색',
    });
    expect(validateStructureOperation(project, 'existing-fixture', 'light-tone').valid).toBe(true);
    expect(validateStructureOperation(project, 'existing-fixture', 'move').valid).toBe(false);
    expect(validateStructureOperation(project, 'existing-fixture', 'surface-treatment').valid).toBe(false);
    expect(validateStructureOperation(project, 'wall-north', 'light-tone').valid).toBe(false);
  });

  it('treats photo label adjustments as display-only metadata', () => {
    const project = createSampleProject();
    const next = updatePhotoAnchor(project, 'wall-north', { x: .3, y: .25 });
    expect(next.floorPlan?.structures.find((item) => item.id === 'wall-north')?.photoAnchor).toEqual({ x: .3, y: .25 });
    expect(next.commonRevision).toBe(project.commonRevision);
    expect(next.results).toBe(project.results);
    expect(updatePhotoAnchor(project, 'wall-north', { x: 2, y: 0 })).toBe(project);
  });
});
