# ReSpace — 사용자 승인 글자 크기·배포 폰트·패널 이동 검증

2026-10-08. 기존 Figma 디자인 복구 이후 사용자가 폰트 파일 배포 금지를 철회하고 웹 가독성 기준의 크기 조정을 승인했다. 추가로 이후 단계도 Step 1처럼 사이드 패널 안에 이동 버튼을 두도록 요청했다. Figma는 이번 후속 작업에서 호출·편집하지 않았다.

## 실제 글자 크기

| 요소 | 변경 전 | 최종 브라우저 값 |
|---|---|---|
| 진행 단계명 | Paperlogy 22px / 500 / 26px | Paperlogy 18px / 500 / 24px |
| Step 1 섹션·사진/평면도 탭·사진 제목 | 20px | 18px / 24px, 기존 family·weight 유지 |
| 이전·다음 | 20px | 18px, 버튼 높이 44px 유지 |
| 분위기 작은 안내 | 10px / 12px | 12px / 18px |
| 일반 본문·일반 입력·버튼 | 14px | 16px, 별도 보조/compact 역할은 14px 유지 |
| 디자인 목표 입력 | 14px / 17px | 16px / 24px |
| 소제목·도구 카테고리 | 14px | 18px / 24px |
| 페이지 제목 | 24–28px | 22px / 32px |
| 홈 폼 제목 | 24px | 22px, 입력 18px 유지 |
| 홈 시작 버튼 | 28px | 22px, 541×80 외곽 유지 |
| 홈 브랜드·큰 소개 | 34 / 48px | 32 / 46px, identity 역할에서 각각 2px만 축소 |
| 사진 순서·구조 이름·기존 본문 | 16–18px | 적절한 기존 값 유지 |

캡션 12px, 보조 14px, 본문 16px, 섹션/진행 18px, 제목 20–22px를 공통 토큰으로 사용한다. 홈의 큰 소개 문구와 wordmark는 전용 display 역할을 유지하므로 일반 제목 22px까지 축소하지 않았다. 새 브랜드 스타일이나 아이콘을 도입하지 않았다.

## 폰트 배포

- 검증된 제공 Paperlogy 400/500/600/700/800 5종 총 6,546,240bytes를 public/fonts/paperlogy/에 그대로 복사했다. 원본·글리프·굵기·내부 family를 변환하지 않는다.
- 기존 SHA-256 대조, 사본/public/dist/HTTP 응답 일치, OFL 고지의 빌드 포함을 확인했다. 경로·해시: FONT_ASSETS_20261008.json.
- .gitignore의 Paperlogy/를 /Paperlogy/로 제한하여 원본 폴더만 제외한다. Windows의 대소문자 무시 설정에서도 public/fonts/paperlogy/ 사본이 버전 관리와 향후 배포에 포함될 수 있음을 git status/check-ignore로 확인했다.
- 개발 전용 link를 제거하고 개발·production 모두 public/fonts/fonts.css를 사용한다. Wanted Sans 및 제공 임시 fallback도 기존 배포 자산을 유지한다.
- CDP CSS.getPlatformFontsForNode로 실제 글자에 사용된 Paperlogy(progress/photo), Wanted Sans(body), Noto(tabs)를 확인했다. 5개 Paperlogy face 모두 실제 decoded/loaded이며 개발·production glyph family와 PostScript 이름이 같다. 단순 CSS family 선언만으로 로딩되었다고 판단하지 않았다.
- Adobe 브랜드/Google Noto는 기존 공식 공급 방식이다. 네트워크나 해당 공급 설정에 따른 fallback은 남는다. 사용자 제공 Memoment에 대해 별도 무료 배포 라이선스를 검증했다고 주장하지 않는다.

## 이동 버튼

- 기존 외부 하단 행을 각 사이드 패널 안으로 옮겼다. 콘텐츠 스크롤과 footer를 분리한다. Step 1의 기존 footer는 유지한다.
- Step 2: 선택 요소 설정 패널. Step 3: 오른쪽 레퍼런스 패널. Step 4: 조건 확인 / 카메라 속성 / 결과 조건 기록 패널.
- Step 3은 기존 2열과 패널 폭을 유지하면서 도면을 왼쪽, 레퍼런스를 오른쪽으로 배치했다. 모바일은 도면 다음 패널 순서이다. 참조 선택·영역 선택·적용·삭제·drag/drop 기능은 유지한다.
- 사용자가 카메라 또는 기존 프로젝트 inspector를 숨길 때만 이동을 외부 하단에 표시하는 fallback을 유지한다.

