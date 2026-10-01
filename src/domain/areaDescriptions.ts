import type { Area } from './types';

export const AREA_DESCRIPTIONS: Record<Area['kind'], string> = {
  spatial: '같은 조명·색·소재로 연출할 범위입니다. 레퍼런스 적용에서 이 영역에 분위기를 연결할 수 있습니다.',
  passage: '사람이 이동할 수 있도록 비워 두는 길입니다. 전시대·가벽·기둥으로 막히지 않게 배치하세요.',
  floor: '요소와 관람 시점을 놓을 수 있는 실내 바닥 범위입니다. 실제 측정된 치수는 아닙니다.',
  ceiling: '천장 조명이나 매달린 요소를 연결할 범위입니다. 바닥의 가구와는 별도로 적용됩니다.',
};
