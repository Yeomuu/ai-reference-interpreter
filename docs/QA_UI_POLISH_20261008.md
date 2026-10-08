# 사용자 주석 UI 정돈·QA · 2026-10-08

기존 React 19/TypeScript/Vite·SVG 도면·Vercel API 프로젝트에서 작업했다. 전체 재작성이나 디자인 교체를 하지 않았다. 현재 코드 수정은 완료했고 Figma 최종 섹션에는 아래 미완료 항목이 남는다.

## Phase 1 — 직접 분석과 비교

AGENTS/PRODUCT/DESIGN_SYSTEM/INTERACTIONS/ARCHITECTURE/QA/FONT_PROVENANCE/ICON_MANIFEST, 사용자 DESIGN.md와 현재 Git 변경을 확인했다. 기존 main `9af990e434553b7d1cfdec18bf3d1156f15b4b89`를 원격 `codex/backup-before-ui-polish-20261008`에 먼저 보관했다. 개발 서버 5174와 production preview 5175, 별도 Edge Playwright 프로필을 사용했다. 참가자의 열린 브라우저 저장 자료는 수정하지 않았다.

Figma 원본·최종 섹션을 도구로 읽고 실제 1920×1080 캡처를 대조했다. 원본 수치의 기존 기록은 QA_FIGMA_ALIGNMENT_20261008.md에 있다. 사용자가 승인한 v1.4.5 글자 축소는 원본 22px 진행을 18px로 표시하는 명시적 예외이며 이번에 새 크기 체계를 만들지 않았다. 코드 기준 7개 상태(홈/사진/도면/배치/레퍼런스/검토/빈 결과)를 캡처하고 폰트와 사진 로딩 완료 후 직접 확인했다.

| 요소 | 원본/사용자 기준 | 수정 전 코드·문제 | 반영 |
|---|---|---|---|
| 진행 | pill 36px, 현재 폭 248px, 현재 18px 글자, 균등 inset | 아이콘·문구의 비대칭 인상 | 16px 좌우 padding·그룹 중심·240ms 전환 |
| 사진 | 기존 932×694 형태/14.4px mask 유지 | 상단 offset 126px | 96px로 30px 상향 |
| 도구 목록 | 기존 기능 유지, 종류를 쉽게 찾기 | 구조/영역/배치 전부 길게 나열 | 배치/구조/영역 탭 |
| canvas toolbar | 기능을 줄인 실험 화면 | undo/redo 텍스트·zoom/reset 다수 | 아이콘 undo/redo·표시/영역 접기·32px 높이 |
| 검토 footer | 오른쪽 사이드 패널 아래 주 행동 | 이전 버튼만 아래, 생성 행동은 스크롤 안 | 생성 버튼을 footer로 이동 |
| 가이드 | 보조 제어 14px | 일반 버튼 크기로 강조 | 14px/32px compact |
| 기록 패널 | 위/좌/우 stroke | 상단만 stroke | 3면 stroke, bottom 없음 |

## Phase 2 — 주석 17개 반영

| 주석 | 결과 |
|---|---|
| 1,15 진행 중심·padding·전환 | 공통 진행 CSS 수정, 36px 아이콘 pill/48px hit area, reduced-motion 대응 |
| 2 도구 가독성 | 카테고리 탭, 기존 각 도구·선택·목록 기능 보존 |
| 3,7 캔버스 외곽 | STEP 02/03 wrapper 투명·무테·무그림자, ‘실측 전 개략도’ |
| 4,6 toolbar | undo/redo 아이콘+aria-label, zoom/reset 표시 제거, 같은 높이 |
| 5,8 이동 간격 | 공통 footer space-between + gap24, 1단계와 같은 패널 내부 |
| 9 범례 구분 | 통행 세로 점선 / 문 여유 대각선, 범례 동일 표시 |
| 10 생성 버튼 | STEP 04 footer의 AI 이미지 생성, 기존 사전 검사·busy·quota gates 유지 |
| 11 미리 만든 결과 없음 | 학교 프로젝트 notice/빈 블록 제거, 일반 명시적 sample 모드 유지 |
| 12 제외/고정 의미 | Keep는 기존 구조 보존으로 구분·기본 접힘, 빈 제외는 숨김, 실제 제외는 별도 접기 |
| 13 검토 경고 | 중립 ‘확인할 항목’, 구체적 설정 링크·오류 이유·이동 동작 유지 |
| 14 생성/결과 탭 | STEP 01 스타일 재사용, 결과 생성 전 disabled 유지 |
| 16 가이드 크기 | 위 14px compact 적용 |
| 17 실험 기록 | 위/좌/우 border·하단 제외 |

