# Nucleo 무료 아이콘 목록

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
