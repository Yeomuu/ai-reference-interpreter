# 화면 주석 반영 및 QA · 2026-10-01

## 반영 내용

| 요청 | 구현 |
|---|---|
| 1–2 영역 설명/그리기 설정 | 왼쪽은 도구, 오른쪽은 그리기 또는 선택 속성. 분위기·동선 목적 설명. 기존 크기·회전·가벽 면 선택 보존. |
| 3 범례 | 너비 100% 접힌 트리거, 전체 기호 격자. X/Escape/바깥 클릭. 가로 스크롤과 도면 높이 변화 없음. |
| 4 이미지 용도 | 기본 참고 이미지 업로드. 상품 자체 사진만 선택적 설명/체크를 펼쳐 지정. 기존 product 역할 보존. |
| 5 이미지 목록 | 3열·최대3행. 초과 기존 자료 전체 보기는 옆 대화상자, 모든 이미지 선택 가능. |
| 6–7 적용 조작 | 독립 드래그 버튼 제거. 이미지/crop 직접 드롭 유지. 가져올 내용·적용 버튼은 고정 footer. |
| 8 연결 변경 | 매핑 현황 안에서 형태·디자인/조명 분위기/색·소재만 변경. 출처·crop·대상 목록 보존, 오류는 원자적 거부. |
| 9 배치 위치 | 매핑 화면에서 끌기/방향키로 조정. 보존·충돌·동선·typed anchor·호스트·undo 검사 유지. |
| 10–12 시점/요약 | 시점마다 카메라 아이콘과 목적 설명. 도면에서 확인하고 생성할 시점은 오른쪽에서 선택. 숫자 배치 목록 제거. |
| 13 결과 탭 | 저장된 결과가 없을 때 비활성, 결과 저장 후 활성. 기존 직접 URL/결과 이력 호환. |
| 알림 | 공통 2000ms 후 실제 제거. 모든 일시 알림에 X 즉시 닫기. undo 기록은 알림과 독립적으로 보존. 결정 폼은 X 취소. |

## 주요 파일과 이유

- `src/app/App.tsx`: 속성 위치·선택 폼·적용 scope·이동 검증·결과 탭·알림 통합.
- `src/components/LayoutWorkspace.tsx`, `MappingWorkspace.tsx`: 오른쪽 설정, 고정 적용 영역, 그리드/목록, inline 변경.
- `src/components/PlanLegend.tsx`, `TimedNotice.tsx`: 범례와 2초/X 알림 공통 동작.
- `src/components/PlanCanvas.tsx`, `ReferenceRegionPicker.tsx`: 이동과 클릭 구분, 실제 crop/image 드롭, 일시 캔버스 안내.
- `src/components/CameraSummary.tsx`, `ExperimentPanel.tsx`: 한국어 시점 설명/일관된 카메라, 실험 오류 알림.
- `src/domain/areaDescriptions.ts`, `layoutMapping.ts`, `movementFeedback.ts`: 설명, 검증된 내용 변경, 기존 host를 보존하는 좌표 변환.
- `src/services/planGuide.ts`: 천장 offset을 실제 선택/안내 도면 위치에 반영.
- `src/styles/app.css`, `layout-mapping.css`: 기존 토큰으로 범례·목록·footer·닫기 배치. 기존 CSS 3초 fade 제거.
- `tests/workspaceRefinement.test.ts`, `scripts/qa-workspace.mjs`, `eslint.config.js`: 의미 있는 데이터 회귀와 격리 브라우저 전체 흐름 검사.
- PRODUCT/DESIGN_SYSTEM/INTERACTIONS/ARCHITECTURE/ICON_MANIFEST/UX_SPEC_CHANGELOG/QA: 최신 사용자 요청을 이전 범례·알림 규칙보다 우선으로 기록.

## 검사 결과와 범위

28개 파일/229개 자동 테스트, lint, 프론트·서버 TypeScript, production build 통과. 격리 Chrome에서 학교 공간을 시작으로 실제 조작, crop/Shift/native drop, inline 변경, 물체·천장·상품 이동, 상태 복원, 결과 생성 전후, 삭제 복구를 확인했다. 추가 브라우저 검사로 20/8 제한·과거 초과 데이터·가벽 A/B·잠금·영역 편집·카메라 추천·사전 제공 샘플도 통과했다.

유료 모델은 호출하지 않았다. 학교 공간의 결과 흐름은 모의 네트워크 응답으로 검증했고 팝업 예시에서는 실제 사전 제공 샘플을 열었다. 모의 이미지를 실제 AI 결과의 품질 근거로 삼지 않는다. 검증 범위에서 새 차단 오류 없음. 기존 큰 bundle 경고와 실제 이미지 모델의 공간 일치/시점 품질 검증은 이번 UI 작업의 검사 범위 밖이다.

논문 UT 전에는 사용할 자료·과업 종료 기준·실제 생성 운용을 확인해야 한다. 기존 여성/남성 눈높이 프리셋은 공식 국내 인체치수 근거 확인 전 임시값 안내를 유지한다. 이번 작업으로 추가 고급 기능을 제안하지 않는다.

## 브라우저 검사 실행

개발 서버를 실행하고 `PLAYWRIGHT_MODULE`을 사용할 Playwright 모듈 경로, `CHROME_PATH`를 Chrome 실행 경로로 지정한 뒤 `node scripts/qa-workspace.mjs`를 실행한다. 기본 주소는 `http://127.0.0.1:5173`; `QA_BASE_URL`로 배포본 주소를 지정할 수 있다. `QA_SCREENSHOT_DIR`을 지정하면 검사 화면을 저장한다. 항상 별도 프로필을 만들고 API 생성은 모의 응답으로 처리해 유료 요청을 보내지 않는다.
