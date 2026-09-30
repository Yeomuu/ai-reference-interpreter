import type { Project, Structure } from '../domain/types'
import { createSampleProject } from './sample'

export const CAMPUS_SOURCE = 'https://www.tukorea.ac.kr/design/1999/subview.do'
export const CAMPUS_PREFIX = 'tuk-projectroom-'

/** Authored scenario from officially labelled room photos; NOT a surveyed room plan. */
export function createCampusProject(purpose: 'exhibition' | 'popup'): Project {
  const sample = createSampleProject()
  const wall = (id: string, name: string, x: number, y: number, ex: number, ey: number): Structure => ({ id, name, kind: 'wall', geometry: { kind: 'segment', start: { x, y }, end: { x: ex, y: ey } }, role: 'base', protected: true, immutable: true })
  const structures: Structure[] = [
    wall('campus-front', '화이트보드 쪽 벽', .1, .1, .9, .1),
    wall('campus-right', '출입문 쪽 벽', .9, .1, .9, .9),
    { ...wall('campus-back', '뒤쪽 경계 · 위치 가정', .9, .9, .1, .9), role: 'partition', protected: false, immutable: false },
    wall('campus-left', '창 쪽 벽', .1, .9, .1, .1),
    { id: 'campus-window-front', name: '앞쪽 창', kind: 'window', geometry: { kind: 'segment', start: { x: .1, y: .42 }, end: { x: .1, y: .16 } }, parentWallId: 'campus-left', wallSpan: { start: .6, end: .925 }, role: 'base', protected: true, immutable: true },
    { id: 'campus-window-rear', name: '뒤쪽 창 · 범위 가정', kind: 'window', geometry: { kind: 'segment', start: { x: .1, y: .82 }, end: { x: .1, y: .53 } }, parentWallId: 'campus-left', wallSpan: { start: .1, end: .4625 }, role: 'base', protected: true, immutable: true },
    { id: 'campus-door', name: '출입문 · 범위 가정', kind: 'door', geometry: { kind: 'segment', start: { x: .9, y: .15 }, end: { x: .9, y: .28 } }, parentWallId: 'campus-right', wallSpan: { start: .0625, end: .225 }, clearance: { x: .74, y: .13, width: .16, height: .18 }, role: 'base', protected: true, immutable: true },
  ]
  return {
    ...sample, id: `${CAMPUS_PREFIX}${purpose}`,
    name: `한국공학대학교 · ${purpose === 'exhibition' ? '졸업전시 구상' : '브랜드 팝업 구상'}`,
    spaceType: purpose === 'exhibition' ? '학교 졸업전시' : '학교 브랜드 팝업',
    concept: `한국공학대학교 디자인공학부 프로젝트룸을 ${purpose === 'exhibition' ? '학생 졸업작품 전시' : '가상 브랜드 AURA의 제품 팝업'}로 구상합니다. 사진의 창·화이트보드·직선 벽·천장·중립색 바닥을 유지합니다. 기존 이동식 책상·의자는 임시 이동을 가정합니다. 실제 설치·대관을 확정한 계획이 아닙니다. 도면은 설명용 가정이며 실제 치수와 전체 구조는 미확인입니다.`,
    sourceImages: [
      { id: 'campus-photo-front', role: 'existing-space', name: '프로젝트룸 · 화이트보드와 출입문', uri: '/sample/campus/projectroom-front.jpg', width: 4032, height: 3024, note: `한국공학대학교 공식 학부실습실 안내 사진. 촬영일·현재 상태·실측 미확인. 출처 ${CAMPUS_SOURCE}` },
      { id: 'campus-photo-windows', role: 'existing-space', name: '프로젝트룸 · 창 쪽 모습', uri: '/sample/campus/projectroom-windows.jpg', width: 5712, height: 4284, note: `한국공학대학교 공식 학부실습실 안내 사진. 도면은 사진을 참고한 설명용 가정. 출처 ${CAMPUS_SOURCE}` },
      ...sample.sourceImages.filter(image => image.role !== 'existing-space').map(image => image.id === 'photo-atmosphere' ? { ...image, ...(purpose === 'exhibition' ? { uri: '/sample/campus/exhibition-lighting.png', width: 1448, height: 1086 } : {}), name: '참고 1 · 부드러운 보조 조명', note: purpose === 'exhibition' ? '생성된 졸업전시 조명 기획 참고 이미지. 실제 학교 사진이나 완성 시안이 아닙니다.' : '조명 방식 참고. 사진 속 매장의 구조와 벽 색은 가져오지 않습니다.' } : image.id === 'photo-graphic' ? { ...image, name: '참고 2 · 탈착식 벽 그래픽', note: '전시 안내 벽 그래픽의 소재와 형태 참고.' } : purpose === 'exhibition' ? { ...image, role: 'inspiration' as const, uri: '/sample/campus/exhibition-display.png', width: 1448, height: 1086, name: '참고 3 · 졸업작품 전시대', note: '생성된 전시 가구 기획 참고 이미지. 실제 학교 사진이나 완성 시안이 아닙니다.' } : { ...image, name: '참고 3 · 이동식 진열대', note: '작품을 놓을 전시대 형태 참고. 상품과 기존 구조는 복제하지 않습니다.' }),
    ],
    floorPlan: { kind: 'schematic', width: 1000, height: 750, units: 'unknown', geometryConfidence: 'schematic', structures, areas: [
      { id: 'floor-main', name: '사용 바닥 · 가정', kind: 'floor', bounds: { x: .1, y: .1, width: .8, height: .8 } },
      { id: 'ceiling-main', name: '천장', kind: 'ceiling', bounds: { x: .1, y: .1, width: .8, height: .8 } },
      { id: 'campus-passage', name: '출입 통로', kind: 'passage', bounds: { x: .74, y: .15, width: .16, height: .70 } },
    ] },
    keeps: structures.filter(item => item.protected).map(item => ({ id: `keep-${item.id}`, structureId: item.id, intent: 'preserve', description: `${item.name}의 등록된 위치·형태 유지. 설명용 개략 표시이며 현장 확인 필요.` })),
    references: sample.references.map(item => item.id === 'ref-atmosphere' ? { ...item, note: '조명 방식만 선택. 사진 속 공간 구조와 색을 복제하지 않음', extractedElements: ['element-warm-light'], exclusions: [] } : item.id === 'ref-product' && purpose === 'exhibition' ? { ...item, role: 'element', note: '졸업작품을 올릴 이동식 전시 가구의 형태만 참고' } : item),
    elements: sample.elements.filter(item => item.id !== 'element-cool-light').map(item => ({ ...(item.id === 'element-display' ? { ...item, label: purpose === 'exhibition' ? '학생 작품 전시대' : '브랜드 제품 체험대', target: null, appearance: purpose === 'exhibition' ? '직선형 백색 모듈 전시대. 학생 작품 모형을 놓고 충분한 통로 확보' : item.appearance, conditions: '기존 책상·의자는 임시 이동을 가정. 이동식 전시대, 출입 통로를 비워 둠' } : item.id === 'element-graphic' ? { ...item, label: purpose === 'exhibition' ? '졸업전시 안내 그래픽' : '브랜드 안내 그래픽', target: { kind: 'wall-segment' as const, wallId: 'campus-right', start: .42, end: .72 }, appearance: purpose === 'exhibition' ? '졸업전시 안내 문구와 학생 작품 정보를 담은 탈착식 벽 그래픽' : item.appearance, conditions: '탈착식 그래픽. 출입문 여닫이 범위·창·화이트보드를 가리지 않음' } : item.id === 'element-warm-light' ? { ...item, label: '작품 주변 보조 조명', appearance: '기존 백색 천장 조명과 자연광 유지. 작품 주변에만 은은한 보조광', conditions: '사진의 백색 벽과 회색 바닥을 유지. 전체 공간에 노란 필터를 씌우지 않음' } : item), status: 'exclude' as const })),
    cameras: [{ id: 'campus-camera', name: '출입문에서 실내 방향', x: .73, y: .32, directionDegrees: 147, fovPreset: 'standard', primary: true }],
    results: [], commonRevision: 1,
  }
}
