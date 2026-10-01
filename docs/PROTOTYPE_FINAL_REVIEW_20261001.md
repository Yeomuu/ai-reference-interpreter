# Scene Edit — 최종 UT UI·인터랙션 정리 보고

검토 기준: GitHub `Yeomuu/ai-reference-interpreter`의 최신 main `c0a00eb`. 수정 전 fetch 결과 local/remote 차이 0/0. 기존 layout-first 흐름을 재구축하지 않고 최소 수정했다. 날짜: 2026-10-01.

## 수정 전 확인

| 네 단계 | 이미 있던 기능 | 정리한 중복·충돌 |
|---|---|---|
| 공간·방향 설정 | 공간 사진/도면 분리, 유지 구조, 컨셉 방향, 브라우저 저장 | 새 업로드 후 실내 범위를 정할 기존 경로와 새 Area 도구 축소를 연결 |
| 레이아웃 구성 | Reference 없는 Layout Item, 3열, 구조/영역/속성/충돌 검사 | 요소 추가·구역 설정 탭, floor/ceiling 새 도구, 드러난 좌표, X처럼 보이는 조명 |
| 레퍼런스 적용 | 2열, crop/drop/Shift/마우스 다중 선택, ReferenceBinding | 이미지별 그룹을 명확히 하고 등록 수·행동 아이콘 보완 |
| 시안 생성 | 카메라·검토·생성·이력·stale·부분 수정·export | 카메라 편집을 먼저 열던 흐름, 고정 시작 시점, 중복 수정 버튼·좌표 설명 |

교수님 피드백과 관련해 제목/부제 Scene Edit · 전시·팝업 공간 디자인을 보존했다. 실제 학교 사진과 설명용 개략 도면을 구분하며, 도면 형태 우선·짧은 4단계·선택적 상세 설정으로 정리했다. 지도, 계정, 구매, 3D/CAD, 모바일 기능은 추가하지 않았다.

## 1. 수정한 파일

| 파일/묶음 | 이유 |
|---|---|
| src/domain/prototypeConfig.ts, prototypeLimits.ts | 20/8 제한·신규 Area 도구·카메라 프리셋의 공통 정의 |
| src/domain/cameraRecommendations.ts | 2D 추천·유효 위치 검사·호환 보완 |
| src/domain/types.ts, revisions.ts, validation.ts, layoutMapping.ts | 선택 카메라 필드, snapshot/stale, 표면 조건 구분, 자동 추천점과 실제 구조 충돌의 역할 분리 |
| src/services/persistence.ts, experiment.ts, generationContract.ts | 추가 필드 읽기/저장·로그·실제 저장 시점의 모델 입력 |
| src/app/App.tsx, workflow.ts | 도구 통합·추가 경계·옵션 시점·결과 요약·윤곽 설정·history |
| src/components/LayoutWorkspace.tsx, MappingWorkspace.tsx, CameraSummary.tsx | 도구/카운터/매핑 그룹/추천 요약 |
| src/components/NucleoIcon.tsx, PlanSymbol.tsx, LayoutSymbol.tsx, PlanCanvas.tsx, AreaTargetPicker.tsx | 아이콘 의미, 전구, 실제 범례, 신규 floor/ceiling 도구 제거 |
| src/styles/layout-mapping.css | 기존 토큰으로 카운터·아이콘 간격·한 줄 범례·검토 내부 스크롤 |
| src/data/campus.ts | 새 학교 프로젝트는 참고 자료만 준비하고 배치/매핑/시점은 사용자 흐름에서 생성. 저장된 구형 프로젝트는 변경하지 않음 |
| tests/prototypeLimits.test.ts, cameraRecommendations.test.ts, prototypeUI.test.tsx | 29개 추가 검사 |
| tests/planGuide.test.ts, src/domain/presentationDefaults.test.ts | 학교 시작 카메라를 새 추천 흐름으로 검증 |
| scripts/qa-prototype.mjs, eslint.config.js | 격리 브라우저 경계/Undo/Redo/reload의 반복 가능한 검사 |
| scripts/build-guides.py, docs/USER_GUIDE.md, public/guide/index.html, public/guide/user-guide.pdf, output/pdf의 두 안내 PDF | 실제 화면에 맞춘 6페이지 참여자 가이드·6페이지 진행/영상 안내 |
| docs/PRODUCT.md, DESIGN_SYSTEM.md, INTERACTIONS.md, ARCHITECTURE.md, QA.md, UX_SPEC_CHANGELOG.md, ICON_MANIFEST.md, EXPERIMENT_LOGGING.md, 본 보고 | 현재 계약·근거·검증 범위 명시 |

