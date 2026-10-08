# Nucleo 무료 아이콘 목록

## 사용자 최신 Figma 진행 아이콘 · 2026-10-08

사용자가 직접 바꾼 Progress 164:702의 원본을 읽기 전용 asset GET으로 복사했다. Figma 편집/clone/export 쓰기를 하지 않는다. 이 원본 반영은 아래 이전 step-file/layers/images 사용을 대체한다. 새 일반 UI 라이브러리를 추가하거나 사용자 도형을 공식 Nucleo라고 주장하지 않는다. image는 기존 공식 Nucleo 컴포넌트 원본이며 나머지는 사용자 지정 Figma Group이다. 원래 path·stroke·색·SVG 바이트는 그대로 두고 원본 Group inset만 CSS로 배치한다. 세부 노드·해시는 FIGMA_PROGRESS_ASSETS_20261008.json.

| 원본 노드 | 실제 자산 → 의미 | 사용 |
|---|---|---|
| 275:2141 / 2047 | space-current/before.svg → WorkflowStepIcon.space | 공간 단계 현재/이전 |
| 275:1979 / 2036 / 1968 | layout-upcoming/current/before.svg → WorkflowStepIcon.layout | 레이아웃 단계 세 상태 |
| 275:2199 / 2281 / 2298 | reference-upcoming/current/before.svg → WorkflowStepIcon.reference | 레퍼런스 단계 세 상태 |
| I222:1283;213:362 / I222:1343;213:362 | image-upcoming/current.svg → WorkflowStepIcon.image | 시안 단계 예정/현재 |

로컬 디렉터리는 public/figma/progress/. 일반 조작에 쓰는 public/icons/nucleo/와 그 라이선스는 유지한다.

2026-10-01 화면 정리: 기존 Camera를 전체 배치 포함 모든 시점 요약에 사용한다. Xmark는 일시 알림·범례·전체 이미지 목록·확인 폼의 닫기, CircleInfo/Plus/Minus는 범례 열기 상태, Pen3는 같은 탭의 연결 내용 수정에 재사용한다. 새 SVG·외부 아이콘 라이브러리는 추가하지 않았다. PlanSymbol/LayoutSymbol은 그대로 유지한다.

2026-09-30 예외: 사용자가 잠금 해제 상태용 SVG 원본을 직접 제공했다. `public/icons/user-provided/open-lock.svg`는 그 원본을 그대로 저장한 자산이며 Nucleo 아이콘으로 표시하거나 이 목록의 무료 패키지에 포함됐다고 주장하지 않는다. 잠긴 상태는 아래의 공식 Nucleo 아이콘을 계속 사용한다.

상태: **Nucleo UI Essential Outline 18의 무료 배포 패키지에서 확인한 23개 SVG 사용 가능** (2026-09-25 확인). 앱에서 사용하는 아이콘은 이 목록의 파일만 사용할 수 있다. 이 목록에 없는 의미에는 텍스트 컨트롤을 쓴다.

## 공식 출처와 파일 확인

