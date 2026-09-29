import { describe, expect, it } from 'vitest';
import { createSampleProject } from '../src/data/sample';
import { buildPlanGuideSvg, elementPlanPosition, matchesPlanGuide, planGuideManifest, type PlanGuidePalette } from '../src/services/planGuide';
import { buildGenerationPrompt, type GenerationImage } from '../src/services/generationContract';

const palette: PlanGuidePalette = { paper: 'white', ink: 'black', structure: 'gray', info: 'blue', selected: 'purple', subtle: 'white', border: 'gray' };

describe('saved plan guide and scoped visual transfer', () => {
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

  it('separates warm lighting from paint/material transfer and points to the actual layout input', () => {
    const project = createSampleProject();
    const images: GenerationImage[] = [{ role: 'existing-space', sourceId: 'photo-existing', dataUrl: '' },
      { role: 'floor-plan', sourceId: 'floor-plan', dataUrl: '', planGuide: planGuideManifest(project, 'camera-entrance') },
      { role: 'inspiration', sourceId: 'photo-atmosphere', dataUrl: '' }];
    const prompt = buildGenerationPrompt(project, 'camera-entrance', images);
    expect(prompt).toContain('authoritative 2D layout');
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
    project.elements[1].kind = 'global-palette';
    expect(buildGenerationPrompt(project, 'camera-entrance', images)).not.toContain('Transfer illumination only');
    expect(buildGenerationPrompt(project, 'camera-entrance', images)).toContain('deliberately selected color/material treatment');
  });
});
