import { describe, expect, it } from 'vitest';
import { createSampleProject } from '../src/data/sample';
import { prepareRecommendedCameras } from '../src/domain/cameraRecommendations';
import { createCampusProject } from '../src/data/campus';
import { buildPlanGuideSvg, elementPlanPosition, matchesPlanGuide, planGuideManifest, type PlanGuidePalette } from '../src/services/planGuide';
import { buildGenerationPrompt, type GenerationImage } from '../src/services/generationContract';

const palette: PlanGuidePalette = { paper: 'white', ink: 'black', structure: 'gray', info: 'blue', selected: 'purple', subtle: 'white', border: 'gray' };

describe('saved plan guide and scoped visual transfer', () => {
  it('links precise plan anchors to the same element keys in the visual guide', () => {
    const project = createSampleProject();
    const element = project.elements.find(item => item.id === 'element-display')!;
    element.target = { kind: 'floor-point', x: .3125, y: .4567, footprint: { width: .08, height: .12 } };
    const prompt = buildGenerationPrompt(project, 'camera-entrance', []);
    const guide = buildPlanGuideSvg(project, 'camera-entrance', palette);
    expect(prompt).toContain(`E01 ${element.label}`);
    expect(guide).toContain(`E01 ${element.label}`);
    expect(prompt).toContain('Plan anchor x=0.3125, y=0.4567');
    expect(prompt).toContain(`logical plan x=${Number((.3125 * project.floorPlan!.width).toFixed(4))}`);
    expect(prompt).toContain('NOT meters, photo pixels, image-output pixels');
    expect(prompt).toContain('TOP-LEFT of the plan content');
    expect(prompt).toContain('No artificial film grain');
  });

  it('transmits wall endpoints and ceiling offsets without treating a ceiling as the floor', () => {
    const project = createSampleProject();
    project.elements.push({ id: 'offset-light', label: '지정 위치 천장등', kind: 'ceiling-light', status: 'apply', sourceReferenceId: '',
      target: { kind: 'ceiling-zone', zoneId: 'ceiling-main', offset: { x: .2345, y: .6789 }, height: '기존 천장' } });
    const prompt = buildGenerationPrompt(project, 'camera-entrance', []);
    expect(prompt).toContain('local offset x=0.2345, y=0.6789');
    expect(prompt).toContain('attach to the ceiling, never to the floor');
    expect(prompt).toContain('endpoints x=');
    const position = elementPlanPosition(project, project.elements.at(-1)!)!;
    expect(prompt).toContain(`Plan anchor x=${Number(position.x.toFixed(4))}, y=${Number(position.y.toFixed(4))}`);
  });

  it('includes physical ceiling objects and floor footprints without losing mapped wall spans', () => {
    const project = createSampleProject();
    project.elements.push({ id: 'ceiling-exhibit', label: '천장 작품', kind: 'other-ceiling', status: 'apply', sourceReferenceId: '', target: { kind: 'ceiling-zone', zoneId: 'ceiling-main', offset: { x: .2, y: .3 } } });
    project.elements.push({ id: 'floor-exhibit', label: '바닥 작품', kind: 'freestanding-fixture', status: 'apply', sourceReferenceId: '', target: { kind: 'floor-area', areaId: 'floor-main' } });
    project.elements.find(item => item.id === 'element-graphic')!.origin = 'mapping-condition';
    const guide = buildPlanGuideSvg(project, 'camera-entrance', palette);
    const position = elementPlanPosition(project, project.elements.find(item => item.id === 'ceiling-exhibit')!)!;
    expect(position.x).toBeCloseTo(.08 + .84 * .2);
    expect(position.y).toBeCloseTo(.10 + .80 * .3);
    expect(guide).toContain('<g data-element-id="ceiling-exhibit"><circle');
    expect(guide).toContain('>천장</text>');
    expect(guide).toMatch(/<(rect|polygon) [^>]*data-element-id="floor-exhibit"/);
    expect(guide).toContain('<line data-element-id="element-graphic"');
  });

  it.each(['overview', 'entry'] as const)('uses the furnished real photo as the architecture base and clears only unsaved movable furnishings for %s', view => {
    const project = prepareRecommendedCameras(createCampusProject('exhibition'));
    const camera = project.cameras.find(item => item.viewPreset === view)!;
    const prompt = buildGenerationPrompt(project, camera.id, [{ role: 'existing-space', sourceId: 'campus-photo-front', dataUrl: '' }]);
    expect(prompt).toContain('FIRST existing-space photograph as the architectural base');
    expect(prompt).toContain('unless retained by saved preservation conditions or specified in the proposed layout');
    expect(prompt).toContain('Install ONLY saved layout objects at their registered positions');
    expect(prompt).toContain('NEVER removes fixed walls, windows, doors, pillars, ceiling, permanent fixtures');
    expect(prompt).toContain('single concept image, not a second image-generation call');
    expect(prompt).toContain('including a kept whiteboard');
    expect(prompt).not.toContain('Existing movable classroom desks and chairs may be rearranged');
  });

  it('keeps the actual school whiteboard visible instead of moving graphics onto it', () => {
    const project = prepareRecommendedCameras(createCampusProject('exhibition'));
    const prompt = buildGenerationPrompt(project, project.cameras.find(camera=>camera.primary)!.id, [{ role: 'existing-space', sourceId: 'campus-photo-front', dataUrl: '' }]);
    expect(prompt).toContain('whiteboard visible across the front wall');
    expect(prompt).toContain('leave the graphic out of frame');
  });
  it('describes a graduation exhibition as a school-room exhibition, not a retail pop-up', () => {
    const project = createSampleProject();
    project.spaceType = '졸업전시';
    project.name = '한국공학대학교 프로젝트룸';
    const prompt = buildGenerationPrompt(project, 'camera-entrance', [{ role: 'existing-space', sourceId: 'photo-existing', dataUrl: '' }]);
    expect(prompt).toContain('graduation exhibition installed in the existing school room');
    expect(prompt).toContain('graduation exhibition display scale');
    expect(prompt).not.toContain('installed pop-up retail/VMD space');
    project.name = '기존 전시관';
    const otherExhibition = buildGenerationPrompt(project, 'camera-entrance', [{ role: 'existing-space', sourceId: 'photo-existing', dataUrl: '' }]);
    expect(otherExhibition).toContain('an exhibition installed in the existing space');
    expect(otherExhibition).not.toContain('school room');
  });

  it('keeps a portrait polygon, actual fixtures and only the chosen camera in the guide', () => {
    const project = createSampleProject(), plan = project.floorPlan!;
    project.cameras.push({ ...project.cameras[0], id: 'camera-side', name: '옆 시점', primary: false });
    plan.width = 600; plan.height = 1200;
    plan.areas[0].outline = [{ x: .1, y: .1 }, { x: .9, y: .1 }, { x: .9, y: .8 }, { x: .5, y: .8 }, { x: .5, y: .9 }, { x: .1, y: .9 }];
    const svg = buildPlanGuideSvg(project, 'camera-side', palette);
    expect(svg).toContain('width="576" height="1088"');
    expect(svg).toContain('points="48,96 432,96 432,768 240,768 240,864 48,864"');
    expect(svg).toContain('data-element-id="element-display"');
    expect(svg).toContain('data-structure-id="pillar-west"');
    expect(svg).toContain('data-camera-id="camera-side"');
    expect(svg).not.toContain('data-camera-id="camera-entrance"');
    expect(svg).not.toContain('data-element-id="element-cool-light"');
    expect(svg).toContain('치수 미확인');
  });

  it('places display products on their rotated support rather than an independent floor point', () => {
    const project = createSampleProject(), host = project.elements[0];
    host.target = { kind: 'floor-point', x: .5, y: .5, footprint: { width: .2, height: .1 }, rotationDegrees: 90 };
    const product = { ...host, id: 'product-on-support', kind: 'display-product' as const,
      target: { kind: 'fixture-surface' as const, fixtureElementId: host.id, offset: { x: .75, y: .5 } } };
    project.elements.push(product);
    const position = elementPlanPosition(project, product)!;
    expect(position.x).toBeCloseTo(.5);
    expect(position.y).toBeGreaterThan(.5);
    expect(buildPlanGuideSvg(project, 'camera-entrance', palette)).toContain('rotate(90');
  });

  it('includes an uploaded plan background and rejects a missing or external background', () => {
    const project = createSampleProject(); project.floorPlan!.kind = 'uploaded';
    expect(() => buildPlanGuideSvg(project, 'camera-entrance', palette)).toThrow('도면 이미지');
    expect(() => buildPlanGuideSvg(project, 'camera-entrance', palette, 'https://example.test/plan.jpg')).toThrow('도면 이미지');
    expect(buildPlanGuideSvg(project, 'camera-entrance', palette, 'data:image/jpeg;base64,/9j/')).toContain('href="data:image/jpeg;base64,/9j/"');
  });

  it('escapes user text instead of injecting active SVG content', () => {
    const project = createSampleProject(); project.floorPlan!.structures[0].name = '<script>&"';
    const svg = buildPlanGuideSvg(project, 'camera-entrance', palette);
    expect(svg).not.toContain('<script>'); expect(svg).toContain('&lt;script&gt;&amp;&quot;');
  });

  it('binds the guide metadata to saved revision, aspect and selected view', () => {
    const project = createSampleProject(), manifest = planGuideManifest(project, 'camera-entrance');
    expect(matchesPlanGuide(project, 'camera-entrance', manifest)).toBe(true);
    expect(matchesPlanGuide(project, 'camera-side', manifest)).toBe(false);
    project.commonRevision++;
    expect(matchesPlanGuide(project, 'camera-entrance', manifest)).toBe(false);
    expect(matchesPlanGuide(project, 'camera-entrance', { ...planGuideManifest(project, 'camera-entrance'), width: 1 })).toBe(false);
  });

  it('keeps openings on their saved wall and column cross-sections relative to each selected camera', () => {
    const project = createSampleProject();
    const images: GenerationImage[] = [{ role: 'existing-space', sourceId: 'photo-existing', dataUrl: '' }];
    const front = buildGenerationPrompt(project, 'camera-entrance', images);
    expect(front).toContain('후면 창 [window]: in front, near the sight line. Attached to the saved wall 후면 벽 at wall span 34%–62%.');
    expect(front).toContain('출입문 [door]: behind the camera; do not force it into view');
    expect(front).toContain('기존 기둥 [pillar]: in front, camera-left. Rectangular column cross-section');
    expect(front).toContain('never a cylindrical column');
    project.cameras.push({ ...project.cameras[0], id: 'camera-side', x: .18, y: .5, directionDegrees: 0, primary: false });
    const side = buildGenerationPrompt(project, 'camera-side', images);
    expect(side).toContain('후면 창 [window]: in front, camera-left. Attached to the saved wall 후면 벽');
    expect(side).toContain('This is a side wall running along the sight line');
    const pillar = project.floorPlan!.structures.find(item => item.kind === 'pillar')!;
    pillar.geometry = { kind: 'circle', center: { x: .25, y: .45 }, radius: .05 };
    const round = buildGenerationPrompt(project, 'camera-side', images);
    expect(round).toContain('Circular column cross-section');
    expect(round).not.toContain('never a cylindrical column');
  });

  it('separates warm lighting from paint/material transfer and points to the actual layout input', () => {
    const project = createSampleProject();
    const images: GenerationImage[] = [{ role: 'existing-space', sourceId: 'photo-existing', dataUrl: '' },
      { role: 'floor-plan', sourceId: 'floor-plan', dataUrl: '', planGuide: planGuideManifest(project, 'camera-entrance') },
      { role: 'inspiration', sourceId: 'photo-atmosphere', dataUrl: '' }];
    const prompt = buildGenerationPrompt(project, 'camera-entrance', images);
    expect(prompt).toContain('authoritative 2D layout');
    expect(prompt).toContain('room footprint is a RECTANGLE');
    expect(prompt).toContain('curvature must not deform the room shell');
    expect(prompt).toContain('Architectural curves, arches, niches');
    expect(prompt).toContain('white walls and unlit surfaces remain neutral white');
    expect(prompt).toContain('not a room-filling counter');
    expect(prompt).toContain('do not transfer this element to a side wall');
    expect(prompt).toContain('SAME wall plane with 후면 창');
    expect(prompt).toContain('Transfer illumination only');
    expect(prompt).toContain('NOT a yellow wall/floor color reference');
    expect(prompt).toContain('Compatible removable decoration may be mounted on a kept wall');
    expect(prompt).toContain('at whole space');
    expect(prompt).toContain('input image 3');
    expect(prompt).toContain('in front, camera-right');
    const wall = project.floorPlan!.structures.find(item => item.id === 'wall-north')!;
    if (wall.geometry.kind === 'segment') {
      wall.geometry.end.y += .05;
      expect(buildGenerationPrompt(project, 'camera-entrance', images)).not.toContain('room footprint is a RECTANGLE');
      wall.geometry.end.y -= .05;
    }
    project.elements[1].kind = 'global-palette';
    expect(buildGenerationPrompt(project, 'camera-entrance', images)).not.toContain('Transfer illumination only');
    expect(buildGenerationPrompt(project, 'camera-entrance', images)).toContain('deliberately selected color/material treatment');
    project.floorPlan!.areas.find(area => area.kind === 'floor')!.outline = [{ x: .1, y: .1 }, { x: .9, y: .1 }, { x: .9, y: .6 }, { x: .6, y: .9 }, { x: .1, y: .9 }];
    const irregular = buildGenerationPrompt(project, 'camera-entrance', images);
    expect(irregular).not.toContain('room footprint is a RECTANGLE');
    expect(irregular).toContain('actual registered room outline');
  });
});
