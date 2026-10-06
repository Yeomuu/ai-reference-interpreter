# 조명·진열 상품·시점 수정 회귀 검사

기준: main fb2f301, 2026-10-06. 격리된 Chrome에서 데모 데이터를 사용했다.

## 재현된 원인과 수정

- 조명 도구의 기본값은 standing-light(바닥 스탠드 조명)였다. 천장 설치를 선택하면 다른 위치에서도 같은 ceiling-zone 전체 점유로 충돌했다. offset이 있는 ceiling-light는 공유된 4% × 4% 개략 점유 크기로 같은 층의 충돌만 확인한다. 바닥 가구 위 배치는 허용하고 기존 등기구·천장 조명의 같은 위치는 거절한다. 실측 크기와 높이를 모델링한 검사가 아니다. offset 없는 기존 조명과 크기가 불명확한 다른 천장 물체의 전체 영역 예약은 유지한다.
- layout-first 화면에서 제품 도구의 도면 받침 클릭이 onSupportSelect에 연결되지 않았다. 실제 재현에서 전시대 클릭 후 상품 수가 0이었다. 도면 클릭·오른쪽 목록·키보드로 기존 fixture-surface 관계를 저장하도록 연결했다. 고정된 받침에도 상품을 올릴 수 있으며, 상품을 누르면 받침에 추가 연결할 수 있다. 받침이 없거나 위치 미지정이면 먼저 배치하도록 안내한다.
- camera 화면의 이전 단계가 workflowIndex에서 이전 최상위 단계인 references를 반환했다. previousWorkflowStep(camera)는 review를 반환한다. review 자체의 이전 단계는 references이다.
- 회귀 검사 중 일반 전시대의 기존 클릭 선택 경로에 영향을 확인하여 점 배치 모드를 조명 도구에 한정했다. 일반 가구의 선택·이동과 Backspace 삭제를 재확인했다.

## 자동 검사

- Vitest: 29개 파일, 245개 테스트 통과. 신규 조명 검사 5개, 시점 복귀 검사 1개, 도구 표시 검사 2개를 포함한다.
- ESLint 통과.
- 앱/API TypeScript 통과.
- production build 통과. 기존 500kB 초과 JS 묶음 경고는 남는다.
- 최신 origin/main과 기준 commit 동일함을 fetch 후 확인했다. 저장 스키마·서버 quota·이미지 모델 호출 계약은 변경하지 않았다.

## 변경 파일

| 파일 | 이유 |
| --- | --- |
| src/app/App.tsx | 설치별 안내, 상품 받침 클릭/목록, 선택 모드 복귀 시 선택 유지, STEP 04 복귀 연결 |
| src/app/workflow.ts | 시점 편집의 이전 단계 결정 |
| src/components/PlanCanvas.tsx / plan-canvas.css | 조명 배치와 상품 받침 선택의 마우스·키보드·hit target 처리 |
| src/domain/layoutDefaults.ts / validation.ts | 조명 개략 점유 상수 및 천장/바닥 층별 검사 |
| tests/lightingPlacement.test.ts / tests/routes.test.ts / src/components/PlanCanvas.test.tsx | 설치 층, 기존 조명, legacy, 경계, 복귀 및 도구 회귀 테스트 |
| scripts/qa-lighting-products.mjs | 유료 호출 없는 실제 브라우저 재현·회귀 시나리오 |
| docs/PRODUCT.md / INTERACTIONS.md / ARCHITECTURE.md / UX_SPEC_CHANGELOG.md / QA.md | 현재 동작과 검사 근거 |
| docs/USER_GUIDE_CONTENT.json / USER_GUIDE.md / public/guide/index.html / user-guide.pdf / output/pdf/서비스_사용_실험_참여_가이드.pdf | 설치·상품 배치·시점 복귀 안내 동기화 |

## 실제 브라우저 검사

| 검사 | 확인 내용 |
| --- | --- |
| qa-lighting-products.mjs | 바닥 조명·가구 충돌, 가구 위 천장 조명, 같은 천장 영역의 두 위치, 같은 위치 거절, 기존 조명 회피, 상품의 도면/목록/키보드 배치, 고정 받침, 위치 미지정 받침 안내, undo/redo/reload, camera→review, 직접 URL과 history, 카메라 수정 유지 |
| qa-workspace.mjs | 영역, ceiling/product 연결, crop/whole-image drop, Shift 다중 연결, 연결 변경, 요소 이동, 일시 알림 X/2초, 생성 요청/결과 저장, stale/history, 부분 수정, 삭제 복구 |
| qa-prototype.mjs | 요소 20개·레퍼런스 8장 한도, 초과 legacy 보존, 연결 count 유지, 막힌 출입구 추천, 시점 다양성, preset undo/redo/reload |
| qa-element-visibility.mjs | 자동 사진→도면 추출 없음, 명시적 개략 도면, 기존 천장 요소 표시, 레이어/위치 미지정/연결 누락 데이터 보존, 원본 공간 사진과 생성 도면의 입력 순서 |
| Backspace 회귀 | STEP 02 선택 요소 삭제, 입력 중 기본 편집, 키 반복 보호, undo/redo/reload, 다른 단계·다각형 그리기 보존 |
| 가벽·복구 회귀 | A/B 면, Reference 삭제 복구, 보존 해제/설정, 영역 이름·크기, migration, 사전 제공 샘플 |
| 사용 가이드 | 새 탭, 8개 설명 섹션·4개 화면 이미지, 목차 링크, 1440/1280/1070/390px 읽기, HTML/PDF 다운로드 일치 |

가이드의 조명·상품 설명과 카메라 복귀 안내를 HTML/PDF에 같이 갱신했다. PDF 8페이지에서 수정 문구를 추출해 확인했고 공개 PDF와 로컬 배포용 PDF의 바이트가 일치한다.

## 한계

유료 모델 호출은 0회다. 생성 관련 브라우저 검사는 응답을 대체해 요청·상태·결과 저장 경로를 확인했으며 실제 AI 결과 품질을 검증한 것은 아니다. 기존 좁은 창의 패널 압축, JS 묶음 크기 경고와 개략 도면의 비실측 한계는 유지된다.