- [Nucleo 무료 아이콘 목록](https://nucleoapp.com/free-icons)은 **Nucleo UI Essential**을 무료 세트로 명시하고, [세트 소개](https://nucleoapp.com/free-ui-icons)는 Outline 및 Fill SVG 제공을 명시한다.
- [Nucleo의 React 패키지 안내](https://nucleoapp.com/react-packages)는 `nucleo-ui-essential-outline-18`을 구매 전 사용할 수 있는 무료 Essential 패키지로 명시한다. 아래 아이콘은 Nucleo가 배포한 `nucleo-ui-essential-outline-18@1.1.7` npm tarball의 실제 `dist/components/*.js`를 확인해 선별했다. 배포 패키지의 작성자는 `Nucleo`이고 README가 [Nucleo Icons License](https://nucleoapp.com/license)를 가리킨다.
- 해당 npm 패키지에는 독립된 `.svg` 파일이 없다. 따라서 아래의 `*.svg` 파일은 명시한 **공식 컴포넌트를 React `renderToStaticMarkup`으로 그대로 렌더링한 결과**이다. SVG의 경로·도형·색상·viewBox를 새로 그리거나 바꾸지 않았다. 파일명은 실제 공식 **컴포넌트 이름**을 사용한 로컬 SVG 파일명이며, 존재하지 않는 원본 SVG 파일명을 주장하지 않는다.
- 패키지 버전은 `1.1.7`, npm tarball SHA-1은 `1a6f7b5965bb1687ba8a1b1dde73b4828222c802`이다. 모든 선택 파일은 18×18 `viewBox`와 `currentColor`를 가진 정적 SVG이다. 외부 네트워크 URL, 스크립트 및 임의 아이콘 라이브러리를 사용하지 않는다.

## 사용 조건과 고지

- 공식 패키지 README가 연결한 [라이선스](https://nucleoapp.com/license)는 제품 UI 사용을 허용하며, 템플릿·플러그인·오픈소스 프로젝트에는 100개 이하와 저작권 고지를 요구한다. 현재 선별된 아이콘은 23개다. 별도 아이콘 세트로 재배포하지 않는다.
- 공식 [Copyright Notice](https://nucleoapp.com/copyright-notice)에 따라 `public/icons/nucleo/COPYRIGHT_NOTICE.txt`를 함께 둔다. 제품과 함께 제공되는 아이콘 사용 범위를 벗어난 재배포에는 별도 확인이 필요하다.
- [Nucleo AI Integration](https://nucleoapp.com/ai-integration)의 계정 없는 `--free` 설치 목록은 glass, arcade, isometric, flags, cursors, social-media, credit-cards로 적혀 있으며 UI Essential은 포함되어 있지 않다. 이 작업은 MCP가 UI Essential에 접근한다고 가정하지 않고 공식 무료 npm 패키지를 사용했다.

## 공식 모듈 → 로컬 SVG → 허용된 용도

| 공식 패키지의 실제 모듈 파일 | 로컬 SVG 파일 | 의미·허용된 사용처 |
|---|---|---|
| `IconCameraOutline18.js` | `IconCameraOutline18.svg` | 평면도 시점의 카메라 본체 |
| `IconCamera2Outline18.js` | `IconCamera2Outline18.svg` | 추가 카메라/시점 목록 |
| `IconArrowDottedRotateAnticlockwiseOutline18.js` | `IconArrowDottedRotateAnticlockwiseOutline18.svg` | 명시적 회전 손잡이 또는 회전 안내 |
| `IconRotation360Outline18.js` | `IconRotation360Outline18.svg` | 시점 방향·회전 |
| `IconChevronLeftOutline18.js` | `IconChevronLeftOutline18.svg` | 이전 이미지·이전 카드 |
| `IconChevronRightOutline18.js` | `IconChevronRightOutline18.svg` | 다음 이미지·다음 카드 |
| `IconPlusOutline18.js` | `IconPlusOutline18.svg` | 추가 |
| `IconXmarkOutline18.js` | `IconXmarkOutline18.svg` | 닫기 |
| `IconCheckOutline18.js` | `IconCheckOutline18.svg` | 확인·완료 |
| `IconCircleInfoOutline18.js` | `IconCircleInfoOutline18.svg` | 정보 |
| `IconTriangleWarningOutline18.js` | `IconTriangleWarningOutline18.svg` | 경고·검증 오류 |
| `IconImageOutline18.js` | `IconImageOutline18.svg` | 단일 이미지 |
| `IconImages2Outline18.js` | `IconImages2Outline18.svg` | 여러 이미지·사진 목록 |
| `IconLayers3Outline18.js` | `IconLayers3Outline18.svg` | 도면 레이어 |
| `IconEyeOpenOutline18.js` | `IconEyeOpenOutline18.svg` | 레이어 보이기 |
| `IconEyeClosedOutline18.js` | `IconEyeClosedOutline18.svg` | 레이어 숨기기 |
| `IconLockOutline18.js` | `IconLockOutline18.svg` | 고정 구조/필수 Keep. 도면·사진의 실제 구조 이름 한쪽에 표시하는 잠금 배지 및 필수 보존 켜기/끄기 버튼 (번호·‘보존’ 배지 대체) |
| `IconTrashOutline18.js` | `IconTrashOutline18.svg` | 삭제 |
| `IconRefresh2Outline18.js` | `IconRefresh2Outline18.svg` | 새로고침·다시 시도 |
| `IconPen3Outline18.js` | `IconPen3Outline18.svg` | 조건 편집 |
| `IconSitemap4Outline18.js` | `IconSitemap4Outline18.svg` | 구조 관계·도면 구조 표시 |
| `IconFileOutline18.js` | `IconFileOutline18.svg` | 파일/도면 자료 |
| `IconMinusOutline18.js` | `IconMinusOutline18.svg` | 축소·제거. 축소 버튼에는 텍스트도 함께 표시 |

사용자 제어에서 뜻이 모호한 아이콘은 단독으로 두지 않고 한국어 텍스트와 함께 쓴다. 이 세트에서 **업로드, 다운로드, 저장, 확대**에 맞는 정확한 아이콘 파일을 검증하지 못했으므로 해당 컨트롤은 텍스트만 사용한다.

## 2026-09-29 재사용
활성 작업 단계는 기존 `file`(공간 준비), `lock`(유지), `image`(참고), `layers`(배치), `camera`(시점), `check`(확인), `images`(시안)를 한국어 이름 옆에 표시한다. 카메라 삭제는 기존 `trash`를 재사용한다. 실행 취소·다시 실행은 검증한 전용 아이콘이 없어 텍스트 버튼을 사용한다. 도형 footprint와 상품 marker는 계획 데이터 표시이며 대체 아이콘 라이브러리가 아니다. 새 SVG 자산은 추가하지 않았다.

## 이동 제약 원인 표기 · 2026-09-29
기존 `IconCameraOutline18.svg`는 기둥/가벽 편집 시 기존 시점 위치를 알려주는 읽기 전용 marker에도 재사용한다. 이동/회전/시야 cone은 시점 편집에서만 제공한다. 동선 빗금과 점유 윤곽은 실제 계획 데이터의 도형 표시이며 새 아이콘 자산이 아니다.

2026-09-29: 기존 `IconCameraOutline18.svg`를 저장 배치 가이드의 단일 시점 표시에 재사용한다. HTMLImageElement로 로컬 SVG를 JPEG 도면에 렌더링하며 원본 아이콘 경로/자산은 수정하지 않는다.

## 최종 UI semantic 연결 · 2026-10-01

기존 공식 SVG를 재사용하며 새 파일/아이콘 라이브러리를 추가하지 않았다.

| 공식 컴포넌트 → 로컬 SVG | semantic | 적용 |
|---|---|---|
| IconRotation360Outline18.js → IconRotation360Outline18.svg | NucleoIcon.rotate | 속성 회전 |
| IconSitemap4Outline18.js → IconSitemap4Outline18.svg | NucleoIcon.structure | 매핑 현황 |
| IconMinusOutline18.js → IconMinusOutline18.svg | NucleoIcon.minus | 연결 해제 |

그 외 기존 image/images/file/layers/camera/edit/add/trash/lock/check/info/warning/refresh/previous/next를 제목·업로드·도구·요약·생성·수정에 확대한다. 전시대/가구/전구는 LayoutSymbol, 벽/문/창/기둥 도구는 PlanSymbol의 실제 기하 표현이며 UI 아이콘으로 대체하지 않는다. 정확한 Save/Undo/Redo/Crop용 자산은 현재 확보 목록에 없어 저장/실행 취소/다시 실행은 텍스트를 유지하고 영역 선택에는 편집 의미의 edit를 텍스트와 함께 사용한다.

## 사용자 지정 Figma 원본 자산 · 2026-10-08

사용자가 SVG 그대로 재사용하도록 명시한 원본 디자인 자산이다. 새 UI 아이콘 라이브러리나 새 Nucleo 팩을 추가한 것이 아니다. 기존 일반 액션 NucleoIcon의 라이선스/명세와 실제 도면 LayoutSymbol/PlanSymbol은 유지한다. 전체 28개 파일의 원본 노드·intrinsic 크기·SHA256은 [FIGMA_SOURCE_ASSETS_20261008.json](FIGMA_SOURCE_ASSETS_20261008.json) 참조.

| 원본 노드 | 로컬 파일 / 의미 | 적용 |
|---|---|---|
| 188:1176 / 1190 / 1203 / 1216 / 1242 | structure-front/back/window/entrance-wall/entrance.svg | STEP 01 기본 구조 목록, 도면 geometry 자체는 아님 |
| 188:1117 | image-upload.svg | 원본 분위기 upload |
| 181:575 / 605 / 595 / 610 | tab-photo/photo-inactive/plan/plan-active.svg | 사진·평면도 전환 |
| 175:505 / 512 / 525 / 530 | corner-left/right, center-top/bottom.svg | 원본 작업 경계 marker |
| 182:1065 / 1059 / 1069 | thumbnail-delete.svg, thumbnail-default/hover-mask.svg | 원본 썸네일 상태·삭제 |
| 213:346 / 350 / 355 / 361 | step-file/layers/images/image.svg | 헤더 네 단계 |
| 173:201 / 175:276 / 443 | guide-info/home-info/experiment-record.svg | 원본 도움말·홈 안내·기록 |
| 181:557 / 554 | photo-previous/next.svg | 원본 사진 순서 |
| 175:232 / 242:1383 | home-grid/glow.svg | 원본 홈 배경 |

원본 노드만 투명 SVG로 내보냈다. 썸네일 마스크에만 흰 fill을 사용하며 원본 Boolean 곡률/geometry는 유지한다. 원본 프레임은 수정하지 않았으며 SVG를 다시 그리거나 경로/색을 치환하지 않았다.