## 실제 브라우저 검증

독립 Edge Chromium/Playwright 프로필을 사용했다. 사용자가 열어 둔 프로젝트는 수정하지 않았다. 유료 생성 호출은 0이며 결과 기능은 모의 API를 사용하는 기존 회귀 스크립트로 검증했다.

| 검사 | 결과 |
|---|---|
| 개발·production 폰트/이동 | 1920×1080, 1220×672, 390×844 × 6개 화면 × 2개 환경 = 36개 상태 통과 |
| 폰트 자산 | Paperlogy 5종 원본/public/dist/HTTP 응답 일치, HTTP 200, 실제 decoding 및 glyph 사용 일치 |
| 글자·이동 | HTML UI 텍스트 최소 12px, 이동 nav 1개, 패널 내부 포함, 가로 overflow 없음 |
| 이동 기능 | 패널 Next에서 Enter, URL 이동, browser back 및 reload 통과 |
| 전체 화면·반응형 | 홈·공간·배치·참조·검토·시점·결과, 1440×900/1280×800/768×900/390×844의 28개 반응형 상태 통과 |
| 외곽·짧은 창 | 원본 프레임·입력·사진 크기 유지, 1920×1080/1864×932/1313×932/1220×672 패널 fit·goal 높이 44–188px 통과 |
| Step 1 업로드 | 4개 분위기 이미지, hover/focus 삭제, 삭제 복구, 썸네일 원본 비율 통과 |
| 기존 workspace | 배치·그리기·도면 undo/redo·참조 crop/drop·보존·제품 지지 관계·카메라·모의 결과/history/stale·JSON/이미지 export·기존 이미지 목록 통과 |
| 앱/API 타입 검사 | 통과 |
| Vitest | 30개 파일 / 260개 테스트 통과 |
| ESLint | 통과 |
| production build | 통과, 기존 649.56kB JS chunk-size 경고는 남음 |

스크린샷을 직접 열어 홈·Step 1·배치·오른쪽 참조·검토·시점·모바일 패널 이동을 확인했다. 이번 타입 크기는 사용자가 승인한 후속 기준이며 원본 font size의 pixel-perfect 일치를 주장하지 않는다. 안내 글자가 12px로 커지면서 Step 1의 안내가 2줄이 되고 목표 입력의 y가 644→668로 변한 것은 가독성 변경에 따른 text flow다. 버튼과 사진의 외곽 위치는 유지된다.

증거:
- qa-screens/typography-20261008/before/: 변경 전 화면 및 measurements.json.
- qa-screens/typography-20261008/development/: 변경 후 전체 화면·28개 반응형 및 measurements.json.
- qa-screens/typography-20261008/fonts-navigation/: 개발·production 36개 화면 및 verification.json.
- qa-screens/typography-20261008/geometry/: 외곽·짧은 창·업로드/복구 스크린샷 및 검증 결과.
- scripts/qa-typography-navigation.mjs, qa-figma-alignment.mjs, qa-source-design.mjs, qa-workspace.mjs로 재현한다.

## 이번 후속 변경 파일

AGENTS.md의 폰트 규칙 및 최신 사용자 계약, docs/DESIGN_SYSTEM.md·FONT_PROVENANCE.md·QA.md·ARCHITECTURE.md·INTERACTIONS.md·UX_SPEC_CHANGELOG.md와 이전 QA_FIGMA_ALIGNMENT_20261008.md의 해결 기록을 갱신했다. 새 FONT_ASSETS_20261008.json 및 이 검증 문서를 추가했다.

실행 코드: src/main.tsx, src/app/App.tsx, src/components/LayoutWorkspace.tsx, MappingWorkspace.tsx, src/styles/tokens.css, app.css, respace.css, layout-mapping.css, public/fonts/fonts.css. .gitignore는 원본 폴더만 제외하도록 수정했다. 폰트 사본: public/fonts/paperlogy/ 5종. 재현 도구: scripts/sync-paperlogy-fonts.py, qa-typography-navigation.mjs 및 기존 QA 스크립트 두 개의 최신 기준 갱신. 기존 사용자 수정과 원본 폰트 폴더를 보존했다.

## 남은 범위

실제 Vercel 배포, iOS Safari/Android 실제 기기, 스크린 리더 및 실제 유료 모델/공간 일치 검증은 수행하지 않았다. production은 로컬 dist preview로 확인했다. 빌드의 기존 JavaScript chunk-size 경고는 글자/폰트/패널 이동 변경과 별개로 남는다.
