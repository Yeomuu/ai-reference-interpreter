# ReSpace 서비스 디자인 v1.4 · 2026-10-07

파일 `J2ZHftzWmLR7OQhpyMFJQA` / 페이지 `80:2` 이미지 생성 서비스.

[최신 디자인 섹션](https://www.figma.com/design/J2ZHftzWmLR7OQhpyMFJQA?node-id=216-262) / [디자인 가이드](https://www.figma.com/design/J2ZHftzWmLR7OQhpyMFJQA?node-id=219-1462).

| 화면 | 노드 |
|---|---|
| 홈 | 216:263 |
| 01 사진 / 평면도 | 216:315 / 216:457 |
| 02 레이아웃 | 219:477 |
| 03 레퍼런스 | 219:792 |
| 04 생성 전 / 결과 구성 예시 | 219:994 / 219:1243 |
| 가이드 v1.4 | 219:1462 |

원본 175:272, 173:118, 182:882 및 사진 boolean 180:549를 보존했다. 결과 구성 이미지는 참고 사진이며 실제 AI 실행 결과로 표시하지 않는다.

## 변수·스타일·컴포넌트

- Primitive `110:2` → Semantic `110:21`, Dimension `110:43`, Typography `208:270`. 기존 텍스트 스타일 ID를 유지하고 큰 제목 스타일을 보완했다.
- 웹 UI Wanted Sans Variable / 브랜드 Adobe timeline-210; Figma는 사용자 승인 기본 Noto Sans KR.
- 기존 Progress `164:702`, SourceTabs `181:602`, ReferenceThumbnail `182:1063` ID 유지. Progress 아이콘은 기존 공식 무료 Nucleo를 재사용한다.
- Button `213:412`: primary/secondary/quiet × default/hover/disabled 및 TEXT property. Input `213:426`: default/preset/focus/error 및 TEXT property.
- BrandWordmark `214:262`, BrandMark `222:1198`: 원본 브랜드 벡터.
- PlanPreview `215:262` / `215:326` / `215:418`: 실제 앱 2D 도면의 네이티브 벡터. 명시적 빗금 경로로 출입 여유·동선을 구분한다.
- LayoutSymbol 6종, NucleoIcon 14종을 자체 컴포넌트로 구성했다. UI/가구/건축 기호를 구분한다.
- 사진 `229:1375`: 원본 SUBTRACT boolean 재사용. radius/space-photo `229:1379`=14.4.
- action/primary-hover `231:1375`: 웹과 같은 primary+white12% 계산 값.

텍스트·입력·버튼·아이콘·도면은 편집 가능한 네이티브 레이어/인스턴스다. 사진·레퍼런스·홈 독립 일러스트만 이미지다. 라이브러리를 외부 publish했다고 주장하지 않는다. 최종 7개 화면과 가이드의 missingFont=0을 확인했다.

## 코드

WelcomeScreen, SpaceDirection, SwipeCarousel, respace.css/tokens.css, studyConfig/studyStart 및 기존 App/보존/저장/생성 계약을 업데이트했다. 사진은 단일 외곽 path로 표시만 자르고 원본 파일을 유지한다. 자동 측량·3D/CAD를 추가하지 않았다. 검증은 QA_DESIGN_20261007.md 참조.