## 2. Layout 20개 제한

`countLayoutItems`는 현재 elements 중 실제 사용자 배치 물체를 센다. 전시대·테이블·의자·조명·상품·벽면 연출·사용자가 추가한 기본 진열대와 일시 제외된 물체를 포함한다. Structure/Area는 별도 배열이므로 제외하며, 전체 공간/소재/분위기 조건 및 origin=mapping-condition 투영도 제외한다.

고정 헤더에 n/20, 도달 시 여섯 추가 버튼 disabled + 안내. 사용자 추가 함수와 공통 commit 경계 모두 같은 규칙을 사용한다. 구형 20개 초과는 삭제/축소하지 않고 편집·삭제·복구 가능, 신규 물체만 차단한다. history와 삭제 복구는 정확한 이전 초과 상태를 복원한다.

## 3. Reference 8장 제한

Reference의 고유 imageId를 센다. 컨셉·가구/공간·제품 모두 포함하고 공간 사진/평면도/결과는 제외한다. 같은 이미지의 crop/반복 바인딩은 개수가 변하지 않는다. 이미지 내용 자체를 비교한 중복 제거 기능은 아니다.

Step1/3의 업로드 disabled와 n/8, 신규 upload 사전 검사 및 commit 검사를 일치시켰다. 구형 >8장도 그대로 읽는다. 삭제 복구는 기존 이미지와 관계를 복원한다. 기존 모델 입력의 contact sheet는 초과 구형 자료를 임의로 잘라내지 않는다.

## 4. Area UI

한 도구 패널의 분위기 영역(spatial)·통행 동선(passage) 두 개만 새 Area로 노출한다. floor/ceiling 데이터·typed target·validation·migration은 유지한다. 새 업로드는 이전 직사각형/표시를 제거하며, 1단계에서 사용자가 실내 윤곽을 표시하면 기본 바닥/천장 기준에 반영한다. 자동 구조 추출이나 치수 추정이 아니다. 영역 이름·범위 수정과 실행 취소도 유지했다.

## 5. 아이콘과 도면

새 SVG/외부 라이브러리 없음. 확보된 Rotation360/Sitemap4/Minus에 rotate/structure/minus semantic alias를 보완했다. 기존 Nucleo image/images/file/layers/camera/edit/add/trash/lock/check/info/warning/refresh/previous/next를 UI 제목·행동에 확대했다.

전시대/테이블/의자/전구/상품은 LayoutSymbol, 벽/창/문/출입구/기둥은 PlanSymbol/실제 구조 기하를 쓴다. 조명은 전구 형태로 교체했다. 기본 이름을 숨기고 hover/선택/속성에서 노출한다. 범례는 현재 표시 대상·문 열림 상태에 맞추며 벽 선·가벽 점선·영역 윤곽·출입/통행 빗금을 구분한다. 정확한 Save/Undo/Redo 자산은 현재 확보 목록에 없어 텍스트를 유지한다. 사용자 제공 잠금 해제 SVG는 이전 예외 계약을 그대로 보존한다.

## 6. Camera 추천 알고리즘

각 physical floor의 24분할 후보를 검사한다. 도면 종횡비를 반영한 상대 거리이며 실제 m 단위 측량이 아니다. 바닥 윤곽 밖/벽·가벽 가까이/기둥·가구 내부/출입 clearance는 제외한다. 앞쪽 다섯 짧은 광선 중 세 개 이상이 열리고 주요 대상 방향이 보이는지 2D 선 교차로 근사한다.

