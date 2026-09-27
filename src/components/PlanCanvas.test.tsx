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
