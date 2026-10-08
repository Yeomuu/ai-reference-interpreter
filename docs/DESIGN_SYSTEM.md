# Design system — ReSpace / v1.2

## 사용자 주석 반영·정돈 · v1.4.6 · 2026-10-08 (최우선)

최신 사용자 요청은 이전 Figma 편집 금지를 **최종 디자인 섹션 216:262에 한해서** 대체한다. 현재 코드와 해당 섹션을 동기화하며 홈/STEP 01 원본과 외부 디자인 시스템은 읽기 전용이다. 폰트 크기는 v1.4.5에서 승인한 역할을 유지한다. DESIGN.md 원본과 ReSpace 색·외곽 비율은 유지한다.

- 진행의 시각 pill은 36px, 현재 폭 248px, 클릭 높이 48px이다. 아이콘과 문구 그룹을 가운데 정렬하고 좌우 16px padding을 동일하게 둔다. 아이콘만 있는 상태는 36×36 중심이다. 사용자 지정 펼침/닫힘은 240ms이며 reduced-motion에서는 생략한다.
- 사용 가이드는 보조 내용 토큰 14px/32px 높이의 조용한 제어다. 생성 전 확인/결과 탭은 STEP 01 탭의 밑줄·중립 wash를 재사용한다. 결과 없음 상태의 disabled 의미를 유지한다.
- STEP 02 도구 탭 순서는 구조/배치/영역이며 기본 선택은 배치다. 왼쪽 선택·이동 버튼과 영역 목록은 제거한다. 현재 도구를 다시 누르거나 카테고리를 바꾸면 선택 모드로 돌아간다. 영역 선택은 도면의 ‘영역·동선’ 메뉴를 사용한다. 학교/필수 보존 시나리오는 창·문·출입구 추가 도구를 숨기며 일반 공간은 유지한다. STEP 02/03 도면 래퍼는 투명·무테·그림자 없음이다. 외부 사이드 패널의 기존 R8은 유지한다.
- 도면 toolbar는 32px 공통 높이, undo/redo는 공식 아이콘과 접근 가능한 이름, 구조/요소 표시와 영역·동선 접기는 유지한다. 사용자 요청에 따라 가시 zoom/reset 제어만 제거한다. ‘실측 전 개략도’는 정확한 치수나 측정을 주장하지 않는다.
- 통행은 세로 점선 패턴, 여닫이 여유는 대각선 패턴으로 구분한다. 색상만으로 의미를 전달하지 않는다. 범례에도 같은 패턴을 쓴다.
- 이전·다음은 패널 footer에서 space-between/24px gap으로 배치한다. STEP 04 검토 footer의 주 행동은 전체 폭 AI 이미지 생성이며 기존 사전 검증을 그대로 따른다. 보존 구조는 기본 접힘, 비어 있는 제외 조건과 학교 ‘미리 준비된 결과 없음’ 블록은 표시하지 않는다.
- STEP 01 원본 Corner/Center marker를 WorkspaceRegistration으로 재사용한다. STEP 02는 두 열 경계, 나머지는 해당 작업 열 경계에 놓고 pointer-events:none, 모바일 숨김을 유지한다. STEP 01 사진 상단 offset은 사용자 요청으로 126→96px, 원본 이미지 크기·종횡비·마스크는 유지한다.
- 실험 기록에는 위/좌/우 테두리만 둔다. 선택·포커스·오류·저장·되돌리기 기능을 장식 변경으로 제거하지 않는다.

세부 비교·실행 근거·Figma 미완료 항목은 QA_UI_POLISH_20261008.md에 기록한다. Apple의 폰트·색·컴포넌트 형태는 가져오지 않는다.

## 사용자 승인 타이포그래피·배포 폰트·패널 내부 이동 · v1.4.5 · 2026-10-08 (최우선)

사용자가 화면 가독성을 기준으로 Figma와 달라도 글자 크기를 조정하도록 명시했다. 이전의 원본 크기 고정과 폰트 파일 handoff 금지는 대체된다. 당시의 Figma 편집 금지는 위 v1.4.6의 제한된 동기화 지시로 대체된다. 원본 아이콘·색·외곽 비율과 기능을 유지한다.

| 역할 | 크기 / 줄높이 | 적용 |
|---|---|---|
| 캡션·상태 | 12 / 18px | 카운터·안내, 기존 10px 안내는 12px |
| 보조 내용 | 14 / 22px | 덜 중요한 설명·속성명 |
| 본문·일반 입력·일반 버튼 | 16 / 24–26px | 기존 적절한 16–18px는 유지 |
| 섹션·패널·탭·진행·이동 버튼 | 18 / 24–29px | 진행 22→18, Step 1 제목·탭·사진 캡션·Next 20→18 |
| 제목 | 20–22 / 28–32px | 공통 h2 20, 페이지 h1 22 |
| 홈 폼 제목·시작 버튼 | 22 / 29–35px | 원본 24/28에서 축소, 입력 18 유지 |
| 홈 브랜드·큰 소개 | 32 / 32, 46 / 73.6px | identity 역할을 유지하며 원본에서 각각 2px 축소 |

Wanted Sans와 제공 임시 fallback은 기존 로컬 웹 자산을 유지한다. Paperlogy 400/500/600/700/800은 검증된 제공 TTF 그대로 public/fonts/paperlogy/에 포함하고 기존 OFL 고지를 함께 배포한다. 개발·production 공통 fonts.css로 읽는다. Adobe 브랜드는 공식 키트를 유지한다. 출처·해시: FONT_PROVENANCE.md, FONT_ASSETS_20261008.json.

모든 단계의 이전·다음은 Step 1처럼 사이드 패널 내부 하단 WorkflowNavigation에 둔다. 패널 내용만 스크롤하고 footer는 패널의 마지막 고정 영역이다. 3단계는 기존 레퍼런스 패널을 오른쪽으로 배치하여 도면이 왼쪽, 패널·이동이 오른쪽이 되게 한다. 모바일은 도면 다음 패널 순서와 작업 영역 스크롤을 사용한다. 사용자가 카메라/이전 프로젝트 inspector를 숨긴 경우에만 외부 하단 이동을 fallback으로 제공한다.

## 로컬 Figma 최신 정합성 · v1.4.4 · 2026-10-08 (이전 기록)

Home 175:272 / Step 1 173:118 및 사용자 실시간 수정 Progress 164:702를 읽기 전용으로 확인해 적용한다. Figma는 편집하지 않는다. 아래 이전 Home x920/575px/600px와 진행 430px/256px 값은 최신 값이 아니다. 현재 홈은 흰 패널 x1077, 입력 496×62, 주 행동 541×80이며 원본 Wanted Sans 48/34/24/18/28px 역할을 유지한다. Step 1 main은 원본 x242(+2), 헤더는 x240이다.

Progress는 422×36, 현재 pill 248×36/R18, Paperlogy Medium 22/26px·500·흰색이다. 이전 단계는 surface-selected/border-selected, 예정 단계와 연결선은 원본 #C4CBCF 별칭이다. 실제 아이콘/상태 10개의 경로·해시는 FIGMA_PROGRESS_ASSETS_20261008.json. 48px 조작 영역과 단계 이동 의미를 유지한다. 사진/평면도 탭은 Noto Sans KR 20px·500, 설명/캡션/순서는 Paperlogy이며 사진 순서는 16px·500/800이다.

Step 2 이후에는 중복된 상단 제목/이전·다음 행을 시각적으로 숨기고 이동을 하단 오른쪽 WorkflowNavigation에 둔다. 접근 가능한 route 제목·헤더 진행·Step 4 기능 탭은 유지한다. 공통 패널 제목은 Step 1 20px·600·24px, 외곽 R8·무테·0 0 8px/중립 4% shadow. 빈 결과 조건 패널에는 장식 프레임을 추가하지 않는다.

999px 이하 editor는 1열로 재배치하고 기존 280px canvas 최소 높이를 사용한다. 도구는 280px 내부 스크롤, 속성은 작업 영역 세로 스크롤로 제공한다. 좁은 헤더에서 22px 진행 글자를 축소하지 않고 가로 스크롤하며 가이드를 유지한다. 원본 흰색 radial wash와 탭의 중립 linear wash만 source 전용 token으로 복구한다. 새 브랜드 색·폰트 크기 스케일·장식/애니메이션은 없다.

이 기록의 개발 전용 Paperlogy 정책은 v1.4.5 사용자 지시로 폐기되었다. 원본 역할별 family를 유지하며 글자 크기와 배포 방식은 위 최신 규칙을 따른다.

## 원본 SVG·상태·패널 정정 · v1.4.3 · 2026-10-08 (최우선)

홈 175:272 / STEP 01 173:118의 디자인과 실제 텍스트·노드 치수를 기준으로 적용한다. 아래 v1.4.2의 STEP 02/03 R0 해석은 사용자 지시에 맞지 않아 폐기한다. STEP 02~04 외곽 패널은 STEP 01과 같은 R8, 스트로크 없음, 0 0 8px 중립 4% 그림자를 쓴다. STEP 02의 도구–캔버스–설정 3열과 STEP 03의 2열 및 기존 편집 로직을 유지한다. 안쪽 구분 행까지 장식 카드로 만들지 않는다.

