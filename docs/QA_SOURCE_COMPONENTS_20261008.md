# 원본 SVG·컴포넌트·전체 패널 정정 QA · 2026-10-08

## 이번 수정

v1.4.2에서 누락하거나 잘못 옮긴 원본 SVG, hover 삭제, Corner/Center Marker, 텍스트·타이포·간격을 정정했다. STEP 02/03의 R0 해석을 철회하고 STEP 02~04 외곽을 모두 원본 R8/스트로크 없음/8px 중립 4% 그림자로 맞췄다. 학교 STEP 01의 목표는 fill/max188이며 내부 스크롤 없이 Next와 함께 보인다. 사진 provenance 행을 제거했고 원본 사진 윤곽 R14.4·홈 R40·입력 R8·주 버튼 R12는 유지했다. 원본 디자인과 일반 도면 기하학·배치·reference·camera·generation 계약은 보존했다.

SVG 다운로드에서 주변 프레임/배경이 포함되는 문제를 확인하여 모든 자산을 정확한 노드의 exportAsync(SVG_STRING)으로 교체했다. 원본 경로·색·stroke·intrinsic 크기는 유지한다. 썸네일 2개 마스크만 원본 Boolean의 clone을 흰색으로 export한 후 제거했다. 노드/크기/hash 명세는 FIGMA_SOURCE_ASSETS_20261008.json.

## 실제 실행 결과

- 최종 npm run lint / npm run typecheck / npm run build 통과.
- 최종 npm test -- --maxWorkers=1: 30개 파일, 260개 테스트 통과. 마지막 전체 실행 15.71초. quota/provider 오류 메시지는 fail-closed 테스트의 의도된 fixture 출력이다.
- qa-source-design.mjs: 실제 Chrome에서 홈 입력·사진·패널·표·목표·Next의 원본 치수/반경, 20/16/14px 주요 타이포, 원본 SVG 5개·marker 6개·불필요 provenance 없음 확인. 1920×1080 / 1864×932 / 1313×932 / 1220×672에서 내부 scrollHeight<=clientHeight+1, 입력/업로드/Next 가시성·가로 overflow 없음.
- 분위기 1장 default에서 삭제 opacity=0, hover/focus에서 1. 클릭 파일 선택/native drop으로 4장까지 등록하고 disabled 상태의 drop이 차단됨 확인. 4장→삭제→3장→영구 삭제 복구→4장 통과. 1220×672의 4장 상태에서 scroll/client 각각 452px, 목표 57px이며 Next가 보인다.
- qa-design-update.mjs: 최종 SVG/R8 상태에서 홈→STEP 01~04 전체 흐름, 변경 가능한 기본값·필수 구조·사진 키보드·서로 다른 빗금, 목표 프롬프트/snapshot/stale/reload, 배치·Undo/Redo·Shift 다중 매핑, 추천 시점·편집 후 STEP 04 복귀, 모의 생성·결과 수정, 반응형/축소 모션 통과. R8·border0·0 0 8px shadow DOM 검사 포함. JS 오류 0.
- qa-workspace.mjs: 오른쪽 그리기·영역 설명·천장 조명·상품 받침·범례, crop/전체 이미지 drop, 고정 적용/범위 변경, 잘못된 이동 차단, 토스트 X/2초, 연결 요소 이동·Undo/Redo/reload, 결과 활성화·history/stale·삭제 복구, legacy 12장 목록·Escape 통과. JS 오류 0.
- qa-element-visibility.mjs: 홈 로고→일반 프로젝트 생성, 사진만 업로드하면 도면/요소/시점이 생기지 않음, 명시적 개략도/reload, legacy 천장 물체·배치 수·숨긴 hit target·선택/zoom, 미배치/제외/host 누락 데이터 보존, 원본 사진+저장 도면의 모의 생성 요청/결과 persistence 통과. JS 오류 0.
- 모든 브라우저 QA는 격리 프로필이며 실제 유료 모델 호출은 0회. 모의 생성은 로직/전송/저장 검증이고 이미지 품질 검증이 아니다.
- Figma 최신 섹션 216:262와 STEP 01/STEP 02 렌더링, 9개 STEP 02~04 외곽 패널 R8/스트로크0/원본 shadow를 확인했다. source 홈/STEP 01 및 원본 컴포넌트는 수정하지 않았다.
- 사용 가이드의 홈 로고 목록 접근과 hover 삭제 안내, 5장 실제 UI 캡처를 갱신했다. 캡처에는 AI 생성 결과가 없으며 provenance/hash는 public/guide/screenshots/manifest.json에 기록했다.
- 가이드 PDF를 Poppler로 렌더링해 확인했다. 첫 렌더의 한 문단이 다음 페이지로 넘어간 문제를 안내 중복 정리로 수정했고, 최종 9페이지의 STEP 01은 한 페이지 안에 들어오며 캡처/본문/표의 겹침은 발견하지 않았다.

## 한계

웹은 제공 Wanted Sans와 Adobe 키트, Figma 작업본은 사용자가 승인한 Noto Sans KR이다. 실제 글자 폭은 다르므로 완전한 글자 단위 일치를 주장하지 않는다. 본문/헤더 x240 공통 경계는 원본 x242와 2px 다르며 기존 정렬 요청을 유지한다. 모바일은 한 화면 고정 대신 기존 작업 영역 스크롤을 허용한다. 일반 프로젝트의 임의로 많은 구조 목록도 기존 내부 스크롤을 유지한다. 기존 500kB 초과 JS bundle 경고가 남아 있으며 이번 UI 수정에서 엔진 교체/새 기능을 하지 않았다.