entry는 출입구와의 거리 및 보이는 대상, 열린 앞쪽을 점수화한다. secondary는 다른 위치·방향·보이는 대상에 가점을 주고, overview는 별도 위치에서 높은 사선(기본 높이 3.2m, pitch -45°) 시안 방향을 전달한다. 이 높이는 렌더링 요청 조건이지 실제 천장 높이가 아니다. 3D 가시성 엔진은 추가하지 않았다.

## 7. 막힌 입구 처리

출입구 좌표 자체에 고정하지 않고 가까운 유효 후보를 탐색한다. 실제 브라우저에서 학교 출입문 앞 가벽을 그렸을 때 문 여유 영역을 벗어나 가벽 끝 너머로 안쪽을 볼 수 있는 위치가 선정됐다. 가구가 입구 앞에 놓인 자동 검사도 통과했다.

미수정 자동 시점은 레이아웃 수정 후 필요하면 4단계에서 복구한다. 숨긴 임시 추천점 때문에 구조 그리기를 막지 않는다. 수동/수정한 카메라는 자동 이동하지 않으며 기존 충돌과 수정 안내를 유지한다. 유효한 위치가 충분하지 않은 도면에서 세 개를 강제하지 않는다.

## 8. Primary / Secondary 다양성

도면 짧은 축을 1로 둔 상대 거리 ≥0.18 및 방향 차이 ≥45°를 동시에 요구한다. 보이는 주요 물체가 다르면 추가 점수를 준다. 계산은 결정적이며 랜덤/동일 위치의 높이만 바꾸는 세 장이 아니다. 상대 거리/방향 차이는 구성의 다양성 기준이지 생성 이미지의 시각적 차이를 보장하지 않는다.

## 9. Camera migration

선택 필드 viewPreset/heightMeters/eyeHeightPreset/pitchDegrees/recommendation 및 Project.cameraRecommendationVersion=1을 보완했다. 기존 ID·이름·위치·방향·대표 여부·사진·이력·snapshot은 유지하고 없는 값만 채운다. 반복 migration은 멱등적이며 schemaVersion은 그대로다.

기존 수동 시점은 유지하고 남은 슬롯만 제안한다. 한 번 준비한 뒤 삭제한 시점은 자동으로 되살리지 않는다. 눈높이 프리셋은 같은 ID에 높이만 적용하며 Undo/Redo/reload 된다. 높이·pitch·view 변경은 해당 카메라의 이전 결과만 stale로 표시한다.

