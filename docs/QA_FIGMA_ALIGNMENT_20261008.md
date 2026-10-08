# ReSpace Figma 정합성 복구 · 2026-10-08

## Phase 1 — 실제 자료 확인

- 기존 React 19 / TypeScript / Vite 앱을 이어 수정했다. 처음 tracked Git 변경은 없었으며 사용자 `WantedSans/`, `memomentKkukkkuk.otf` 원본을 보존했다.
- AGENTS와 PRODUCT, DESIGN_SYSTEM, INTERACTIONS, ARCHITECTURE, QA, FONT_PROVENANCE, ICON_MANIFEST, DESIGN.md 및 최신 시각 규칙을 확인했다.
- 사용자 로컬 MCP `http://127.0.0.1:3845/mcp`에서 실제 `get_design_context`, `get_metadata`, `get_screenshot` 응답을 읽었다. 파일 `J2ZHftzWmLR7OQhpyMFJQA`, Home `175:272`, Step 1 `173:118`, 평면도 `182:882`를 기준으로 삼았다.
- 작업 도중 사용자 변경을 다시 읽어 Progress `164:702`의 네 상태 `164:653 / 703 / 750 / 797`을 적용했다. **이번 작업은 Figma 쓰기·편집·변경 저장을 하지 않았다.** SVG도 읽기 전용 응답의 asset URL에서 원본 바이트 그대로 받았다.
- 원격 Figma connector의 최초 Home 응답은 흰 패널 x920인 이전 값이었다. 사용자 로컬 MCP의 최신 x1077을 채택했다. 추측한 Figma 값을 사용하지 않았다.
- Step 2 `182:719`, Step 3 `189:1452`, Step 4 `189:1514` 원본은 헤더만 존재해 본문을 1:1 복제할 수 없다. 기존 편집 화면에 Step 1의 공통 표현을 적용하는 대상으로 구분했다.
- Edge Chromium + Playwright로 배포 사이트와 로컬 개발 화면을 1920×1080에서 캡처했다. Vite 개발 주소는 `http://127.0.0.1:5174/`다. 기본 shell/Node REPL sandbox 초기화 오류가 있어 승인된 shell 실행으로 검증했다.

### 불일치 목록 — 1920×1080

| 요소 | 실제 Figma 기준 | 수정 전 로컬 브라우저/CSS | 수정 사항 |
|---|---|---|---|
| 홈 흰 패널 | x1077, 843×1080, R40 | x920, 1000×1080 | 원본 열 비율 56.09375% 적용 |
| 홈 브랜드 | x1163 y188, 34px/700, 34px 높이 | x1077 y188, 글자 크기는 동일 | 위치·281px 그룹 폭, 실제 Adobe 로딩 대기 |
| 홈 입력 | x1161, y351/482/617, 496×62, R8 | x1077, 575×62 | 496px 폭·22px inset 적용 |
| 홈 레이블 | 24px/500, 29px 줄 높이 | 데스크톱 동일; 모바일 18px override | 원본 24px 유지, 작은 화면은 재배치 |
| 홈 주 행동 | x1139 y814, 541×80, R12, 28px/400/1.6 | x1052, 600×80, 27.84px clamp/22px 줄 높이 | 고정 원본 크기와 줄 높이 적용 |
| 홈 안내 | x1161 y723, 516px 그룹 폭, 16/14px, tertiary | x1077, 575px, secondary | 원본 폭·색·강조 굵기 적용 |
| Step 1 작업 경계 | x242, 1440×938 | x240 | 원본의 +2px 위치 복원; 헤더는 x240 유지 |
| 공간 사진 | x288 y218, 932×694, 단일 R14.4 윤곽 | x286, 실제 폭이 1px 작아질 수 있음 | border 포함 폭 보정, 원본 좌표 |
| 사진 이름 | Paperlogy 20px/400 | Wanted 기반·새 Paperlogy 적용 시 끝 잘림 | 원본 글꼴·좌표 유지, 오른쪽 불필요 padding 제거 |
| 사진 순서 | Paperlogy 16px/500, 현재 번호 800 | 일반 보조 글자 스타일 | 실제 16px, 검은 글자, 제공 ExtraBold 사용 |
| 우측 패널 | x1276 y171, 396×792, R8, border 없음, 0 0 8px/4% | x1274, 나머지 주요 크기 동일 | 좌표·공통 패널 규칙 유지 |
| 기본 구조 표 | 370×161, R6, .5px/neutral-400 40% | 경계색이 더 진함 | 원본 반투명 outline 별칭 |
| 목표 입력 | x1288 y644, 370×188, 14px/500/17px, border 없음 | x1286 y645, 투명 1px border | 원본 좌표·0 border·placeholder opacity .4 |
| 최신 진행 표시 | 전체 422×36, 현재 248×36/R18, Paperlogy 22px/500/26px | 이전 Nucleo형 아이콘, 430px/256px, 검은 글자 | 새 원본 SVG 10개·네 상태·흰 글자 적용 |
| 이후 단계 제목/이동 | 사용자 요청: 중복 상단 삭제, 하단 오른쪽 이동 | y92~164 제목 행·상단 이전/다음 | 접근 가능한 제목은 유지하고 시각적으로 숨김, 공통 하단 이동 |
| 작은 화면 배치 | 미완성 화면의 반응형 설계 대상 | 3열/2열 유지로 화면 밖 패널 잘림 | 999px 이하 세로 작업 패널·280px 도면·내부 도구 스크롤 |

