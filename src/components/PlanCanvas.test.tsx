import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createSampleProject } from '../data/sample';
import PlanCanvas from './PlanCanvas';
import { createLayoutItem } from '../domain/layoutMapping';

describe('partition face controls', () => {
  function projectWithPartition() {
    const project = createSampleProject();
    project.floorPlan!.structures.push({ id: 'face-wall', name: '전시 가벽', kind: 'wall', role: 'partition', protected: false, geometry: { kind: 'segment', start: { x: .4, y: .2 }, end: { x: .4, y: .7 } } });
    return project;
  }
  it('exposes accessible A/B buttons only when selection can be handled', () => {
    const project = projectWithPartition();
    const props = { project, mode: 'place' as const, attachmentWallId: 'face-wall', selectedWallFace: 'b' as const };
    const html = renderToStaticMarkup(createElement(PlanCanvas, { ...props, onWallFaceSelect: () => {} }));
    expect(html.match(/class="plan-wall-face-marker is-interactive/g)).toHaveLength(2);
    expect(html).toContain('B면 · 도면의 B 표시 쪽 선택');
    expect(html).toMatch(/aria-pressed="true" data-wall-face="b"/);
    expect(html).toContain('class="plan-wall-face-marker__hit"');
    const readonly = renderToStaticMarkup(createElement(PlanCanvas, props));
    expect(readonly).not.toContain('plan-wall-face-marker is-interactive');
    expect(readonly).not.toContain('도면의 B 표시 쪽 선택');
  });
  it('renders one pair when a saved wall attachment is selected and shares the mapping face', () => {
    const project = projectWithPartition();
    const graphic = project.elements.find(e => e.kind === 'wall-graphic')!;
    graphic.target = { kind: 'wall-segment', wallId: 'face-wall', start: .1, end: .25, face: 'a' };
    const saved = renderToStaticMarkup(createElement(PlanCanvas, { project, mode: 'place', selectedElementId: graphic.id, attachmentWallId: 'face-wall', selectedWallFace: 'b', onWallFaceSelect: () => {} }));
    expect(saved.match(/data-wall-face=/g)).toHaveLength(2);
    expect(saved).toMatch(/aria-pressed="true" data-wall-face="b"/);
    const mapping = renderToStaticMarkup(createElement(PlanCanvas, { project, mode: 'mapping', mappingSelectedIds: ['wall:face-wall'], selectedWallFace: 'a', onWallFaceSelect: () => {} }));
    expect(mapping).toMatch(/aria-pressed="true" data-wall-face="a"/);
  });
});

describe('active placement tools', () => {
  it('offers support picking for a new product even before any product is selected', () => {
    const project = createSampleProject();
    const support = createLayoutItem(project, 'support', 'display');
    support.locked = true;
    support.target = { kind: 'floor-point', x: .3, y: .3, footprint: { width: .1, height: .1 } };
    project.elements = [support];
    const html = renderToStaticMarkup(createElement(PlanCanvas, { project, mode: 'place', supportPlacementMode: true, onSupportSelect: () => {} }));
    expect(html).toContain('plan-element--support-picking');
    expect(html).toContain('이 진열대 위에 제품 연결');
    // An absent callback must never expose a support-picking button that does nothing.
    const unavailable = renderToStaticMarkup(createElement(PlanCanvas, { project, mode: 'place', supportPlacementMode: true }));
    expect(unavailable).not.toContain('plan-element--support-picking');
  });
  it('does not offer floor dragging while a point-placement tool is active', () => {
    const project = createSampleProject();
    const html = renderToStaticMarkup(createElement(PlanCanvas, { project, mode: 'place', pointPlacementMode: true, onElementMove: () => {} }));
    expect(html).not.toContain('plan-element--editable');
    expect(html).toContain('여기에 요소 배치');
  });
});

describe('plan canvas floor layers', () => {
  it.each(['place', 'mapping', 'camera'] as const)('shows unselected legacy ceiling objects in %s while hiding the ceiling area hit target', mode => {
    const project = createSampleProject();
    project.elements.push({ id: 'ceiling-exhibit', label: '매달린 작품', kind: 'other-ceiling', sourceReferenceId: '', status: 'apply', target: { kind: 'ceiling-zone', zoneId: 'ceiling-main', offset: { x: .2, y: .3 } } });
    const html = renderToStaticMarkup(createElement(PlanCanvas, { project, mode }));
    expect(html).toContain('data-element-id="ceiling-exhibit"');
    expect(html).toContain('매달린 작품, 천장 요소');
    expect(html).toContain('위치 지정 배치 요소 3개, 공간·표면 연출 조건 1개');
    if (mode === 'mapping') {
      expect(html).toContain('data-mapping-target="ceiling-exhibit"');
      expect(html).not.toContain('data-mapping-target="area:ceiling-main"');
    }
  });

  it('shows the explicitly selected ceiling area for mapping instead of an invisible target', () => {
    const html = renderToStaticMarkup(createElement(PlanCanvas, { project: createSampleProject(), mode: 'mapping', mappingSelectedIds: ['area:ceiling-main'] }));
    expect(html).toContain('data-mapping-target="area:ceiling-main"');
    expect(html).toContain('class="plan-canvas__area plan-canvas__area--ceiling');
  });

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
    expect(html).toContain('data-constraint-id="passage-entrance"');
    expect(html).not.toContain('>입구 동선</text>');
  });
});

describe('drawing affordances', () => {
  it('keeps visible passage labels from capturing drawing gestures', () => {
    const project = createSampleProject();
    const html = renderToStaticMarkup(createElement(PlanCanvas, { project, mode: 'view', drawTool: 'rect', selectedAreaId: 'passage-entrance' }));
    expect(html).toContain('class="plan-area-label is-selected is-read-only"');
    expect(html).not.toContain('aria-label="입구 동선 · 통행 동선 · 도면에서 선택"');
  });
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
