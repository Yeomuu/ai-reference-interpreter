# 교수 피드백 반영 · 2026-10-09

## 변경 범위

기준 커밋6665c56. 수정 전 복구 branch: codex/backup-before-professor-feedback-20261009.

- App.tsx의 WallTargetEditor: 벽면 폭과 시작/끝 위치를 분리해 설명한다. 폭 입력은 끝점을 바꾸고 위치·폭 적용 버튼에서 기존 검증으로 저장한다.
- PlanCanvas.tsx / plan-canvas.css: 보존 벽 선과 연출 구간을 분리하고 선택된 부착물 양 끝 손잡이를 제공한다. 드래그 preview는 도면 폭과 %를 즉시 바꾸며 완료 후 저장한다. 잠긴 요소·읽기 전용 화면에는 손잡이가 없다.
- domain/placementGrid.ts: 긴 변32등분의 정사각 격자. 바닥/천장 요소의 클릭·드래그·방향키 배치를 맞춘다. 토글 끄기·Alt로 자유 이동한다. 받침 위 상품·구조·카메라·벽 구간 편집은 제외한다. 기존 저장 위치를 진입만으로 바꾸지 않는다.
- data/referenceCatalog.ts / domain/referenceCatalog.ts / components/ReferenceCatalog.tsx: 분류형 기본 자료6장, 선택 등록·중복 선택·기존8장 한도. 자동 배치/자동 연결은 없다. 사용자가 가져올 내용과 적용 대상을 고르는 기존 흐름을 사용한다.
- layout-mapping.css / tokens.css: 기존 타이포·semantic 색·상태·radius를 재사용하고 catalog의 반응형 치수만 중앙화한다.
- public/sample/library: CC0 사진2장과 기존 생성 자료의 압축 preview4장. source/허가/hash는 REFERENCE_LIBRARY_ASSETS_20261009.json 및 배포 LICENSE.md에 기록한다.
- 관련 제품/설계/상호작용/구조 문서와 .omd/preferences.md의 최신 계약을 갱신한다.

## 실제 실행 결과

| 확인 | 결과 |
| --- | --- |
| npm run lint | 통과 |
| 앱 TypeScript / API TypeScript | 통과 |
| npm test | 33파일 / 280개 통과 |
| npm run build | 통과 |
| 숫자 폭 변경 | 15% 기본 구간 → 40% 적용, 저장 target.span과 SVG 길이 함께 증가 |
| 도면 끝점 drag | 실시간 폭49% 표시, 완료 후 end 저장 |
| Ctrl+Z / Ctrl+Shift+Z / reload | 벽 구간 변경 복구·재적용·재접속 유지 |
| 보존 벽과 문 충돌 | 보존 벽 자체는 유지; 출입문과 겹치는 부착물 구간은 원래 값 유지하며 이유 표시 |
| 격자 클릭 / 방향키 / Alt drag | 정사각 cell 좌표 저장·격자 이동·Alt 비격자 이동 확인 |
| 격자 끄기 | 버튼 상태 변경 및 배경 격자 제거 |
| 기본 레퍼런스 | 6개·분류 필터·의자 등록·중복 슬롯 방지·명시적 chair 연결 확인 |
| 기본 자료 삭제 / undo / reload | 배치 의자 유지·참고 연결 해제·자료와 연결 복구·재접속 유지 |
| 1440×900 / 938×672 | 직접 캡처 확인, dialog 경계가 viewport 내부, 내부 스크롤·Escape 닫기 |
| JavaScript pageerror | 없음 |
| 유료 이미지 요청 | 0회; /api/generate POST는 QA에서 차단 |

검증은 사용자 브라우저 저장소와 분리된 새 Edge context 및 새 학교 프로젝트에서 수행했다. 로컬 서버는127.0.0.1:5174. 실행 스크립트/report와 캡처는 ignored qa-screens/professor-feedback-20261009/에 있다. 초기 QA selector의 SVG zero-height bbox와 select label/오류 notice 범위는 실제 화면 좌표·정확한 대상 선택으로 보정한 뒤 전체 시나리오를 통과했다.

## 사용 의미와 남은 범위

벽면의 %는 해당 벽 길이에 대한 평면상의 비율이며 높이나 실제 cm가 아니다. 시작점의 방향은 벽 데이터의 시작/끝 방향을 따른다. 드래그 도중 inspector의 숫자는 마지막 저장 값이고 preview 폭은 도면에 표시된다. 손을 놓아 저장하면 inspector도 갱신한다.

이번 작업은 실제 이미지 생성을 하지 않았다. 새 참고 사진의 모델 전이 품질·정밀 공간 일치·무노이즈 출력은 검증하지 않았고 보장하지 않는다. 준비 자료는6장으로 제한되어 있으며 더 다양한 실험 자료는 같은 catalog 데이터 구조에 추가할 수 있다. 사용자 업로드는 그대로 사용 가능하다.

Figma 파일·폰트·이미지 API 모델·quota/예약/일일 리셋 로직은 수정하지 않았다.