원본 `AUTO` line height는 metadata의 실제 텍스트 박스 높이와 브라우저 값을 함께 확인했다. 현재 단계 버튼은 원본 시각 면 36px, 조작 영역 48px를 유지한다. 완료 검증을 뜻하는 체크는 추가하지 않고 이전 단계 색만 원본에 맞춘다.

## Phase 2 — 완성된 화면 복구

홈/공간 사진/평면도와 진행 표시를 실제 원본 값으로 수정했다. 홈 이미지의 source asset와 기존 파일 SHA-256은 동일하다 (`c997bac0…d42b2`). 사진 단일 윤곽, 원본 중립 배경 wash, 원본 SVG 색과 구조 자산을 유지한다. 새 홈 이미지·아이콘 라이브러리·애니메이션을 만들지 않았다.

Wanted Sans 본문·홈, Adobe timeline-210 브랜드, Paperlogy 설명/사진/최신 진행 표시, Noto Sans KR 사진/평면도 탭을 역할별로 적용했다. `document.fonts`에서 Wanted, timeline-210, Paperlogy 400/500/800, Noto Sans KR 500의 실제 loaded 상태를 확인했다. Noto는 [공식 Google Fonts](https://fonts.google.com/noto/specimen/Noto+Sans+KR) CSS로 읽으며 [공식 OFL](https://github.com/google/fonts/blob/main/ofl/notosanskr/OFL.txt)을 확인했다. 새 폰트 바이너리는 복사하거나 추가하지 않았다.

`qa-source-design.mjs`는 원본 Home/Step 1/Progress 주요 좌표·폭·높이·반경과 글자 크기를 ±1px 이내로 검증했다. 1920×1080, 1864×932, 1313×932, 1220×672에서 목표 입력/Next/기본 구조·썸네일이 패널 안에 표시된다. 분위기 4장 업로드·native drop·disabled·hover/focus 삭제·되돌리기·저장 제목 재개도 통과했다.

## Phase 3 — 미완성 화면 연결

레이아웃·레퍼런스·시점·생성 전 확인·결과 화면의 실제 기능을 보존했다. 외곽 패널은 Step 1 R8·무테·중립 4% shadow, 공통 패널 제목은 원본 20px/600/24px를 사용한다. 그림/도면/결과가 본문 중심이며 안쪽 정보를 별도 장식 카드로 늘리지 않는다.

WorkflowNavigation을 Step 1과 이후 화면에 공유한다. 프로젝트 제목 행과 상단 이동 중복은 제거하고 우측 하단에서 이전/다음/조건 확인을 제공한다. 헤더 진행 표시, Step 4의 생성 전/결과 탭, 시점 선택, 생성·내보내기 액션은 각각 기능이 달라 유지한다. 수정 경로·브라우저 history·reload·키보드 route focus도 유지한다.

사용자가 지정한 [Apple HIG](https://developer.apple.com/design/human-interface-guidelines)의 명확성·일관성·우선순위·피드백·사용자 통제·접근성 원칙을 기존 구성에 적용한다. Apple 색/글꼴/브랜드 자산을 가져오지 않는다. 웹 읽기 도구에서 해당 페이지 본문은 JavaScript 요구로 반환되지 않아 HIG의 추가 수치나 문장을 읽었다고 주장하지 않는다.

모바일에서 기존 grid의 패널 잘림을 캡처로 발견하고 세로 배치를 추가했다. 진행 글자는 22px를 유지하며 좁은 헤더 안에서 가로 스크롤한다. 사용 가이드는 44px 아이콘 링크와 한국어 접근 이름으로 남는다. 도구 패널은 280px 내부 스크롤, 도면은 280px 높이, 세부 설정은 작업 영역의 세로 스크롤로 접근한다.

## Phase 4 — 검증 결과

- `npm run typecheck`, `npm run lint`, `npm test` (30개 파일 / 260개), `npm run build` 통과. 빌드에는 기존 큰 JS chunk 경고가 남는다.
- Playwright 원본 geometry 검사와 기존 `qa-workspace.mjs` 회귀 통과. 배치 유형·상품 받침·천장 조명·충돌·크롭/전체 이미지 적용·다중 연결·Undo/Redo·재로드·이전/다음 history·reference 삭제/영구 복구·legacy 12개 보존 확인.
- `qa-element-visibility.mjs`도 통과했다. 일반 새 프로젝트의 사진 업로드가 도면/물체/카메라를 자동 생성하지 않고 명시적 개략 도면 이후 reload하는 경로, 이전 천장 요소·배치/미배치/제외/끊긴 연결 데이터·선택/zoom·모의 결과 저장을 확인했다.
- 결과 활성화·조건 변경 시 stale·이력 보존·조건으로 돌아가 수정·작업 기록 JSON 및 이미지 다운로드 확인. **생성 API는 모의 응답**이므로 실제 AI 결과나 품질 검증이 아니다. 유료 호출 0회.
- 홈, 홈 유효 입력 상태, Step 1 사진/평면도, Step 2, Step 3, 생성 전 확인, 시점, 빈 결과를 1920×1080에서 캡처했다. 1440×900, 1280×800, 768×900, 390×844의 7화면 = 28개 반응형 상태도 캡처·검사했다. DOM page error 0, 표시 이미지 로딩, 패널 좌우 경계, 하단 이동, 가이드, 실제 font style, 키보드 초점을 검사했다.
- 직접 캡처를 열어 원본·수정 화면·미완성 화면·모바일·모의 결과를 시각적으로 확인했다. 확인 도중 드러난 모바일 잘림과 사진 이름 ellipsis를 수정했다.
- 저장/스키마/이력/typed-anchor/구조 보존/카메라/실험 기록/서버 quota 계약은 수정하지 않았다.

### 증거 위치와 재실행

`qa-screens/alignment-20261008/figma/`: 로컬 MCP context/metadata/스크린샷. `before/`, `deployed/`: 수정 전 캡처. `after/`: 최종 데스크톱/반응형 캡처와 `measurements.json`. `geometry/`: 원본 geometry와 상태 검사. `functional/`: 실제 편집 과정·모의 결과 캡처. 해당 폴더는 기존 gitignore에 따라 로컬 증거로 남는다.

검사 스크립트는 `QA_BASE_URL`, `QA_SCREENSHOT_DIR`, `PLAYWRIGHT_MODULE`, 기존 스크립트의 `CHROME_PATH`로 환경을 지정할 수 있다. `read-figma-source.mjs`와 `sync-figma-progress-assets.mjs`는 각각 Figma 읽기 증거 수집과 읽기 응답 asset 복사만 한다.

### 변경 파일

- `src/app/App.tsx`: 상단 중복 이동 제거·공통 footer·새 진행 아이콘 연결.
- `src/components/WorkflowNavigation.tsx`, `WorkflowStepIcon.tsx`: 공유 이동·원본 진행 아이콘 상태.
- `src/components/SpaceDirection.tsx`, `SwipeCarousel.tsx`: 공유 Next·실제 순서의 강조 굵기.
- `src/styles/tokens.css`, `respace.css`: 원본 역할별 수치·글꼴·색·위치·반응형.
- `index.html`, `dev/local-paperlogy.css`: 공식 Noto CSS·기존 제공 Paperlogy 800 개발 로딩.
- `public/figma/progress/`, `docs/FIGMA_PROGRESS_ASSETS_20261008.json`, `ICON_MANIFEST.md`: 새 원본 SVG 상태·출처·해시.
- `scripts/qa-figma-alignment.mjs`, `qa-source-design.mjs`, `qa-workspace.mjs`, `read-figma-source.mjs`, `sync-figma-progress-assets.mjs`, `eslint.config.js`: 캡처·기능/수치 검사·읽기 도구 설정.
- 디자인/상호작용/구조/QA/폰트/changelog 문서: 최신 원본 우선순위와 제한 기록.

### 남은 차이·검증하지 않은 범위

1. **해결됨 — 후속 사용자 지시:** 사용자가 폰트 파일 배포 금지를 철회하여 검증된 제공 Paperlogy 5종과 OFL 고지를 public/빌드에 포함했다. 개발·production의 실제 렌더링 폰트 일치는 QA_TYPOGRAPHY_NAVIGATION_20261008.md에서 검증한다. 외부 Adobe/Google provider 불가 시 fallback은 유지한다. 이 문서의 원본 font size 비교는 후속 가독성 요청 이전 기록이다.
2. 실제 데이터 기준 사진은 2장, Figma 예시는 3장이다. 1/3을 하드코딩하거나 근거 없는 세 번째 공간 사진을 만들지 않는다. 빈 참가자 번호의 시작 버튼은 기존 검증대로 disabled이며 Figma 검은 ready 버튼과 다르다. 유효 입력 상태도 따로 캡처했다.
3. Step 2~4 본문에는 완성된 원본이 없어 pixel-perfect Figma 일치를 주장하지 않는다. 기존 서비스 기능과 원본 디자인 언어를 연결한 구현이다.
4. Edge Chromium을 사용했다. 실제 iOS Safari/Android 기기, 스크린 리더, 실제 AI 이미지 모델/공간 일치, 운영 서버 quota·저장 장애를 이번 브라우저 QA에서 검증하지 않았다. 서버 단위 테스트는 실행했다.
5. 기존 배포 사이트는 읽기만 했다. Git commit/push 및 Vercel 배포를 실행하지 않았다.
