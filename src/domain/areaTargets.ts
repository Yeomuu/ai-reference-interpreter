import type { Area, ElementKind, FloorPlan, PlacementTarget } from './types.js';
import { allowedTargetKinds } from './validation.js';

export const AREA_LABELS: Record<Area['kind'], string> = {
  floor: '사용 바닥', ceiling: '천장 영역', spatial: '공간 영역', passage: '통행 동선',
};

export function targetForArea(kind: ElementKind, area: Area): PlacementTarget | null {
  const allowed = allowedTargetKinds(kind);
  if (area.kind === 'ceiling' && allowed.includes('ceiling-zone')) return { kind: 'ceiling-zone', zoneId: area.id };
  if (area.kind === 'floor' && allowed.includes('floor-area')) return { kind: 'floor-area', areaId: area.id };
  if ((area.kind === 'spatial' || area.kind === 'floor') && allowed.includes('named-area')) return { kind: 'named-area', areaId: area.id };
  return null;
}

export function scopeTargetKey(target: PlacementTarget | null): string {
  if (target?.kind === 'whole-space') return 'whole-space';
  if (target?.kind === 'named-area' || target?.kind === 'floor-area') return `${target.kind}:${target.areaId}`;
  if (target?.kind === 'ceiling-zone') return `${target.kind}:${target.zoneId}`;
  return '';
}

export function areaTargetOptions(plan: FloorPlan | null, kind: ElementKind) {
  const options: { key: string; label: string; target: PlacementTarget }[] = [];
  if (allowedTargetKinds(kind).includes('whole-space')) options.push({ key: 'whole-space', label: '전체 공간', target: { kind: 'whole-space' } });
  for (const area of plan?.areas ?? []) {
    const target = targetForArea(kind, area);
    if (target) options.push({ key: scopeTargetKey(target), label: `${area.name} · ${AREA_LABELS[area.kind]}`, target });
  }
  return options;
}

export function targetAreaId(target: PlacementTarget | null): string | undefined {
  if (target?.kind === 'named-area' || target?.kind === 'floor-area') return target.areaId;
  if (target?.kind === 'ceiling-zone') return target.zoneId;
}