- source SVG: public/figma/source/. 원본 노드만 exportAsync(SVG_STRING)으로 내보낸다. 주변 프레임·회색 export 배경은 포함하지 않는다. 경로·색·stroke·intrinsic 크기를 바꾸지 않는다. 노드/해시 대응은 FIGMA_SOURCE_ASSETS_20261008.json.
- 기본 구조 5개는 원본의 방향별 SVG를 사용한다. 일반 프로젝트와 실제 도면 geometry는 기존 PlanSymbol, 배치 요소는 LayoutSymbol, 다른 일반 UI 액션은 기존 NucleoIcon을 유지한다.
- 원본 Corner Marker 4개 / Center Marker 2개는 STEP 01 작업 영역 경계에 놓고 입력을 가로채지 않는다. 줄인 반응형 화면에서는 경계에 따라 위치만 변하며 모바일에서는 숨긴다.
- 분위기 썸네일 기본/호버의 Boolean 윤곽은 원본 R6 SVG 마스크로 분리한다. 슬롯이 줄어들 때도 원본 93:79 비율을 유지하여 mask가 가운데 letterbox되지 않게 한다. 삭제는 기본에 숨기고 hover/focus-within에서 원본 15px trash를 표시한다. 키보드 focus-visible과 삭제 복구는 유지한다.
- STEP 01 탭·섹션 제목 20px, 구조 행 16px, 목표 입력 14px, 원본 분위기 설명 10px, 필수/카운터 12px, Next 20px. 임의로 font size를 축소하지 않는다. 사진 캡션은 20/24px·400. 원본 탭의 active는 기존 lavender-500, inactive는 확인한 #C4CBCF(전용 source alias); 필수는 기존 sage-300. 홈 패턴 opacity .6도 원본 fill 값이다. 새 브랜드 컬러가 아니다.
- STEP 01 학교 시나리오 패널은 내부 scrollbar 없이 제목·업로드·구조·목표·Next를 함께 표시한다. 목표는 남은 높이를 채우고 max-height=188px. 800px 이하 높이에서는 간격만 줄여 입력란과 Next를 유지한다. 모바일과 구조가 임의로 많은 일반 프로젝트는 기존 작업 영역 스크롤을 사용한다.
- 원본 사진/도면 탭 SVG·업로드 SVG·헤더 진행/도움말 SVG·홈 안내/패턴/광원·실험 기록 SVG를 재사용한다. 홈/STEP 01 원본에 없는 provenance 문구와 상시 추가 안내는 표시하지 않는다. 사진이 도면을 자동 생성하지 않는 사실·기록 안내는 사용 가이드/접근 가능한 설명에서 확인할 수 있다.
- 홈 기본값은 편집 가능하며 원본 부유/미세 parallax와 R40 흰 프레임 전환은 유지한다. 로고는 프로젝트 화면에서 홈으로, 홈에서 저장 프로젝트 목록으로 연결된다. 키보드 목록 이동 버튼은 초점을 받으면 나타난다.

DESIGN.md 원본, 도면 권한·보존·typed-anchor·migration·API/quota·history 계약은 유지한다. Figma의 대체 글꼴은 사용자가 승인한 Noto Sans KR이고 웹은 제공 Wanted Sans/Adobe 키트이므로 글자 폭이 완전히 같다고 주장하지 않는다.

## 원본 우선·핵심 작업 집중 · v1.4.2 · 2026-10-08 (이전 시각 변경보다 우선)

홈 `175:272`와 STEP 01 `173:118`의 구성·반경을 임의로 통일하거나 새로 디자인하지 않는다. 실제 노드에서 확인한 홈 흰 프레임 R40, 입력 R8, 시작 버튼 R12, STEP 01 패널 R8/0 0 8px 중립 4% 그림자, 작은 표·업로드 R6, 사진 단일 윤곽 R14.4를 요소별로 적용한다. 1920×1080 원본에서 홈 헤더 76px, 작업 헤더 92px, 사진 932×694, 사이드 패널 396×792를 확인했다. 본문·헤더의 1440px 공통 경계는 유지한다. 폭이 작은 화면에서만 기존 반응형 규칙을 적용한다.

홈은 원본 `home-spatial-collage.png`로 복원한다. 부유 움직임은 기존 6초/14px/±.5도이고, 줄이는 것은 포인터 패럴랙스(최대 2px/1.5px/.08도)다. 검은 배경은 viewport 전체 아래에, 흰 R40 프레임은 그 위에 놓인다. 원본 로고 윤곽·R/S 색과 사용자 제공 웹 글꼴을 유지한다. reduced-motion에서는 움직임·전환을 생략한다.

STEP 02는 도구–도면–설정의 연속 3열 편집 화면이다. STEP 03은 레퍼런스–도면 2열이다. 두 화면의 맞닿는 작업 판은 R0/그림자 없이 조용한 구분선으로 나누며, 홈·1단계의 R값을 바꾸지 않는다. 도구 타일의 상시 채움·빈 inspector의 장식 프레임을 덜고 선택·hover·키보드 포커스는 유지한다. STEP 04에서 동일 오류를 두 번 표시하지 않고, 유지 구조·시안 방향은 접기로 제공한다. 선택·배치·적용·생성과 실제 오류 이유는 우선 표시한다.

