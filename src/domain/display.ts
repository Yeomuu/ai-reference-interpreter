import type { DesignElement, Point, Project, Rect } from './types';

export function isDisplaySupport(element: DesignElement): boolean {
  return element.status === 'apply' && (element.kind === 'freestanding-fixture' || element.kind === 'furniture');
}
export function displayPosition(project: Project, product: DesignElement): Point | null {
  const target = product.target;
  if (target?.kind !== 'fixture-surface' || !project.floorPlan) return null;
  const host = project.elements.find(item => item.id === target.fixtureElementId);
  if (!host || !isDisplaySupport(host) || !host.target) return null;
  let bounds: Rect, degrees = 0;
  if (host.target.kind === 'floor-point') {
    const t = host.target, size = t.footprint ?? { width: .06, height: .06 };
    bounds = { x: t.x - size.width / 2, y: t.y - size.height / 2, ...size };
    degrees = t.rotationDegrees ?? 0;
  } else if (host.target.kind === 'floor-area') {
    // Narrowing is captured separately because callbacks do not retain the target guard.
    const id = host.target.areaId;
    const saved = project.floorPlan.areas.find(item => item.id === id && item.kind === 'floor');
    if (!saved) return null;
    bounds = saved.bounds;
  } else return null;
  const dx = (target.offset.x - .5) * bounds.width * project.floorPlan.width;
  const dy = (target.offset.y - .5) * bounds.height * project.floorPlan.height;
  const angle = degrees * Math.PI / 180;
  return { x: bounds.x + bounds.width / 2 + (dx * Math.cos(angle) - dy * Math.sin(angle)) / project.floorPlan.width,
    y: bounds.y + bounds.height / 2 + (dx * Math.sin(angle) + dy * Math.cos(angle)) / project.floorPlan.height };
}

/** Removing/excluding/changing a support releases its products without deleting them or history. */
export function cleanDisplayTargets(elements: DesignElement[]): DesignElement[] {
  return elements.map(item => item.target?.kind === 'fixture-surface' && !elements.some(host => host.id === (item.target?.kind === 'fixture-surface' ? item.target.fixtureElementId : '') && isDisplaySupport(host))
    ? { ...item, target: null } : item);
}
