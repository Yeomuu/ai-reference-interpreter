import type { Project } from '../domain/types';
import { createConditionsSnapshot } from '../domain/revisions';

/** Illustrative offline demo. The plan is schematic, not a measured survey. */
export const sampleProject: Project = {
  schemaVersion: 1,
  id: 'aura-popup',
  name: 'AURA POP-UP',
  spaceType: '코스메틱 팝업',
  concept: '기존 공간을 보존하면서 따뜻한 조명과 곡선형 제품 진열을 적용합니다.',
  sourceImages: [
    { id: 'photo-existing', role: 'existing-space', uri: '/sample/existing-space.png', name: '기존 공간 사진', width: 1536, height: 1024, note: '현장 참고 사진 · 도면의 치수 근거가 아닙니다.' },
    { id: 'photo-atmosphere', role: 'inspiration', uri: '/sample/atmosphere.png', name: '레퍼런스 B · 따뜻한 분위기', width: 1536, height: 1024, note: '공간 전체의 간접 조명 분위기' },
    { id: 'photo-graphic', role: 'inspiration', uri: '/sample/graphic.png', name: '레퍼런스 C · 포토존 그래픽', width: 1536, height: 1024, note: '후면 벽의 탈착식 그래픽 참고' },
    { id: 'photo-product', role: 'product', uri: '/sample/product.png', name: '레퍼런스 A · 곡선형 진열대', width: 1536, height: 1024, note: '독립형 제품 진열대 참고' },
  ],
  floorPlan: {
    kind: 'schematic',
    width: 1000,
    height: 700,
    units: 'unknown',
    geometryConfidence: 'schematic',
    structures: [
      { id: 'wall-north', kind: 'wall', name: '후면 벽', geometry: { kind: 'segment', start: { x: 0.08, y: 0.10 }, end: { x: 0.92, y: 0.10 } }, photoAnchor: { x: 0.22, y: 0.20 }, role: 'base', immutable: true, protected: true },
      { id: 'wall-east', kind: 'wall', name: '오른쪽 벽', geometry: { kind: 'segment', start: { x: 0.92, y: 0.10 }, end: { x: 0.92, y: 0.90 } }, role: 'base', immutable: true, protected: true },
      { id: 'wall-south', kind: 'wall', name: '입구 쪽 벽', geometry: { kind: 'segment', start: { x: 0.92, y: 0.90 }, end: { x: 0.08, y: 0.90 } }, role: 'base', immutable: true, protected: true },
      { id: 'wall-west', kind: 'wall', name: '왼쪽 벽', geometry: { kind: 'segment', start: { x: 0.08, y: 0.90 }, end: { x: 0.08, y: 0.10 } }, role: 'base', immutable: true, protected: true },
      { id: 'window-north', kind: 'window', name: '후면 창', geometry: { kind: 'segment', start: { x: 0.37, y: 0.10 }, end: { x: 0.60, y: 0.10 } }, parentWallId: 'wall-north', wallSpan: { start: 0.34, end: 0.62 }, photoAnchor: { x: 0.53, y: 0.32 }, role: 'base', immutable: true, protected: true },
      { id: 'pillar-west', kind: 'pillar', name: '기존 기둥', geometry: { kind: 'rect', bounds: { x: 0.20, y: 0.40, width: 0.09, height: 0.11 } }, photoAnchor: { x: 0.34, y: 0.70 }, role: 'base', immutable: true, protected: true },
      { id: 'door-south', kind: 'door', name: '출입문', geometry: { kind: 'segment', start: { x: 0.43, y: 0.90 }, end: { x: 0.57, y: 0.90 } }, parentWallId: 'wall-south', wallSpan: { start: 0.42, end: 0.58 }, clearance: { x: 0.41, y: 0.72, width: 0.18, height: 0.18 }, photoAnchor: { x: 0.76, y: 0.78 }, role: 'base', immutable: true, protected: true },
      { id: 'entrance-south', kind: 'entrance', name: '출입구', geometry: { kind: 'segment', start: { x: 0.43, y: 0.90 }, end: { x: 0.57, y: 0.90 } }, parentWallId: 'wall-south', wallSpan: { start: 0.42, end: 0.58 }, photoAnchor: { x: 0.62, y: 0.89 }, role: 'base', immutable: true, protected: true },
    ],
    areas: [
      { id: 'floor-main', name: '전체 바닥', kind: 'floor', bounds: { x: 0.08, y: 0.10, width: 0.84, height: 0.80 } },
      { id: 'ceiling-main', name: '전체 천장', kind: 'ceiling', bounds: { x: 0.08, y: 0.10, width: 0.84, height: 0.80 } },
      { id: 'zone-center', name: '중앙 진열 영역', kind: 'spatial', bounds: { x: 0.34, y: 0.35, width: 0.34, height: 0.28 } },
      { id: 'zone-rear', name: '후면 포토존', kind: 'spatial', bounds: { x: 0.64, y: 0.13, width: 0.24, height: 0.22 } },
      { id: 'passage-entrance', name: '입구 동선', kind: 'passage', bounds: { x: 0.43, y: 0.73, width: 0.14, height: 0.17 } },
    ],
  },
  keeps: [
    { id: 'keep-wall', structureId: 'wall-north', intent: 'preserve', description: '후면 벽의 위치와 형태를 보존', allowedSurfaceTreatment: true },
    { id: 'keep-wall-east', structureId: 'wall-east', intent: 'preserve', description: '오른쪽 기본 벽의 위치와 형태를 보존' },
    { id: 'keep-wall-south', structureId: 'wall-south', intent: 'preserve', description: '입구 쪽 기본 벽의 위치와 형태를 보존' },
    { id: 'keep-wall-west', structureId: 'wall-west', intent: 'preserve', description: '왼쪽 기본 벽의 위치와 형태를 보존' },
    { id: 'keep-window', structureId: 'window-north', intent: 'preserve', description: '창의 위치와 개구부를 보존' },
    { id: 'keep-pillar', structureId: 'pillar-west', intent: 'preserve', description: '기둥을 가리거나 제거하지 않음' },
    { id: 'keep-entrance', structureId: 'entrance-south', intent: 'preserve', description: '출입구 위치와 동선을 유지' },
    { id: 'keep-door', structureId: 'door-south', intent: 'preserve', description: '출입문 여닫이 공간 유지' },
  ],
  references: [
    { id: 'ref-product', imageId: 'photo-product', role: 'product', note: '중앙에 곡선형 독립 진열대', extractedElements: ['element-display'], exclusions: [] },
    { id: 'ref-atmosphere', imageId: 'photo-atmosphere', role: 'ambience', note: '공간 전체에 따뜻한 간접 조명', extractedElements: ['element-warm-light', 'element-cool-light'], exclusions: ['차가운 청색 조명'] },
    { id: 'ref-graphic', imageId: 'photo-graphic', role: 'element', note: '후면 벽에 탈착식 포토존 그래픽', extractedElements: ['element-graphic'], exclusions: [] },
  ],
  elements: [
    { id: 'element-display', sourceReferenceId: 'ref-product', label: '곡선형 독립 진열대', kind: 'freestanding-fixture', status: 'apply', target: { kind: 'floor-point', x: 0.53, y: 0.51, rotationDegrees: 0, footprint: { width: 0.17, height: 0.12 } }, appearance: '밝은 아이보리 톤의 곡선형 제품 진열', conditions: '이동 가능한 독립형 구조' },
    { id: 'element-warm-light', sourceReferenceId: 'ref-atmosphere', label: '추가 분위기 · 따뜻한 간접 조명', kind: 'ambient-light', status: 'apply', target: { kind: 'whole-space' }, appearance: '부드러운 온백색 간접 조명과 자연스러운 반사광', conditions: '기존 벽·창 위치와 중립색 마감 유지. 조명의 온기만 적용하고 벽·바닥을 노란색으로 바꾸지 않음' },
    { id: 'element-graphic', sourceReferenceId: 'ref-graphic', label: '탈착식 포토존 그래픽', kind: 'wall-graphic', status: 'apply', target: { kind: 'wall-segment', wallId: 'wall-north', start: 0.68, end: 0.90 }, appearance: '브랜드 문구 중심 그래픽', conditions: '벽 손상 없이 탈착 가능' },
    { id: 'element-cool-light', sourceReferenceId: 'ref-atmosphere', label: '차가운 청색 조명', kind: 'ambient-light', status: 'exclude', target: null, conditions: '선택한 분위기에서 제외' },
  ],
  cameras: [
    { id: 'camera-entrance', name: '입구에서 중앙', x: 0.50, y: 0.79, directionDegrees: 270, fovPreset: 'standard', primary: true },
  ],
  results: [
    {
      id: 'result-sample-entrance',
      cameraId: 'camera-entrance',
      commonRevision: 1,
      createdAt: '2026-09-24T00:00:00.000Z',
      imageUri: '/sample/result.png',
      origin: 'sample',
      approved: false,
      stale: false,
      conditionsSnapshot: {
        keepIds: ['keep-wall', 'keep-wall-east', 'keep-wall-south', 'keep-wall-west', 'keep-window', 'keep-pillar', 'keep-entrance', 'keep-door'],
        appliedElementIds: ['element-display', 'element-warm-light', 'element-graphic'],
        excludedElementIds: ['element-cool-light'],
        camera: { id: 'camera-entrance', x: 0.50, y: 0.79, directionDegrees: 270 },
      },
    },
  ],
  commonRevision: 1,
};

// Capture actual starting values so the preloaded result remains inspectable
// after a user revises a single condition in the live project.
sampleProject.results[0].conditionsSnapshot = createConditionsSnapshot(sampleProject, 'camera-entrance')!;

/** Return a fresh object so a demo reset cannot mutate the template. */
export function createSampleProject(): Project {
  return structuredClone(sampleProject);
}