여성 1.48m/남성 1.60m는 **검증되지 않은 임시 렌더링 값**이다. 공식 평균 눈높이로 주장하지 않으며 추가 설정에 ‘연구 적용 전 공식 인체치수 근거로 확인 필요’를 표시한다. 근거 확인 경로: [Size Korea 제8차 측정 보고](https://sizekorea.kr/human-info/meas-report?measDegree=8), [공식 인체치수 검색](https://sizekorea.kats.go.kr/human-meas-search/human-data-search/meas-count). 이번에는 해당 성별·연령의 실제 눈높이 통계치를 확보하지 못했다.

## 10. 자동 테스트

- 전체 27개 파일, 222개 테스트 통과(추가 29개).
- lint 통과, 프론트/서버 TypeScript 통과, production build 통과.
- 한도 직전/직후, 구형 초과 저장/읽기, 반복 binding count, 신규 spatial/passage, floor/ceiling 도구 숨김.
- 추천 바닥/장애물/막힌 입구/서로 다른 위치·방향/오목한 세로 도면/불가능한 바닥/기존 카메라 보완/height snapshot/stale/삭제·수정 존중.
- four-stage/review 우선/카메라 숨김/한도·추천 로그/파일명 미수집.
- 기존 quota/replay/identity/API 오류/불확실 응답/queue/원본 crop/가벽 양면/typed anchor/보존/이력/export 테스트도 함께 통과.

추가 브라우저 검사 실행: 개발 서버를 연 상태에서 `node scripts/qa-prototype.mjs`. 설치된 Playwright 위치와 Chrome 경로가 필요하면 PLAYWRIGHT_MODULE / CHROME_PATH, 다른 서버는 QA_BASE_URL 환경 변수로 지정한다. 이 스크립트는 임시 프로필과 테스트 자료만 사용하며 유료 생성은 사용할 수 없는 상태로 둔다.

## 11. 실제 브라우저 QA

실제 격리 Chrome에서 UI로 수행했다.

- 학교 사진·개략 도면 → 전시대4·테이블·의자·조명·분위기 영역 → 참고 이미지 업로드/crop/Shift 1·2·4 다중 연결/HTML drag/drop → 벽·전체 분위기 연결 → 추천3/선택 수정 → 모의 생성 응답 결과 → 부분 수정/stale/로그.
- 가벽 A/B 부착·반대 면 매핑·삭제 Undo, 위치 고정, 상품/진열대 관계, 영역 이름·크기, 구형 migration·reload, 실제 사전 제공 AURA 샘플 열기.
- 한도 19→20/7→8 및 disabled, 동일 reference 반복 count, 초과23개/9장 데이터 유지, Ctrl+Z/Ctrl+Shift+Z, 브라우저 뒤/앞.
- 가벽으로 막힌 입구의 대안·시점 다양성, 선택 눈높이 같은 ID·Undo/Redo/reload, 새 평면도 종횡비·기존 표시 제거·윤곽 저장·복구.
- 1070×671/1280×720/1600×900에서 바깥 문서 overflow 없음. JS pageerror 없음. 카메라 방향은 편집에서만, 요약/결과에는 위치만 표시. 결과 작은 도면은 왼쪽 이미지/이력에, 적용 카메라 설명·수정은 오른쪽에 배치.
- 참여자/진행자 PDF 각 6페이지, 변경된 사용법 페이지를 렌더링하여 잘림/겹침을 확인했다.

자동 조작만으로 사람의 무설명 사용성을 입증하지는 않는다. 실제 무설명 완료율/통제감/만족도는 논문 UT에서 평가한다.

## 12. 남은 오류/검증 경계

검사 범위에서 재현되는 기능 오류는 없다. 이번 유료 이미지 모델 호출은 하지 않았다. 테스트 생성 응답은 격리 브라우저에만 사용했으며 새 overview/eye-height의 실제 AI 재현 품질은 미검증이다. 기존 >500kB bundle 경고(약599kB minified)는 남으며 빌드는 성공한다. 기존 권한·API·quota 설정은 변경하지 않았다.

## 13. 논문 UT 전 필수 확인

- AI 이미지 평가를 포함한다면 공식 학교 자료/허가된 평가 입력으로 overview·eye-level 실제 결과를 연구자가 사전 대조해야 한다. UI·모의 응답 성공으로 공간 재현 정확도를 주장하지 않는다.
- 성별 평균 눈높이를 연구 조건으로 사용할 경우 공식 국내 인체치수 통계의 측정항목·성별·연령·숫자를 확인해 중앙 상수를 교체해야 한다. 기본 공간적으로 다른 추천 세 시점에는 성별 분류를 쓰지 않는다.
- 과업 A/B와 종료·평가 기준/참여 동의/ZIP 제출 절차는 기존 실험 가이드에 따라 진행자가 확정한다. 자동 로그는 ground truth·사람의 평가를 대신하지 않는다.

## 14. UT에 필수 아닌 개선 사항

현재 남는 번들 분할 경고는 성능 개선 후보이며 기능 확대 없이 추후 다룰 수 있다. 좁거나 매우 복잡한 도면에서 후보가 부족하면 추천 수가 줄어드는 동작은 의도적이다. 정확한 3D 시야/실측/자동 구조 추출은 이번 범위에 포함하지 않았다. 추가 고급 기능은 제안하지 않는다.
