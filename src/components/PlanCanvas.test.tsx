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
    const html = renderToStaticMarkup(createElement(PlanCanvas, { project, mode: 'place', selectedElementId: 'element-warm-light' }));
    expect(html.match(/class="plan-canvas__floor"/g)).toHaveLength(2);
    expect(html.match(/class="plan-element__area"/g)).toHaveLength(2);
  });

  it('still depicts a whole-space ambience when a floor has not been marked yet', () => {
    const project = createSampleProject();
    project.floorPlan!.areas = project.floorPlan!.areas.filter((area) => area.kind !== 'floor');
    const html = renderToStaticMarkup(createElement(PlanCanvas, { project, mode: 'place', selectedElementId: 'element-warm-light' }));
    expect(html).not.toContain('class="plan-canvas__floor"');
    expect(html.match(/class="plan-element__area"/g)).toHaveLength(1);
  });
});

describe('area readability', () => {
  it.each(['view', 'keep', 'place', 'camera'] as const)('shows protected passage, clearance and occupied floor bounds in %s', mode => {
    const project = createSampleProject();
    const html = renderToStaticMarkup(createElement(PlanCanvas, { project, mode }));
    expect(html).toContain('data-constraint-id="passage-entrance"');
    expect(html).toContain('data-constraint-id="door-south"');
    expect(html).toContain('data-constraint-id="element-display"');
    expect(html).toContain('출입·여닫이 여유 공간');
    expect(html).toContain('입구 동선 · 통행 유지');
    expect(html).toContain('바닥 요소와 시점의 배치 기준');
  });
  it('shows only the selected scope condition and one selected area name in a dense plan', () => {
    const project = createSampleProject();
    for (let i = 0; i < 20; i++) project.floorPlan!.areas.push({ id: `zone-${i}`, name: `작업 영역 ${i}`, kind: 'spatial', bounds: { x: .2, y: .2, width: .2, height: .2 } });
    project.elements.push({ ...project.elements.find(item => item.kind === 'ambient-light')!, id: 'second-ambience', label: '부분 조명', target: { kind: 'named-area', areaId: 'zone-0' } });
    const html = renderToStaticMarkup(createElement(PlanCanvas, { project, mode: 'place', selectedElementId: 'second-ambience', selectedAreaId: 'zone-0' }));
    expect(html.match(/class="plan-element__area"/g)).toHaveLength(1);
    expect(html.match(/class="plan-area-label is-selected(?: is-read-only)?"/g)).toHaveLength(1);
    expect(html).not.toContain('>작업 영역 1</text>');
    expect(html).toContain('영역·동선 25개');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('통행 동선');
  });
});

describe('drawing affordances', () => {
  it('names the actual selected host wall on the plan while drawing an opening', () => {
    const project = createSampleProject();
    const wall = project.floorPlan!.structures.find((structure) => structure.kind === 'wall')!;
    const html = renderToStaticMarkup(createElement(PlanCanvas, { project, mode: 'view', drawTool: 'segment', drawWallId: wall.id, onDrawWallSelect: () => {} }));
    expect(html).toContain(`>${wall.name}</text>`);
    expect(html).toContain('plan-wall-label--selected');
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
