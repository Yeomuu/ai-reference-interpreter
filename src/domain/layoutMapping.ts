import type { DesignElement, LayoutKind, PlacementTarget, Project, Rect, ReferenceBinding } from './types.js';
import { updateCommon } from './revisions.js';
import { validatePlacement } from './validation.js';

export const LAYOUT_LABELS: Record<LayoutKind, string> = { display: '전시대', table: '테이블', chair: '의자', light: '조명', 'wall-art': '벽면 연출', product: '진열 상품', area: '공간 연출' };
export function layoutKindFor(element: DesignElement): LayoutKind {
  if (element.layoutKind) return element.layoutKind;
  if (element.kind === 'display-product') return 'product';
  if (element.kind === 'furniture') return 'table';
  if (element.kind.includes('light')) return 'light';
  if (element.target?.kind === 'wall-segment') return 'wall-art';
  if (element.target && ['named-area', 'whole-space', 'floor-area'].includes(element.target.kind)) return 'area';
  return 'display';
}

/** Additive, idempotent compatibility layer. Never rewrite historical snapshots. */
export function migrateLayout(project: Project): Project {
  if (project.layoutVersion === 2) return project;
  const bindings: ReferenceBinding[] = project.elements.filter(item => item.status === 'apply' && item.sourceReferenceId && item.origin !== 'basic-support').map(item => ({
    id: `binding-${item.id}`, referenceId: item.sourceReferenceId,
    ...(item.sourceRegion ? { sourceRegion: item.sourceRegion } : {}), layoutItemIds: [item.id],
  }));
  return { ...project, layoutVersion: 2, referenceBindings: bindings,
    elements: project.elements.map(item => ({ ...item, layoutKind: layoutKindFor(item) })) };
}

export function createLayoutItem(project: Project, id: string, kind: LayoutKind): DesignElement {
  const base = LAYOUT_LABELS[kind];
  let number = 1;
  while (project.elements.some(item => item.label === `${base} ${number}`)) number++;
  const elementKind = kind === 'display' ? 'freestanding-fixture' : kind === 'table' || kind === 'chair' ? 'furniture' : kind === 'light' ? 'standing-light' : kind === 'wall-art' ? 'wall-graphic' : kind === 'product' ? 'display-product' : 'global-palette';
  return { id, origin: 'layout', layoutKind: kind, locked: false, sourceReferenceId: '', label: `${base} ${number}`, kind: elementKind, status: 'apply', target: null };
}

/** No silent partial mapping: incompatible targets leave the complete batch unchanged. */
export function bindReference(project: Project, referenceId: string, ids: string[], sourceRegion?: Rect, scope: ReferenceBinding['scope'] = 'appearance'): { project: Project; error?: string } {
  if (!project.references.some(item => item.id === referenceId)) return { project, error: '먼저 참고 이미지를 선택하세요.' };
  if (sourceRegion && (![sourceRegion.x, sourceRegion.y, sourceRegion.width, sourceRegion.height].every(Number.isFinite) || sourceRegion.x < 0 || sourceRegion.y < 0 || sourceRegion.width <= 0 || sourceRegion.height <= 0 || sourceRegion.x + sourceRegion.width > 1.000001 || sourceRegion.y + sourceRegion.height > 1.000001)) return { project, error: '이미지 안에서 사용할 영역을 다시 선택하세요.' };
  if (!ids.length) return { project, error: '도면에서 적용할 요소를 선택하세요.' };
  const uniqueIds = [...new Set(ids)];
  const elements = project.elements.map(item => uniqueIds.includes(item.id) ? { ...item, sourceReferenceId: referenceId, sourceRegion, status: 'apply' as const } : item);
  if (uniqueIds.some(id => !elements.some(item => item.id === id))) return { project, error: '삭제된 요소가 포함되어 있습니다. 대상을 다시 선택하세요.' };
  for (const id of uniqueIds) {
    const item = elements.find(item => item.id === id)!;
    if (scope === 'lighting' && !item.kind.includes('light') && !['area'].includes(layoutKindFor(item))) return { project, error: `${item.label}에는 조명 분위기를 연결할 수 없습니다. 조명 또는 공간 영역을 선택하세요.` };
    const issue = item.target?.kind==='whole-space' && !project.floorPlan ? undefined : validatePlacement({ ...project, elements }, id, item.target).issues.find(issue => issue.severity === 'error');
    if (issue) return { project, error: `${item.label}: ${issue.message} 레이아웃에서 위치를 먼저 확인하세요.` };
  }
  const old = (project.referenceBindings ?? []).map(binding => ({ ...binding, layoutItemIds: binding.layoutItemIds.filter(id => !uniqueIds.includes(id)) })).filter(binding => binding.layoutItemIds.length);
  const binding: ReferenceBinding = { id: `binding-${uniqueIds.join('-')}`, referenceId, sourceRegion, layoutItemIds: uniqueIds, scope };
  return { project: updateCommon(project, { elements, referenceBindings: [...old, binding] }) };
}

export function unbindReference(project: Project, bindingId: string): Project {
  const binding = project.referenceBindings?.find(item => item.id === bindingId);
  if (!binding) return project;
  return updateCommon(project, {
    referenceBindings: project.referenceBindings!.filter(item => item.id !== bindingId),
    elements: project.elements.map(item => binding.layoutItemIds.includes(item.id) ? { ...item, origin: item.origin === 'mapping-condition' ? 'mapping-condition' : 'layout', sourceReferenceId: '', sourceRegion: undefined } : item),
  });
}

/** A wall/area binding adds an appearance condition, never a duplicate physical structure. */
export function targetCondition(project: Project, id: string, target: PlacementTarget, scope: ReferenceBinding['scope']): DesignElement {
  const wall = target.kind === 'wall-segment' ? project.floorPlan?.structures.find(item => item.id === target.wallId) : undefined;
  const area = target.kind === 'named-area' || target.kind === 'ceiling-zone' || target.kind === 'floor-area' ? project.floorPlan?.areas.find(item => item.id === ('zoneId' in target ? target.zoneId : target.areaId)) : undefined;
  return { id, origin: 'mapping-condition', layoutKind: target.kind === 'wall-segment' ? 'wall-art' : 'area', sourceReferenceId: '', label: wall?.name ?? area?.name ?? '전체 공간 분위기', status: 'apply', target,
    kind: scope === 'lighting' ? target.kind === 'wall-segment' ? 'wall-light' : 'ambient-light' : scope === 'material' ? target.kind === 'wall-segment' ? 'wall-material' : target.kind === 'floor-area' ? 'floor-material' : 'global-palette' : target.kind === 'wall-segment' ? 'wall-graphic' : 'global-palette' };
}