사용자 제공 `DESIGN.md`는 원본 그대로 보존한다. [Apple HIG](https://developer.apple.com/design/human-interface-guidelines)와 [Split views](https://developer.apple.com/design/human-interface-guidelines/split-views)의 콘텐츠 우선, 명확한 선택, 복구, navigator/canvas/inspector 분할 원칙을 참고한다. Apple 마케팅 화면의 색·폰트·로고·반경을 가져오지 않는다. 사용자 원본이 있는 화면은 원본을 우선한다.

요청한 oh-my-design-cli@latest(확인한 버전 2.0.2)를 실행하여 프로젝트의 Codex용 omd-init/omd-apply 스킬만 설치했다. 외부 도구 파일 `.agents`는 앱 빌드·lint·Git 산출물에서 제외한다. 기존 DESIGN.md/AGENTS.md 및 서비스 설정은 덮어쓰지 않았다. 새 스킬의 런타임 등록에는 세션 재시작이 필요하며, 이 작업에서 전체 OmD 그래프 변환이나 다른 에이전트 실행을 했다고 주장하지 않는다.

## 원본 프레임 표현 복원 · v1.4.1 · 2026-10-07 (아래 이전 시각 규칙보다 우선)

원본 홈 175:272와 공간 173:118의 실제 값을 재확인했다. 바깥 편집 패널은 `radius-panel=8px`, 스트로크 없이 `shadow-panel=0 0 8px rgba(23,25,29,.04)`로 구분한다. 패널 내부는 추가 그림자 없이 여백·아주 옅은 구분선을 사용한다. 입력은 8px, 버튼은 12px, 작은 업로드/기본 구조 표는 6px, 현재 단계는 18px, 홈 흰 프레임의 왼쪽 두 모서리는 40px다. 사진의 단일 윤곽 14.4px와 원형 시점/진행 기호는 별도 의미를 유지한다. `tokens.css`의 의미 반경을 공유한다.

홈의 검은 배경은 전체 viewport 아래에 있고 흰 프레임이 그 위에 놓인다. 부모 main-content에 밝은 배경을 남겨 라운드가 희게 메워지지 않도록 한다. 새 투명 홈 일러스트는 전시 공간 구상을 표현한 독립 생성 자산이며 사용자 시안 생성 결과가 아니다. 원본 Figma의 콘텐츠 이미지는 보존한다. 이동은 최대 가로 2px/세로 1.5px/회전 .08도, 부유는 10초에 2px이며 reduced-motion에서는 생략한다.

헤더 워드마크는 원본 R 라벤더·S 세이지를 복원한다. 나머지 글자는 밝은 헤더에서 neutral-900, 홈의 검은 배경에서 흰색이다. 홈 입력 프레임의 로고는 원본처럼 중립 단색이다. SVG 전체에 흰색 필터를 걸지 않는다. 최신 Figma 섹션/가이드 ID는 유지하며 버전은 v1.4.1이다.

### 사진 통합 윤곽 · 사용자 추가 설명 2026-10-07

원본 180:549는 932×694 사진에서 좌상단 333×54 및 우하단 161×58 정보 영역을 제외한 단일 윤곽이다. 전체 외곽과 두 오목한 모서리에 radius-space-photo=14.4px를 적용한다. 사진 위에 각진 배경 박스를 얹지 않는다. 표시 크기·공간 이름·순서 영역이 변하면 ResizeObserver로 윤곽을 다시 계산하고 이미지 이동·키보드 조작은 유지한다. 이미지 자체는 원본대로 저장하고 화면에서만 crop한다. 이 반경은 사용자 지정 사진 형태에 한정한 예외이며 일반 패널/컨트롤 8/12px 규칙은 유지한다.


## Figma 서비스 디자인 v1.4 · 2026-10-07 (아래 이전 시각 규칙보다 우선)

최신 편집 영역은 파일 `J2ZHftzWmLR7OQhpyMFJQA`, 페이지 `80:2`, 섹션 `216:262`; 디자인 가이드 `219:1462`다. 원본 홈 `175:272`, 공간 사진 `173:118`, 도면 `182:882`를 보존한다. 홈·1단계는 해당 프레임의 이미지, 두 열 비율과 여백을 따르고 2~4단계는 같은 헤더·중립 패널 체계로 확장한다. 과거 v1.3은 자료로 남긴다.

웹의 UI는 사용자 제공 Wanted Sans Variable, 브랜드는 제공 Adobe 키트 `lbi1pvp`의 `timeline-210`이다. 임시 fallback은 제공 MemomentKkukkukk, 이후 Noto Sans KR/system이다. Figma 편집 글꼴은 사용자가 승인한 Noto Sans KR(Regular/Medium/Bold)이고 로고 윤곽은 원본을 보존한다. 폰트 출처는 FONT_PROVENANCE 참조.

| 토큰/규칙 | 값·적용 |
|---|---|
| 공통 본문·헤더 최대 폭 | 1440px, 같은 좌우 경계 |
| 헤더 | 92px; 낮거나 좁은 창 76px |
| 공간 방향 사이드바 | 416px; 좁은 창에서는 기존 반응형 축소 |
| 패널·입력 / 주 행동 / 홈 흰 패널 반경 | 8 / 12 / 40px |
| 패널 테두리·그림자 | 테두리 없음, 0 0 8px 중립 4% |
| 홈 입력 / 시작 버튼 | 62 / 80px |
| 버튼 조작 높이 | 일반 44px 이상, 진행 표시 48px 이상 |
| 본문 / 설명 / 보조 | 16 / 14 / 12px |
| 주 행동 | neutral-900; 라벤더는 선택·현재 단계에 제한 |
| 출입 여유 / 통행 동선 | canvas-door-clearance(라벤더) / canvas-passage(파랑) |

현재 단계는 아이콘·단계명·작은 라벤더 pill, 다른 단계는 중립 원 안 아이콘이다. 완료 여부를 검증하지 않은 단계에 체크를 붙이지 않는다. 도면·사진·결과는 중립 배경으로 유지한다. 일반 UI는 기존 무료 Nucleo, 가구는 LayoutSymbol, 건축은 PlanSymbol의 구분을 유지한다.

홈 일러스트는 투명 전시 공간 구상 이미지에 10초/2px 부유·최대 2px 포인터 이동을 적용한다. 시작 시 흰 패널이 720ms 동안 확장한 뒤 이동하며 reduced-motion에서는 모두 생략한다. UI 색·반경·간격은 tokens.css에서 관리하고 respace.css가 최신 시각 레이어다. 기존 기능·URL·검증·이력은 그대로다.

Figma의 기존 Progress, SourceTabs, ReferenceThumbnail 컴포넌트 ID는 유지한다. 새 Button/Input은 상태 variant 및 텍스트 property를 가진다. NucleoIcon, LayoutSymbol, PlanPreview, BrandMark/Wordmark는 재사용 가능한 네이티브 컴포넌트다. 색은 Primitive→Semantic 별칭, 간격/반경은 Dimension, 글꼴은 Typography 변수와 텍스트 스타일을 공유한다. 결과 예시 이미지는 실제 모델 실행 결과가 아님을 명시한다.

Toss 공식 UX 및 컴포넌트 안내에서는 명확한 행동 문구·예측 가능한 상태·최소 인터럽트 원칙만 참고했다. 토스 자산·색·폰트·컴포넌트 구현은 가져오지 않았다. 근거: https://developers-apps-in-toss.toss.im/design/consumer-ux-guide , https://developers-apps-in-toss.toss.im/design/components .

## 가벽 A/B 조작 상태 · 2026-10-06

A/B는 기존 도면의 면 표식이며 일반 UI 아이콘으로 대체하지 않는다. 편집 가능한 표식은 40px 투명 조작 영역을 갖고 확대에도 CSS 픽셀 크기를 유지한다. 기본/hover/pressed/선택/focus-visible은 기존 surface-hover/surface-pressed/action-selected/focus-ring 토큰을 사용한다. 선택은 aria-pressed, 조작은 button과 Enter/Space로 제공한다. 읽기 전용 도면에서는 조작 의미와 키보드 포커스를 제공하지 않는다. 새 색상·크기 토큰은 추가하지 않는다.

## 진행 표시 상하 여백 · 2026-10-06

헤더 안 진행 표시의 원은 기본 24px, 낮은 창(750px 이하 높이)은 20px이며 내부 아이콘은 12px다. 기존 12px 단계명은 유지하고 줄 높이를 16px로 줄인다. 버튼은 기존 48px 최소 조작 높이를 유지한 채 내용을 중앙 정렬하여 원·현재 표시 윤곽·단계명 위아래에 여백을 확보한다. 연결선은 같은 버튼의 원 중심에 맞춘다. 헤더 높이·단계 위치·URL·키보드 조작은 유지한다.

## 헤더·메인 콘텐츠 경계 정렬 · 2026-10-06

헤더와 메인 콘텐츠는 같은 layout-content-width와 layout-content-max-width=1368px를 사용한다. 좌우 여백은 기존 헤더 기준인 layout-page-gutter=36px, 1199px 이하 24px, 767px 이하 16px를 공유한다. 프로젝트 작업 화면의 별도 무제한 너비 규칙을 대체하며, 제목·작업 패널·하단 실험 패널의 양 끝을 헤더 안쪽 경계와 맞춘다. 기존 내부 열·패널 폭·사진과 도면 종횡비는 유지한다.

## 라벤더·세이지와 ReSpace 심벌 · 2026-10-06 (색상 우선 적용)

사용자가 제공한 Lavender + Sage 이미지의 #B6AAC2·#A6B38E를 브랜드 밝은 색으로 사용한다. 작은 글자·선택 테두리·포커스에는 대비를 확보한 lavender-700/500, 보존·완료에는 sage-700을 쓴다. 기본 화면은 흰 패널과 아주 옅은 중립 배경이며 주 행동은 짙은 중립색을 유지한다. 전체 화면·캔버스를 브랜드 색으로 채우거나 사진·생성 결과를 색보정하지 않는다. 선택한 crop 내부에도 틴트를 넣지 않고 윤곽과 바깥쪽 scrim으로 범위를 표시한다.

기존 violet/green 이름은 새 lavender/sage 토큰의 별칭으로 유지한다. Nucleo 액션 아이콘과 건축·배치 기호는 그대로다. 새로운 R 프레임 심벌은 서비스의 신원에만 사용하며, 브랜드 자산의 고정 색은 tokens.css와 일치시킨다. 작은 크기에도 윤곽이 남도록 넓은 획과 투명 여백을 사용한다. 폰트·패널 크기·선 굵기·모서리·사용 흐름은 유지한다. 근거와 단색 자산: `BRAND_IDENTITY.md`.

## 도구 타일·캔버스 비율 소폭 조정 · 2026-10-05

사용자 요청에 따라 캔버스에 비해 양쪽 설정이 좁아 보이던 비율만 조정한다. 레이아웃 도구 폭은 layout-tools-width=248px, 1199px 이하에서는 layout-tools-compact-width=200px이다. 기존 2열 도구 타일은 너비 기준 약 1.15배, 세로 여백은 space-12로 확대하고 기호는 layout-tool-scale=1.15를 공유한다. 좁은 타일에서는 기호가 내부 너비를 넘지 않는다. 카메라 목록은 layout-list-width=clamp(232px,18vw,280px), 우측 속성은 layout-inspector-width=clamp(272px,23vw,336px)를 사용한다. 공간 자료/레퍼런스/결과 보조 패널은 376px, 생성 조건은 456px이다.

1070px 이상 데스크톱의 3열 도면은 작업 너비의 약 47% 이상을 확보하고, 긴 목록과 설정은 기존 패널 내부에서 스크롤한다. 이미지/도면의 종횡비, 그리기·선택·저장 동작은 그대로다. 헤더·색상·모서리·테두리·폰트·아이콘 자산은 변경하지 않는다. 아래 이전 폭 및 절반 이상 규칙을 이 비율로 대체한다.

## UI 중복 정리·설정 패널 비율 · 2026-10-05 (우선 적용)

기존 네 단계·헤더 진행 표시·편집 동작을 유지한다. 공간 자료/레퍼런스/결과의 보조 패널은 layout-detail-width=360px, 생성 조건 패널은 layout-review-width=440px를 사용한다. 3열 작업의 우측 속성은 layout-inspector-width=clamp(260px,22vw,320px)이다. 1070px 이상 데스크톱에서 주요 캔버스는 작업 영역의 절반 이상을 유지하고 목록과 속성만 내부 스크롤한다. 새 화면이나 스키마는 추가하지 않는다.

도면 유형·치수 신뢰도는 캔버스에 한 번 표시하고 작업 제목 옆의 중복 도면 배지/내부 revision 숫자는 생략한다. 도면 기호·빗금 의미·조작 방법은 하단 ‘도면 기호·조작 안내’ 한 메뉴에서 확인한다. X/Escape/외부 클릭과 설명 연결은 유지한다. 그리기 단계의 즉시 안내와 저장/취소는 유지한다. 생성 화면의 미리보기 시점은 카메라 요약에서만 선택하고, 생성할 여러 시점은 기존 오른쪽 체크 목록에서 지정한다. 같은 위치로 이동하는 결과/생성 전 바로가기는 기존 4단계 내부 탭으로 모은다.

패널 r=12, 버튼/입력/탭 r=8, 이미지 r=4, 일반 테두리 1px, 선택 이미지 테두리 2px의 기존 규칙을 공유한다. 패널 그림자는 생략한다. 탭·표시 켜짐은 중립색을 사용하며, 현재 단계·물체/대상 선택·키보드 초점에는 기존 선택 토큰을 유지한다. 미선택 조명 기호는 다른 배치 기호와 같은 중립 선색이다. 새 색상·아이콘·글꼴을 추가하지 않는다.


## 서비스명·아이콘 정렬 · 2026-10-01

서비스명은 ReSpace · 전시·팝업 공간 디자인이다. 가로로 나란히 놓인 아이콘과 텍스트는 높이 기준 중앙 정렬을 공유한다. 제목·입력 라벨·위치 고정 라벨에도 기존 버튼과 같은 align-items:center와 간격 토큰을 적용한다. 아이콘이 글 위에 놓이는 도구 타일과 진행 표시는 기존 세로 배치를 유지한다. 색·크기·아이콘 자산은 변경하지 않는다.

## 펼치는 범례·고정 적용·2초 알림 · 2026-10-01 (이전 범례/알림 규칙보다 우선)

도면 하단은 너비 100%의 범례 열기 버튼 한 줄이다. 기호 목록은 위로 펼치는 격자이며 가로 스크롤을 만들지 않는다. X, Escape, 바깥 클릭으로 닫는다. 펼쳐도 도면 높이가 변하지 않는다. 레퍼런스 미리보기는 3열 최대 3행이고 과거 초과 자료는 옆의 native dialog에서 확인한다. 적용 설정/주요 CTA는 목록 스크롤과 독립된 패널 하단에 둔다.

TimedNotice는 성공·오류·삭제 복구 안내·드래그 안내에 공통 적용하고 실제 DOM을 2000ms 뒤 제거한다. 항상 기존 Nucleo X와 한국어 접근성 이름을 제공한다. 닫아도 undo/redo 및 검증 상태는 보존한다. 삭제/보존 결정 폼에는 별도 X 취소를 제공하고 자동으로 결정을 버리지 않는다. 새로운 색·폰트·아이콘 자산·그림자 토큰은 추가하지 않는다.

## 헤더의 진행 표시 · 2026-10-01 (최신 사용자 요청)

네 단계 진행 표시만 기존 상단 헤더로 옮긴다. 프로젝트 작업 화면에서 일반 자동 저장 문구와 프로젝트명·목록 바로가기 자리를 사용하며, 로고의 목록 이동과 사용 가이드는 유지한다. 저장 오류는 계속 알리고 목록 화면은 기존 헤더를 유지한다. 작업 제목·설명·이전/다음 버튼은 기존 제목 행에 둔다.

기존 Nucleo 단계 아이콘, 원, 한국어 단계명, 연결선과 선택 토큰을 유지한다. 현재 위치를 표시하며 확인하지 않은 과업에 완료 체크를 붙이지 않는다. 헤더 높이에 맞춰 기존 간격 토큰으로 여백만 줄인다. 낮은 작업 창에서는 기존 56px 헤더에 맞는 24px 원을 사용하고 버튼 조작 영역은 48px 이상을 유지한다. URL, 네 단계 그룹, 키보드 초점과 browser history 동작은 그대로다. 새 색·아이콘·컴포넌트 변형은 추가하지 않는다.

## 최종 도구·아이콘·시점 요약 · 2026-10-01 (우선 적용)

2단계의 요소 추가/구역 설정 탭을 제거한다. 고정 패널 헤더의 배치 요소 n/20 및 레퍼런스 n/8 카운터는 내부 목록 스크롤과 독립적이다. 헤더/패널/업로드/추가/수정/삭제/연결/회전/상태에 기존 NucleoIcon과 한국어 텍스트를 함께 사용한다. 도면 도구와 물체는 PlanSymbol/LayoutSymbol로 구분한다. 조명은 전구 윤곽으로 표시하고 이름은 올림/선택/속성에서 확인한다.

4단계는 생성 전 확인/결과 확인의 두 작업만 기본 노출한다. 시점 수정은 추천 요약의 secondary action이며 편집 URL에서만 방향·회전·화각을 보여 준다. 요약/결과 도면에는 위치만 표시한다. 검토 내용은 자체 패널에서 스크롤하며 다른 요소를 밀어내지 않는 기존 알림을 유지한다. 범례는 실제 표시 기호에 대응하는 한 줄이며 가로 스크롤로 나머지 항목을 확인한다. 신규 색/폰트/그림자 토큰은 추가하지 않는다.

## 레이아웃 우선 화면 규칙 · 2026-10-01

상단 헤더에 네 진행 단계만 사용한다: 공간·방향 설정 / 레이아웃 구성 / 레퍼런스 적용 / 시안 생성. 별도의 전역 왼쪽 단계 메뉴는 없다. 1단계는 자료/정보 2열, 2단계는 도구/큰 도면/선택 속성 3열, 3단계는 레퍼런스·매핑 현황 패널/도면 2열, 4단계 결과는 큰 이미지·이력/당시 조건 요약 2열이다. 시점/검토/결과는 4단계 내부 탭이다.

기존 보라색 선택·포커스 토큰과 중립 primary CTA를 모든 단계에 공통 적용한다. 추가 브랜드 색·그림자·아이콘 라이브러리는 도입하지 않는다. 구조는 건축 도면 기호, 전시대·테이블·의자·조명은 윗면 도형으로 구별한다. 이름은 마우스 올림·선택 때 표시하고 해당 유형은 작은 범례에 대응시킨다. 1070×671 이상의 데스크톱에서 도구·속성 패널만 내부 스크롤한다. 낮은 창에서는 캔버스 툴바를 줄이고 범례를 한 줄로 탐색할 수 있다. 기존 폰트·간격·반경·색 규칙은 유지한다.


> Updated 2026-09-28 from the current product/interaction contracts and four reference studies:
> Apple, Toss, Ohouse (오늘의집), and The Pinkfong Company.
>
> These reference systems are **principle sources, not token sources**. Do not copy their brand colors,
> fonts, logos, proprietary components, page compositions, or marketing treatment into this product.
> Product behavior remains governed by `PRODUCT.md` and `INTERACTIONS.md`.

## 0. Authority and design decision order

When visual references, old Figma screens, code, and product rules disagree, use this order:

1. Current `PRODUCT.md` and `INTERACTIONS.md` product invariants.
2. Current `DESIGN_SYSTEM.md` tokens, component contracts, and accessibility rules.
3. Current repository behavior when it does not conflict with 1–2.
4. Current Figma wireframes for layout proportions and information hierarchy.
5. `DESIGN_REFERENCE_SYNTHESIS.md` and external/reference design systems as inspiration only.

Do not change product behavior merely to imitate a reference service.

The product is a **spatial concept editing tool**, not a marketing page, dashboard showcase,
consumer-commerce clone, or research-themed wireframe.

---

## 1. Design premise

### 1.1 Core experience

The interface should feel like a **quiet white studio** around four kinds of evidence:

- existing-space photographs,
- the floor plan,
- reference/product imagery,
- generated or sample result imagery.

Those objects should carry the visual weight. UI chrome exists to help users understand,
select, place, validate, compare, and revise them.

### 1.2 Product character

Use these adjectives as a check when evaluating a screen:

- calm
- precise
- spatial
- editable
- trustworthy
- visually restrained
- image-forward
- explicit about state
- easy to recover from mistakes

Avoid:

- promotional hero sections
- ornamental dashboards
- gratuitous gradients
- large decorative illustrations
- emoji as functional UI
- decorative purple branding everywhere
- excessive shadows or glass effects
- nested cards for every row
- playful copy that makes constraints ambiguous

### 1.3 Reference-derived principles

The four reference studies inform the service in different ways:

**Apple → content primacy and agency**
- Keep controls visually restrained around content.
- Use one obvious primary action in a local task region.
- Make selection, state, reversibility, and consequences understandable.
- Do not spread translucent/glass treatment across content surfaces.

**Toss → state clarity and predictable controls**
- Every actionable component must have explicit default, hover, pressed, focus-visible,
  disabled, and loading behavior where relevant.
- Color is functional, not decorative.
- Copy should say what happens next in plain language.
- Do not merge mobile-product geometry into this desktop editor.

**Ohouse → image-led quietness**
- White canvas and dark neutral text support visual content.
- Do not wrap every image/list item in a heavy outer card.
- Let reference and result images appear visually generous.
- Use borders, spacing, and hierarchy before adding shadows.

**Pinkfong → brand/product boundary discipline**
- Brand identity art is separate from product controls.
- A recognizable accent or display asset from another brand is not a universal UI token.
- Keep our brand mark, Nucleo action icons, user images, and semantic UI colors conceptually separate.

---

## 2. Visual hierarchy

### 2.1 What must dominate

Priority from strongest to weakest:

1. active plan / active result / active reference image
2. selected element or camera and its editable condition
3. current-step title and primary task action
4. supporting lists and summaries
5. metadata, provenance, counts, helper copy

The canvas or active image must never be visually weaker than surrounding chrome.

### 2.2 Local primary action rule

A task region may expose **one filled near-black primary action**.

Examples:
- 다음 단계
- 조건 확인
- AI 이미지 생성
- 이미지 저장

A second action in the same region must be secondary/outlined, text-only, or destructive when
semantically required.

Do not use violet as the primary CTA fill.

### 2.3 Progressive disclosure

Keep the first view concise.

- Put current actionable conditions before full history or full Keep lists.
- Collapse long preservation lists behind a visible count with an explicit expand control.
- Show advanced coordinate/numeric controls as keyboard alternatives, not the main editor.
- Keep additional viewpoints optional after a valid first viewpoint.
- Do not hide required validation behind hover-only affordances.

---

## 3. Foundations

### 3.1 Color tokens

Project-owned values:

```css
:root {
  --neutral-white:#FFFFFF;
  --neutral-25:#FCFCFB;
  --neutral-50:#F7F8F6;
  --neutral-100:#F1F3EF;
  --neutral-200:#E4E7E1;
  --neutral-400:#A3ABB5;
  --neutral-600:#56616F;
  --neutral-900:#20251F;

  --lavender-50:#F5F2F7;
  --lavender-200:#D6CCDF;
  --lavender-300:#B6AAC2;
  --lavender-500:#80698F;
  --lavender-700:#63506F;
  --sage-50:#F0F3EB;
  --sage-200:#D4DDC8;
  --sage-300:#A6B38E;
  --sage-700:#526444;
  --violet-50:var(--lavender-50);
  --violet-200:var(--lavender-200);
  --violet-500:var(--lavender-500);
  --violet-700:var(--lavender-700);

  --green-50:var(--sage-50);
  --green-700:var(--sage-700);

  --red-50:#FAEFF1;
  --red-700:#A4505D;

  --blue-50:#EDF6FA;
  --blue-700:#3D7693;

  --surface-base:var(--neutral-white);
  --surface-subtle:var(--neutral-25);
  --surface-workspace:var(--neutral-50);
  --surface-hover:var(--neutral-50);
  --surface-pressed:var(--neutral-100);
  --surface-selected:var(--violet-50);

  --surface-glass:rgb(255 255 255 / 94%);
  --surface-glass-fallback:var(--neutral-white);

  --text-primary:var(--neutral-900);
  --text-secondary:var(--neutral-600);
  --text-tertiary:var(--neutral-400);
  --text-inverse:var(--neutral-white);

  --border-default:var(--neutral-200);
  --border-control:#87919C;
  --border-strong:var(--neutral-400);
  --border-selected:var(--violet-200);

  --action-primary:var(--neutral-900);
  --action-primary-text:var(--neutral-white);
  --action-selected:var(--violet-700);

  --state-keep-bg:var(--green-50);
  --state-keep-fg:var(--green-700);
  --state-error-bg:var(--red-50);
  --state-error-fg:var(--red-700);
  --state-info-bg:var(--blue-50);
  --state-info-fg:var(--blue-700);

  --canvas-structure:var(--neutral-600);
  --canvas-selection:var(--violet-500);

  --focus-ring:var(--violet-500);

  --space-4:4px;
  --space-8:8px;
  --space-12:12px;
  --space-16:16px;
  --space-20:20px;
  --space-24:24px;
  --space-32:32px;
  --space-40:40px;
  --space-48:48px;

  --radius-4:4px;
  --radius-8:8px;
  --radius-12:12px;
  --radius-16:16px;

  --control-height-32:32px;
  --control-height-40:40px;
  --control-height-44:44px;
  --control-height-48:48px;

  --shadow-panel:0 2px 12px rgb(23 25 29 / 4%);
  --shadow-float:0 12px 32px rgb(23 25 29 / 8%);
  --shadow-footer:0 -2px 12px rgb(23 25 29 / 4%);

  --glass-blur:blur(10px);

  --motion-fast:150ms;
  --motion-base:200ms;
  --motion-slow:220ms;
  --ease-standard:cubic-bezier(.2, 0, 0, 1);

  --font-ui:Paperlogy,"Noto Sans KR",system-ui,sans-serif;
}
```

### 3.2 Semantic usage

- **Near-black**: primary action, strongest text, camera body where appropriate.
- **Lavender** (existing violet aliases): selection, selected segment, selected outline, focus cue. Pale identity colors are not small text.
- **Sage** (existing green aliases): Keep/preservation and success. The brand mark may also use the pale identity swatch.
- **Red**: destructive, invalid, incompatible, blocking error.
- **Blue**: structural information such as existing window or neutral informational cue.
- **Neutral**: default surfaces, borders, hierarchy, secondary actions.

Never rely on color alone. Pair semantic color with text, icon, shape, border, or pattern.

### 3.3 User imagery vs UI colors

Do not tint, color-grade, blur, dim, or otherwise stylize user images merely to make them fit the UI.

Semantic UI colors must not be sampled from an uploaded photo or product image.

---

## 4. Surfaces, borders, and elevation

### 4.1 Panel hierarchy

**Outer panels**
- opaque white
- 1px `--border-default`
- 16px radius
- at most `--shadow-panel`

Examples:
- project/source panel
- floor-plan workspace shell
- inspector shell
- result-viewer shell

**Inner groups**
- flat by default
- no additional shadow
- use dividers, spacing, background contrast, or 1px borders

Examples:
- condition rows
- element list rows
- reference metadata rows
- form groups

Avoid more than **two visually nested framed levels**.

### 4.2 Glass treatment

Allowed only for transient or navigational chrome:

- header
- step navigation
- fixed footer
- detached canvas toolbar

Not allowed for:
- plan canvas itself
- existing-space image
- reference image
- result image
- inspector content
- form panel
- generation explanation

If `backdrop-filter` is unsupported or reduced transparency is requested:
- remove blur
- use opaque white
- preserve border separation
- preserve all labels and focus cues

### 4.3 Shadow policy

Use shadow to explain layer separation, not prestige.

- outer panel: optional `--shadow-panel`
- genuinely floating menu/popover: `--shadow-float`
- fixed footer if visually detached: `--shadow-footer`
- list row/card/input/button: no shadow by default
- selected state: border/fill/focus treatment, not lift animation

---

## 5. Typography

### 5.1 Font policy

Development and production:
- Use the same verified supplied web fonts and license notices described in `FONT_PROVENANCE.md`.
- Paperlogy 400 / 500 / 600 / 700 / 800 is self-hosted from public/fonts/paperlogy/.

Fallback only when the intended font is unavailable:
1. `Noto Sans KR`
2. `system-ui`
3. `sans-serif`

Do not invent a Paperlogy CDN URL.
The user authorizes including the verified supplied font files in production and handoff, with their license notices.

### 5.2 Type ramp

| Role | Size / line | Weight | Use |
|---|---:|---:|---|
| Page title | 22 / 32 | 700 | current step/page title |
| Large heading | 22 / 32 | 700 | rare large section title |
| Panel heading | 18 / 28 | 600–700 | editor/result panel titles |
| Body | 16 / 26 | 400 | explanatory content |
| Compact body | 14 / 22 | 400 | editor copy, rows |
| Label | 16 / 24 | 500 | controls, values, actions |
| Compact label | 12 / 18 | 500 | status/meta label |
| Caption | 12 / 18 | 400 | provenance, secondary metadata |

Rules:
- operational source names, condition values, editable values, and action labels: **>=14px**
- 12px only for secondary metadata/caption/status
- do not use oversized display typography in the editor
- do not use uppercase for Korean UI labels
- English technical tokens may appear in documentation, not normal visible UI

---

## 6. Iconography and brand assets

### 6.1 Brand mark

`public/brand/mark.svg` is the product brand mark.

2026-10-06 identity: an original R-shaped space frame with lavender/sage folded planes. The transparent mark replaces the previous dark tile. `mark-mono.svg` retains the same silhouette for monochrome use. The wordmark remains actual ReSpace text in the existing UI font with -.025em tracking; the Korean descriptor retains normal tracking. There is no new font or third-party logo asset. See `BRAND_IDENTITY.md` for geometry, colors and source boundaries.

Use:
- header identity
- favicon

Do not use it as:
- add/delete/edit icon
- Keep marker
- camera control
- status symbol

### 6.2 Nucleo-only functional icon rule

Use only the verified official free **Nucleo UI Essential Outline 18** assets listed in
`ICON_MANIFEST.md`.

Permitted approach:
- official free React component from `nucleo-ui-essential-outline-18@1.1.7`
- unchanged static SVG rendered from that component
- unchanged geometry/viewBox/currentColor

Forbidden:
- Lucide
- Heroicons
- Font Awesome
- emoji
- hand-drawn lookalikes
- premium Nucleo assets
- guessed Nucleo filenames
- hotlinked icon URLs

If there is no verified icon for the meaning, use a **text-only control**.

### 6.3 Icon button geometry

- hit target: 40×40 minimum
- visible icon: 18–24px
- aria-label required
- icon-only control only when meaning is familiar and verified
- unfamiliar actions pair icon + Korean text
- destructive icons require red semantic treatment plus an explicit label/context

---

## 7. Layout and responsive behavior

### 7.1 Desktop reference

Primary design viewport: **1440×900**

- header: 64px
- desktop step rail: 176px at the left, following the latest Figma v1.3
- horizontal main-content margin: 24px; header margin: 36px
- below 1200px, horizontal step navigation: 56px; below 768px preserve a 44px target
- canvas/editor: >=50% of main workspace width

### 7.2 Placement / Viewpoint workspace

Desktop:
- left list: 220–260px, responsive to available width after the step rail
- center plan: flexible, largest and >=50% of the editor region
- right inspector: 260–300px
- gutters: 16–20px
- left/right panels collapse independently
- canvas expands into released width

The same plan surface should remain visually stable between Placement and Viewpoint.
Only task-relevant layers and tools change.

### 7.3 Responsive

**>=1200px**
- three-column editor where applicable
- plan and active inspector visible together

**1000–1199px**
- horizontal step navigation
- retain adjacent editor panels with 220px list and 260px inspector; allow independent collapse

**768–999px**
- plan occupies full first workspace row
- list and inspector below
- do not squeeze canvas between fixed sidebars

**<768px**
- plan first
- list/inspector available by default after plan
- preserve browsing/review capability
- explicitly state that detailed floor-plan editing works best on desktop
- no hidden critical action behind hover

Do not use a generic plan pan mode for this 2D flow.

### 7.3.1 Bounded viewport and scroll ownership · user update 2026-09-28

- Application frame: `100vw`, `100vh` fallback / `100dvh`, `overflow:hidden`. The document never scrolls.
- Keep header, step navigation, task heading and task actions outside scrolling content. Give the task workspace the remaining height with `min-height:0`.
- At >=1000px, long catalogs, inspectors, review conditions and expanded result collections scroll inside their own panels. A short viewport may require scrolling within the plan panel; never compress controls into overlapping rows or clip their only access path.
- Below 1000px, stack the existing surfaces in a single vertically scrollable task workspace. This is an accessibility exception to the one-screen presentation: the document and mobile bottom actions remain fixed, and all inputs and text alternatives remain reachable.
- Project information and optional study controls open within the available frame without changing the plan's position. Reference notes, result history and approved collections are explicit disclosures, closed initially. Preserve all controls and keyboard access inside them.
- SVG fills a positioned plan surface without imposing an intrinsic height on its parent. Reference image previews retain aspect ratio; reserve the selection-status action row so a crop gesture cannot change its image bounds.
- Shared geometry tokens: minimum plan surface 280px outside the bounded desktop drawing editor; the drawing surface flexes to its available row without clipping behind utility disclosures, notification width 560px, study drawer maximum width 720px, drawing tools 240px. Overlay layers: notices 50, optional detail panels 40. Existing spacing, borders, colors and shadows apply; these tokens add no brand treatment.

### 7.4 Spacing rhythm

Use an 8px base rhythm.

Preferred:
4, 8, 12, 16, 20, 24, 32, 40, 48.

Avoid arbitrary 13/17/27px spacing unless required by an image ratio or exact geometry.

---

## 8. Image and media behavior

### 8.1 Existing-space photos

- visually generous
- active frame centered
- preserve aspect ratio
- bounded panel height on desktop
- show current/total count
- previous/next text controls
- pointer drag may navigate collection
- hide native horizontal scrollbar without removing keyboard access
- show a narrow neighbor preview only when a neighbor exists

### 8.2 Reference/product images

Reference image is evidence, not decoration.

- image gets the largest area in Reference step
- source name and role stay legible
- show selected crop/region explicitly
- atmosphere/product/element roles must be distinguishable by text, not color alone
- `object-fit: contain` by default
- do not crop unless user explicitly selected/cropped a region

### 8.3 Floor plan

- never distort aspect ratio
- plan remains visible while drawing/editing structures and areas
- provenance note stays near the plan
- uploaded, schematic, and prepared sample states are explicitly named
- do not visually imply that schematic geometry is measured

### 8.4 Result image

- ResultViewer gets the strongest image hierarchy on Results
- active result large
- current origin (`AI` / `sample`) explicit
- stale/approved/version states explicit
- result history appears after current result and current actionable conditions

---

## 9. Action component rules

### 9.1 PrimaryButton

- height: 40 or 44px
- radius: 12px
- background: `--action-primary`
- text: white
- one primary per local task region

States:
- default: near-black fill
- hover: subtle lightening using a project token/overlay; no lift shadow
- pressed: subtle darkening
- focus-visible: 2px violet focus ring + 2px offset
- disabled: neutral-100 fill + neutral-400 text, no pointer action
- loading: preserve button width and label context; block duplicate action

Do not invent another primary color.

### 9.2 SecondaryButton

- 40 or 44px
- white surface
- `--border-control`
- neutral label
- 12px radius

States:
- hover: `--surface-hover`
- pressed: `--surface-pressed`
- focus-visible: same focus ring
- disabled: muted border/text, explicit disabled semantics

### 9.3 DestructiveButton

- separate from primary
- red semantic border/text or restrained red fill when consequence is high and confirmed
- never use red for ordinary cancel/back

### 9.4 Text actions

Use for low-priority controls:
- 조건 편집
- 펼쳐보기
- 이전 이미지
- 다음 이미지
- 패널 숨기기

Do not style every text action as a pill.

---

## 10. Inputs, segmented controls, badges

### 10.1 Input / Select / Textarea

- 40–44px single-line height
- 12px radius
- visible `--border-control`
- label above or immediately associated
- helper/error text stays adjacent
- focus ring: violet 2px + offset
- read-only and disabled look different
- validation message names the problem and next safe action

### 10.2 Segmented control

Use for compact mutually exclusive local choices only.

- one visually selected segment
- selected: violet-50 + violet-200 border + violet-700 text
- default: white/neutral
- height 32–40px
- do not use for long navigation hierarchy

### 10.3 Status badge

Use only for descriptive state.

Examples:
- 적용됨
- 제외됨
- 배치 완료
- 충돌
- 필수 유지
- 이전 설정
- AI
- 샘플

- compact
- 4px radius or small capsule when text needs it
- not clickable unless explicitly a control with proper affordance
- color + text together

---

## 11. Editor-specific components

### 11.1 PlanSourceNote

Purpose:
- explain whether plan is uploaded / manually started schematic / prepared sample
- explain confidence/provenance

It must not:
- duplicate drawing tool actions
- claim photo-derived geometry
- dominate the workspace

### 11.2 KeepMarker

Visual contract:
- actual structure name + one verified lock icon for active preservation; no Keep numbering or preservation halo
- structural origin is separate from the user-controlled preservation lock
- selected fixed structure may highlight but must not show move handles
- no `grab` cursor for immutable structures
- selected explanation states what is and is not editable

Keep means preservation of the underlying structure, not an automatic exclusion zone around it.

### 11.3 ElementCard

Show:
- source
- element label
- element type
- allowed target
- apply/exclude state
- placement status
- concise condition summary

States:
- not placed
- placed
- conflict
- excluded

Rules:
- saved condition is read-only until explicit `조건 편집`
- Save/Cancel required for condition draft
- excluded elements do not appear in Placement list

### 11.4 PlacementInspector

Only show controls valid for the current element type.

Examples:
- floor furniture: floor position, rotation, footprint
- wall graphic: wall/span; no free-floor X/Y
- ambient light: whole-space/area scope; no point drag
- ceiling light: ceiling zone; no floor controls

Do not show a generic "target type" modal for every element.

### 11.5 PlanCanvas

The plan is a task surface, not a decorative diagram.

Layer behavior:
- Space/Keep: structure focus
- Placement: structure + usable floor + applied elements
- Viewpoint: structure + applied elements + cameras

Interaction:
- select/move mode separate from draw mode
- click-to-place uses normal pointer
- `grab/grabbing` only on movable objects
- crosshair only while drawing
- zoom + reset allowed
- generic pan mode not part of flow
- keyboard-selectable structures and semantic/numeric fallback
- direct hit target >=40 CSS px where practical after resize/zoom

Fixed structure focus must never imply movability.

### 11.6 Camera marker

- recognizable body
- separate labeled rotation handle
- body drag = position
- handle drag = heading
- empty floor click does not move camera
- invalid saved position stays visible with inspector reason
- camera hidden from Space/Keep/Placement

### 11.7 ConditionSummary

Order:
1. blocking issues
2. mandatory/optional preservation count
3. applied elements with source + target
4. excluded elements
5. selected camera
6. restrained intended-mood synthesis
7. expanded detail

The mood summary is a summary of user inputs, not an AI prediction.

### 11.8 GenerationPanel

Paid generation is visually separated from free sample preview.

Show before paid action:
- selected viewpoint
- chosen existing-space anchor photo
- image transfer summary
- one image per selected viewpoint with visible count
- one concise sentence: “선택한 시점마다 이미지 1장을 만듭니다. 시점 수만큼 생성 횟수가 차감됩니다.”
- transmitted inputs/result limitations in “사용 자료·결과 안내”; no per-image API price or provider pricing link
- service-wide daily and anonymous-browser daily quotas and plain-language busy/exhausted reason; no user key, code or invitation link
- structural-accuracy limitation

Primary action:
- when AI configured: near-black `AI 이미지 생성`
- when AI unavailable: free sample action may become the only primary

Name the readiness action “생성 가능 여부 확인”. It refreshes availability and remaining shared counts, never image progress. Show a disabled “확인 중…”/aria-busy state during refresh. Do not add a “비용 발생” suffix to the participant image action.

### 11.9 ResultViewer

- result image largest
- current conditions next to or directly below the image
- origin/version/approval/stale status explicit
- saved history visually distinct from new preview
- active item centered in galleries
- current/total + prev/next text controls + pointer drag
- keep keyboard navigation
- do not require multiple viewpoints to complete a project

---

## 12. Feedback and motion

### 12.1 Notice hierarchy

**Toast**
- noncritical info/success
- begins gradual fade after 3s
- manual close remains immediate
- not the sole source of an error explanation
- positioned absolutely in the main frame, above the lower utility/action area; never reserves layout space or covers title-adjacent step actions

**Inline alert / page alert**
- blocking validation
- save failure
- unknown paid-request outcome
- stays until dismissed or resolved
- global page alerts share the non-displacing overlay stack; local validation stays beside its input/canvas and can scroll inside its owning panel
- persistent deletion undo is independent of transient notices and also overlays the frame

**Modal**
- high-impact irreversible action only

### 12.2 Motion

Local project motion tokens:
- fast: 150ms
- standard: 200ms
- slow: 220ms
- standard easing: `cubic-bezier(.2,0,0,1)`

Use for:
- hover/focus/selected surface changes
- panel collapse
- compact inspector transitions

Do not animate:
- plan geometry in a way that changes apparent accuracy
- Keep conflicts as playful bounce/shake
- critical error disappearance
- user imagery with filters/zoom merely for decoration

Respect `prefers-reduced-motion`.

---

## 13. Content and Korean UI voice

All normal visible product UI is Korean.

### 13.1 Voice

- short
- direct
- task-based
- concrete
- non-promotional

Prefer:
- `곡선형 진열대를 배치할 바닥 영역을 선택하세요.`
- `이 벽은 기존 구조로 유지해야 합니다.`
- `현재 위치는 출입구와 겹쳐 배치할 수 없습니다.`
- `조건을 수정한 뒤 다시 생성할 수 있습니다.`

Avoid:
- `AI가 멋진 공간을 만들어드릴게요!`
- `완벽하게 반영했어요`
- `걱정하지 마세요`
- vague error codes without explanation

### 13.2 Action labels

Use verb + object when ambiguity exists.

Good:
- 사진 추가
- 도면 교체
- 조건 편집
- 배치 저장
- 시점 추가
- 이미지 생성
- 이미지 저장
- 결과 이력 보기

Avoid generic:
- 확인
- 계속
- 완료

unless the context already makes the result unmistakable.

### 13.3 AI/sample provenance language

Never say:
- `AI 생성 완료` for a preloaded sample
- `정확히 반영됨` without human verification
- `구조 보존 성공` based only on request submission

Use:
- `사전 제공 샘플`
- `AI 생성 결과`
- `직접 확인이 필요한 결과`
- `이전 조건으로 생성된 결과`

---

## 14. Accessibility

Target:
- body text contrast >= 4.5:1
- essential icons/control boundaries >= 3:1
- keyboard path for every essential task
- visible focus ring
- no color-only state
- no pointer-only interaction
- no focus traps
- no unexpected auto-scroll
- current step brought into view and new heading focused after step change

Plan:
- structure names visible/readable
- active wall gets text + stroke difference
- movable partition gets `이동 가능` before selection
- permanent structure gets no draggable styling
- canvas hit targets remain usable after resize/zoom

Respect:
- reduced motion
- reduced transparency
- forced colors

---

## 15. Page-level hierarchy

### Projects
- saved/sample projects + one clear new-project form
- not a KPI/dashboard homepage
- current project identity stronger than metadata

### Space
- existing-space photo and plan are separate evidence surfaces
- plan provenance visible
- plan drawing tools adjacent to plan
- current photo vertically centered in bounded panel

### Keep
- selected structure and allowed edits first
- linked photo/plan context
- long Keep/fixed-structure list after actionable information

### References
- selected source image largest
- source role/name visible
- crop/region selection visible
- extracted conditions right-side or adjacent
- apply/exclude clear without opening full edit form

### Placement
- left applied-item list
- center plan largest
- right typed inspector
- no camera
- side panels independently collapsible

### Viewpoint
- same large center plan
- camera list + inspector
- camera body and rotation handle distinct
- one primary camera required

### Review
- blocking issues first
- compact condition synthesis
- Keep details collapsible
- free sample and paid generation explicitly separate
- concise one-image-per-selected-view guidance and accessible data-use details before generation; API billing guidance remains in operator documentation

### Results
- current result image dominant
- actionable current conditions next
- approval/export
- history and approved collection after current result
- additional viewpoints optional

---

## 16. Codex / implementation rules

1. Use CSS variables from the design system. Do not scatter new hex values.
2. Reuse shared components before creating a page-specific variant.
3. New token/variant requires a documented reason.
4. Do not introduce another icon library.
5. Do not substitute a reference brand's font or action color.
6. Do not style user images for visual consistency.
7. Do not add a new card merely to separate content if spacing/divider can do the job.
8. Do not hide essential actions in hover-only affordances.
9. Do not use a filled violet primary CTA.
10. Do not duplicate one action in multiple toolbars.
11. Do not create a fake interactive control.
12. Make disabled/loading/focus states functional, not screenshot-only.
13. Validate layout at 1440, 1280, 768, and ~390px.
14. Validate keyboard focus and reduced-motion behavior.
15. Check that plan remains the largest editor object on Placement/Viewpoint.
16. Check that result/reference imagery remains visually primary.
17. Preserve product invariants from `PRODUCT.md` and `INTERACTIONS.md`.
18. Record meaningful visual-rule changes in `UX_SPEC_CHANGELOG.md`.

---

## 17. Design review checklist

Before accepting a screen, ask:

### Hierarchy
- Is the plan/reference/result more visually prominent than its controls?
- Is there only one local primary action?
- Can the user immediately identify the current selected object and state?

### Restraint
- Are there unnecessary shadows, cards, gradients, pills, or glass surfaces?
- Is violet being used for selection/focus rather than decoration?
- Could a border/divider/spacing solve the problem instead?

### State
- Are hover, pressed, focus-visible, disabled, loading, error, and selected states defined where needed?
- Is state communicated with more than color?

### Spatial semantics
- Does the inspector show only valid controls for the selected type?
- Does a fixed structure look fixed?
- Is the camera shown only in Viewpoint?
- Does Keep look like preservation rather than blanket no-go space?

### Provenance
- Are uploaded/schematic/sample plan states explicit?
- Are sample and AI results clearly separated?
- Is a result marked stale when relevant settings changed?

### Accessibility
- Can the same task be completed by keyboard?
- Is focus visible?
- Do reduced motion/transparency modes remain usable?
- Are all important labels at readable sizes?

If any answer fails, fix the system-level cause before adding page-specific polish.


## 18. Verified Figma v1.3 alignment and current-contract reconciliation · 2026-09-28

The public Figma file was opened in an isolated browser. Its latest active section is
`AI Reference Interpreter · 사용자 중심 와이어프레임 · v1.3` (node `125:2`);
`v1.0 archive` and `v1.2 archive` are explicitly historical. The current guide is
`ARI · Design System / v1.2`. The supplied MD pack is the detailed visual contract.

- Follow the v1.3 left step rail on desktop; use horizontal navigation at tablet/mobile widths.
- Task names are 공간 준비, 유지할 요소, 참고 이미지, 배치, 시점, 생성 전 확인, 시안.
  Existing route keys and stored schemas remain unchanged. Keep and Reference remain domain concepts.
- Put the next task action next to the page title on desktop. The same controls form the mobile
  bottom action bar; do not duplicate them in a second toolbar. Retain accessible previous navigation.
- The opt-in experiment disclosure follows the task workspace, so it does not push the plan down.
  It stays available before starting a trial; data collection never begins without consent.
- Source notes are concise with an explicit provenance disclosure. Selection help follows the plan;
  current drawing tools, errors and gestures remain adjacent and visible.
- No silent re-locking, Keep numbering, participant credentials, extra product features or research
  comparison UI may be introduced from older visual examples. The current PRODUCT/INTERACTIONS
  lock, no-forced-tab, routing, logging and shared-quota contracts take precedence.
- New layout tokens (`--layout-nav-width`, editor side widths, header height) describe the measured
  Figma hierarchy. Hover/pressed/disabled/loading states share semantic tokens and motion values.
- Long operational source/condition/target names remain >=14px, wrap rather than clip, and selected
  rows use a border/stroke plus accessible state. Source imagery is not tinted or stylized.

Source: https://www.figma.com/design/J2ZHftzWmLR7OQhpyMFJQA/?node-id=125-2
Implementation and verification record: [QA_DESIGN_UPDATE_20260928.md](QA_DESIGN_UPDATE_20260928.md).

### Implemented state and layout aliases

`--surface-hover` = neutral-50; `--surface-pressed` = neutral-100; `--text-tertiary` = neutral-400;
`--focus-ring` = violet-500. Primary hover mixes neutral-900 with 12% white; pressed mixes it with
20% black. Motion is 150/200/220ms with one standard easing. These are derived states of existing
colors, not additional brand accents. `danger-quiet` is a text-only deletion variant using the
existing error foreground/background, so recoverable deletion does not compete with the next task.

Desktop header/rail: 64/176px. Applied list: clamp(220px,17vw,260px); inspector:
clamp(260px,20vw,300px); reference list: clamp(200px,16vw,240px). Keep uses a full-size plan
plus a 340px selected-object inspector; its photo is an unframed inner group. Review uses a concise
condition brief and a 400px generation inspector. Tablet and phone stack the relevant surfaces.
Camera position inputs and the full review condition list are explicit disclosures; preserve all
validators and recovery actions. Camera marker/handle text renders at 14 CSS pixels independently
of plan zoom; body movement and rotation hits remain separate.

Figma's current guide also lists Recraft, Krea, Adobe Firefly, Figma and Planner 5D interaction
patterns. Apply the task-local edit/export controls, progressive controls, shared canvas and direct
manipulation principles only. Do not import their branding, accounts or extra 2D/3D/CAD features.

## 2026-09-29 작업 제어 보완
새 브랜드 색·폰트·아이콘 라이브러리는 추가하지 않는다. 기존 semantic tokens로 카메라(공식 카메라 아이콘), 바닥 진열대(평면 footprint), 진열 상품(작은 둥근 사각 marker)을 구분하고 목록에는 실제 유형을 표시한다. 실제 구조 이름과 잠금 버튼은 별도 40px hit target으로 배치하며 촘촘한 이름표를 화면 픽셀 기준으로 정리한다. 수용하지 못한 이름표는 구조 목록으로 안내해 실제 도형을 가리지 않는다.

참고 이미지 오른쪽 제목은 패널 내부 sticky, 선택 요소는 맨 위에 둔다. 요소 추가 폼은 명시적 펼치기로 빈 공간을 줄인다. 활성 단계 번호 대신 기존 manifest 아이콘을 사용하되 한국어 단계명은 유지한다. 스크롤 track은 투명하고 thumb는 기존 border token, hover는 text-secondary를 사용한다. 스크롤 affordance를 숨기지 않고 강제 애니메이션을 넣지 않아 reduced motion을 존중한다.

새 도면 대응 안내는 40px summary와 기존 popover 계층의 overlaid content로 구성한다. 그리기 도구는 독립 내부 스크롤, 캔버스는 남은 높이를 사용한다. 충돌 알림/배치 경고는 canvas/workspace의 absolute overlay로 렌더링하여 좌표 변환과 도형 크기를 바꾸지 않는다. 생성할 시점은 fieldset/checkbox의 기존 component states를 사용하고 `n / total · 시점명 생성 중`은 실제 요청 순서 안내이며 가상의 모델 진행률이 아니다.

그리기 중에는 중복 패널 제목·업로드 안내를 접고 좌표 대체 입력/영역 관리를 왼쪽 도구 패널의 내부 스크롤에 둔다. 오른쪽은 캔버스와 명시적 그리기 종료만 사용한다. 저장·제스처 안내도 캔버스 안 absolute status로 렌더링하며 클릭을 가로채지 않는다. 업로드와 사진은 그리기 종료 후 원래 위치에서 사용할 수 있다.

## 영역 표시와 적용 범위 선택 컴포넌트 · 2026-09-29
AreaTargetPicker는 기존 field/select/quiet button과 문장형 검증을 재사용한다. 선택 범위는 실제 영역 이름+종류로 표시하며 UI에 데이터 ID나 좌표를 먼저 노출하지 않는다. 바닥 점 배치와 선택적 바닥 영역 배치를 구분한다. 요소 카드 제목은 40px 이상 선택 버튼이고 pressed/focus 상태를 갖는다.
PlanAreaControls는 기존 240px 도구 폭, 8/12/16px 간격, radius-4/8/12, surface-base/selected, border-control/default/selected, shadow-float와 popover 레이어를 사용한다. 설정은 45dvh 이하 내부 스크롤과 투명 트랙을 갖고 화면 안으로 위치를 보정한다. portal의 fixed 표시가 부모 패널에 잘리거나 캔버스를 밀지 않도록 한다. 새 색/폰트/아이콘 자산은 추가하지 않는다.
도면의 비선택 영역은 채움 없이 서로 다른 선 패턴, 선택 영역은 기존 선택색 경계+옅은 채움, 선택 이외 영역은 낮은 불투명도로 표시한다. 이름표는 기존 14px/40px 화면 픽셀 규칙과 충돌 회피 배치를 사용한다. 선택 영역·구조 이름을 추가 이름표보다 먼저 배치한다. 여유가 없는 이름은 전체 목록으로 읽는다. 선택하지 않은 공간 연출 조건의 큰 중복 윤곽과 번호는 숨기되 실제 진열대 등 물리적 요소는 유지한다.
짧은 데스크톱(800px 이하 높이)·좁은 화면(1000px 미만)은 공간 준비 작업 영역 자체를 스크롤 주체로 사용하고 기존 캔버스 최소 높이 280px를 유지한다. 100dvh 프레임·바깥 overflow:hidden 계약은 유지한다.

## 이동 제약 표기 변형 · 2026-09-29
PlanMovementOverlay는 기존 canvas-structure와 state-info-fg로 바닥/물체 점유의 점선 윤곽과 동선/여닫이의 빗금을 구분한다. 색에 더해 선/면 패턴·실제 이름·연결선으로 뜻을 전한다. 제한 범위는 pointer-events none으로 편집 제스처를 가로채지 않는다. 읽기 전용 이름에 이동/클릭 커서를 주지 않는다. 드래그 불가 윤곽/피드백에는 기존 state-error 토큰을 재사용한다. 일시 피드백은 기존 space/radius 토큰으로 도면에 겹치고, 상시 설명은 도형 밖에 둔다. 새 브랜드 색·아이콘·폰트·장식 패널 토큰을 추가하지 않는다.

이름표 배치는 동선/여닫이/물체 점유/기둥/카메라의 실제 표시 범위를 고정 장애 영역으로 예약하여 그 위를 덮지 않는다. 이동된 이름에는 연결선을 남긴다. 접힘 안내는 상시 설명으로 렌더링하여 이름표 수가 바뀔 때 캔버스 높이가 바뀌지 않는다.

## 도면 선·이름표 정리 · 2026-09-29
`--canvas-wall`은 기존 `--neutral-900`의 의미 별칭이다. 새 색상은 추가하지 않는다. 벽은 진한 실선, 기둥/진열대는 조용한 윤곽, 보존은 기존 공식 Nucleo 잠금으로 구분한다. 이름표의 시각 면은 28px, 선택 조작 영역/잠금은 기존 40px를 유지한다. 이동 제한 빗금/윤곽은 유지하되 중복 물체 외곽을 줄인다. 물체 이름은 24px 읽기 전용 이름표로 표시하며 겹침을 피한다. 단일 카메라 도면 가이드는 같은 의미 토큰과 기존 공식 카메라 SVG를 사용한다. 결과 비교는 기존 disclosure 패턴으로 구현하며 새 장식 카드/브랜드 요소를 추가하지 않는다.

## 클릭 초점과 사용 가이드 · 2026-09-29
마우스로 버튼·캔버스·SVG 요소를 클릭했을 때 브라우저의 검은 기본 outline은 표시하지 않는다. `:focus:not(:focus-visible)`에만 적용한다. 키보드 이동의 `:focus-visible`은 기존 focus-ring 토큰을 유지하고, 입력 중인 텍스트·숫자·textarea는 기존 편집 포커스를 유지한다. 강제 색상 모드에서도 키보드 초점이 보여야 한다. 파일 선택 라벨의 테두리도 내부 input의 focus-visible에만 연동한다.
상단 ‘사용 가이드’는 기존 quiet button 스타일의 링크로 새 탭을 연다. 모바일에서도 로고와 가이드가 잘리지 않게 간격과 프로젝트 제목 너비를 제한한다. 안내 페이지는 문서를 읽는 별도 페이지이므로 세로 스크롤을 허용하되 작업 앱의 100dvh 프레임은 유지한다. 가이드에는 기존 의미 색상·간격·표·강조 규칙을 적용하고 새 브랜드 토큰을 만들지 않는다.