Keep 자체를 제외 조건으로 바꾸지 않았다. 고정 벽에는 호환되는 탈착 그래픽/벽등을 설치할 수 있고 underlying 벽의 삭제·이동·교체는 계속 차단한다. 출입구·창·기둥·통로 충돌과 부착 대상 유형을 검사한다. 세부 현재 로직은 CURRENT_LOGIC_20261008.md.

## Phase 3 — DESIGN.md/HIG를 통한 정돈과 최적화

원본 Corner/Center marker를 WorkspaceRegistration으로 재사용했고 STEP 02는 두 열 분할, 나머지는 각 작업 경계를 따른다. 기존 R8·약한 shadow·색·글꼴 역할을 유지한다. 데이터가 없는 화면의 장식·중복 문구를 덜고 실제 선택·결과·오류와 주 행동을 강조했다.

Apple HIG는 사용성 참고로만 적용했다. 색 외의 패턴 구분, 접근 가능한 이름·키보드 이동·복구, 사용자 지정 움직임과 reduced-motion을 사용했다. SF Pro/Liquid Glass/Apple 색/컴포넌트 형태는 적용하지 않았다. 공식 문서의 JSON 콘텐츠로 [접근성](https://developer.apple.com/design/human-interface-guidelines/accessibility)과 [Motion](https://developer.apple.com/design/human-interface-guidelines/motion)을 확인했다. 네이티브 시스템 pt 권장값을 웹 px 토큰으로 그대로 옮기지 않았다. 전체 WCAG 인증을 수행했다고 주장하지 않는다.

Paperlogy의 무손실 WOFF 추가로 5개 파일 합계 전송 크기 6,546,240→3,115,092bytes(52.4% 감소), TTF 원본·OFL·glyph/metrics 유지. React vendor를 분리하고 생성 guide rasterization/결과 대조 guide를 lazy load한다. 접힌 결과 대조가 SVG→JPEG를 미리 수행하지 않게 했다. AssetImage는 async decode를 사용한다. 초기 entry는 기존 652,425bytes에서 최종 약 432KB로 분리되고 vendor는 약221KB이다. 총 JS가 같은 비율로 줄거나 실측 로딩 시간이 34% 줄었다고 주장하지 않는다. high 모델과 더 선명한 입력은 오히려 생성 시간·비용을 늘릴 수 있다.

## Phase 4 — 실행한 검증

- lint / typecheck / build 통과. 전체 Vitest 31파일 272검사 통과. 일부 저장소 오류 stderr는 의도한 fail-closed mock 케이스다.
- qa-typography-navigation: 개발/production, 1920×1080·1220×672·390×844·320×720의 48개 캡처. 실제 Paperlogy/Wanted glyph-font, 5개 TTF 해시/HTTP/dist 동일성, 최소12px, 가로 overflow 없음, 패널 내부 버튼·키보드·history/reload 확인.
- qa-current-logic: 빈 도면 이동, fresh/retain 교체·ratio·alignment gate·undo/reload, 고정 벽 장식·조명 허용/출입구 거절, reference 파생값 정리·persistent undo, 시점 hide/복원, 3-view batch busy·2번째 실패 시3번째 중단·첫 결과 유지·불확실 재호출 보호·stale snapshot. 최종 모델 변경 후에도 다시 통과. mock POST2, paid0, JS0.
- qa-lighting-products: 바닥/천장 충돌, 천장-가구 겹침 허용, duplicate/undo/reload, 상품-support 및 잠긴 host의 키보드 위치, 미배치 support 거절·고정천장충돌·시점이력. paid0, JS0.
- qa-generation-inputs: 실제 JPEG/crop/grid/sheet·도면 입력을 브라우저에서 준비하고 guide 캡처 직접 확인. 중간 lossy encoding 제거·byte limit·동일 E키/좌표 확인, paid0/JS0. 상세 IMAGE_GENERATION_20261008.md.

캡처는 `.gitignore`의 qa-screens/ 아래다. `ui-polish-20261008/final`, `final-model`, `figma-source`, `generation-inputs`에 보관했다. 인위적 디자인 예시와 mock 이미지는 실제 모델 결과로 보고하지 않는다.

## Figma 적용 범위와 남은 문제

파일 J2ZHftzWmLR7OQhpyMFJQA, page80:2, section216:262만 수정했다. 프레임216:263(홈),216:315(사진),216:457(도면),219:477(배치),219:792(레퍼런스),219:994(검토),219:1243(결과 전 빈 상태),219:1462(가이드)를 현재 코드 방향으로 동기화했다. 실제 텍스트·벡터·이미지·기존 버튼 instance를 사용하며 전체 화면 PNG를 하나의 배경으로 대체하지 않았다. 신규 동기화 이전 root와 가이드 사본은 숨김 복구본으로 보관했다. 외부 원본 54개 노드의 이름·x/y·width/height는 변경 전과 같다고 읽기 검사로 확인했다. 문서 전체 JSON export를 성공했다고 주장하지 않는다.

Paperlogy Regular/Medium/SemiBold/Bold/ExtraBold는 Figma에서 확인해 적용했다. Wanted Sans/Adobe 해당 글꼴은 제공되지 않아 승인된 Noto Sans KR 대체가 남으며 웹과 동일 glyph 폭을 보장하지 않는다. 짧은 라벨 줄바꿈과 일부 canvas camera/패턴 누락을 직접 캡처에서 발견하고 보정했다.

**아직 완료되지 않은 항목:** 마지막 아이콘 정렬 보정 호출에서 Figma가 “Education plan MCP tool call limit” 오류를 반환했다. 따라서 최종 섹션의 일부 구조 행/탭/시점 카드 등 아이콘이 자동 배치 가운데에 남아 문구와 겹치는 차이가 있으며, 정확한 source 좌표는 FIGMA_PENDING_ALIGNMENT_20261008.json에 남겼다. 이후 전체 프레임 재캡처·픽셀 정합성 확인도 못 했다. 웹 코드 아이콘 중심은 검증했으나 Figma 동기화는 픽셀 단위 완료로 보고하지 않는다. 도구 한도 해제 이후 이 좌표 보정과 재캡처가 남는다.

최초 무료 모델 메타데이터 조회는 로컬 키의 HTTP401/invalid_api_key였다. 사용자가 서버 키 갱신을 완료한 뒤 재조회하여 **HTTP200, model id=gpt-image-2**를 확인했다. 두 조회 모두 이미지 생성 호출 0회다. 실제 유료 편집 권한·결제·이미지 품질 또는 Vercel 서버 키가 검증되었다고 해석하지 않는다.

코드 커밋 `62350400b64d66c80e049719db4f05583310707b`는 원격 작업 브랜치에 올라갔고 GitHub의 해당 커밋 Vercel 상태가 success임을 확인했다. 당시 production의 /api/status는 여전히 gpt-image-1-mini/low이므로 작업 브랜치 배포를 운영 반영으로 보고하지 않는다. main 반영은 자동 승인 검토가 공유·배포 영향에 대한 별도 승인 부족을 이유로 거절했으나, 이후 사용자가 **main 반영과 자동 배포를 명시적으로 승인**했다. 승인 후 main 반영·운영 검증을 이어간다.

## 변경 파일 범위

App.tsx 및 SpaceDirection/LayoutWorkspace/MappingWorkspace/PlanCanvas/PlanMovementOverlay/CameraSummary/NucleoIcon/AssetImage, 신규 WorkspaceRegistration/ResultPlanComparison, respace.css/tokens.css, vite.config.ts, fonts.css·5 WOFF·sync-paperlogy-fonts.py, generationContract/imageProvider/planGuide/api generate, API/planGuide tests와4 browser QA scripts. AGENTS·DESIGN_SYSTEM·FONT_PROVENANCE·ICON_MANIFEST·ARCHITECTURE·INTERACTIONS·API_INTEGRATION·CURRENT_LOGIC·UX_SPEC_CHANGELOG·README와 새 QA/모델 기록을 함께 갱신한다. 사용자 원본 WantedSans/·memomentKkukkkuk.otf·DESIGN.md·Paperlogy 원본은 변경하거나 새로 커밋하지 않는다.
