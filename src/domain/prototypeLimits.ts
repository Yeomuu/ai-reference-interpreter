import type { DesignElement, Project } from './types.js';
import { LAYOUT_LIMIT_MESSAGE, MAX_LAYOUT_ITEMS, MAX_REFERENCE_IMAGES, REFERENCE_LIMIT_MESSAGE } from './prototypeConfig.js';

/** Count user-created objects even when temporarily excluded; never count
 * structures, areas or generated surface-condition projections as objects. */
export function isCountedLayoutItem(item: DesignElement): boolean {
  return item.origin !== 'mapping-condition' && item.layoutKind !== 'area' &&
    !['ambient-light', 'global-palette', 'floor-material', 'wall-material', 'other-area'].includes(item.kind);
}
export function countLayoutItems(project: Project): number {
  return project.elements.filter(isCountedLayoutItem).length;
}
export function countReferenceImages(project: Project): number {
  return new Set(project.references.map(reference => reference.imageId)).size;
}
/** Only new additions are constrained. Legacy over-limit data, edits, deletions
 * and bindings remain usable; undo restores the exact prior state. */
export function validatePrototypeAddition(before: Project, after: Project): { event: 'layout_limit_reached' | 'reference_limit_reached'; message: string; count: number; limit: number } | undefined {
  if (after.elements.some(item => isCountedLayoutItem(item) && !before.elements.some(old => old.id === item.id)) && countLayoutItems(after) > MAX_LAYOUT_ITEMS) {
    return { event: 'layout_limit_reached', message: LAYOUT_LIMIT_MESSAGE, count: countLayoutItems(before), limit: MAX_LAYOUT_ITEMS };
  }
  const previousSources = new Set(before.references.map(reference => reference.imageId));
  if (after.references.some(reference => !previousSources.has(reference.imageId)) && countReferenceImages(after) > MAX_REFERENCE_IMAGES) {
    return { event: 'reference_limit_reached', message: REFERENCE_LIMIT_MESSAGE, count: countReferenceImages(before), limit: MAX_REFERENCE_IMAGES };
  }
}
