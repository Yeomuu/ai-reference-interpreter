import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createSampleProject } from '../data/sample';
import PlanCanvas from './PlanCanvas';

describe('plan canvas floor layers', () => {
  it('shows every registered floor area and applies a whole-space overlay to each one', () => {
    const project = createSampleProject();
    project.floorPlan!.areas.push({
      id: 'floor-secondary', name: '보조 바닥', kind: 'floor',
      bounds: { x: .10, y: .91, width: .20, height: .07 },
    });
    const html = renderToStaticMarkup(createElement(PlanCanvas, { project, mode: 'place' }));
    expect(html.match(/class="plan-canvas__floor"/g)).toHaveLength(2);
    expect(html.match(/class="plan-element__area"/g)).toHaveLength(2);
  });

  it('still depicts a whole-space ambience when a floor has not been marked yet', () => {
    const project = createSampleProject();
    project.floorPlan!.areas = project.floorPlan!.areas.filter((area) => area.kind !== 'floor');
    const html = renderToStaticMarkup(createElement(PlanCanvas, { project, mode: 'place' }));
    expect(html).not.toContain('class="plan-canvas__floor"');
    expect(html.match(/class="plan-element__area"/g)).toHaveLength(1);
  });
});

describe('drawing affordances', () => {
  it('names the actual selected host wall on the plan while drawing an opening', () => {
    const project = createSampleProject();
    const wall = project.floorPlan!.structures.find((structure) => structure.kind === 'wall')!;
    const html = renderToStaticMarkup(createElement(PlanCanvas, { project, mode: 'view', drawTool: 'segment', drawWallId: wall.id, onDrawWallSelect: () => {} }));
    expect(html).toContain(`${wall.name} · 연결 벽`);
    expect(html).toContain('plan-canvas__active-wall');
    expect(html).toContain(`${wall.name}을 연결 벽으로 선택`);
  });
  it('does not promise partition movement when the plan only has fixed structures', () => {
    const html = renderToStaticMarkup(createElement(PlanCanvas, { project: createSampleProject(), mode: 'view' }));
    expect(html).toContain('현재 이동 가능한 구조가 없습니다');
    expect(html).not.toContain('plan-structure__move-label');
  });
  it('labels movable partitions before selection, while a protected partition stays fixed', () => {
    const project = createSampleProject();
    project.floorPlan!.structures.push({ id: 'partition', kind: 'wall', name: '진열 가벽', immutable: false, protected: false, geometry: { kind: 'segment', start: { x: .4, y: .2 }, end: { x: .6, y: .2 } } });
    const props = { project, mode: 'view' as const, onStructureMove: () => {} };
    const html = renderToStaticMarkup(createElement(PlanCanvas, props));
    expect(html).toContain('진열 가벽 · 이동 가능');
    project.floorPlan!.structures.at(-1)!.protected = true;
    expect(renderToStaticMarkup(createElement(PlanCanvas, props))).not.toContain('진열 가벽 · 이동 가능');
  });
});
