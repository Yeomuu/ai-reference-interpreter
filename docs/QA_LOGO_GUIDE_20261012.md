# 로고·사용/실험 가이드 정합성 · 2026-10-12

기준 커밋7d003a7. 수정 전 복구 branch: codex/backup-before-logo-guide-20261012.

## 수정 내용

| 기존 불일치 | 현재 안내/수정 |
| --- | --- |
| 이전 심벌 | 사용자 지정 Figma311:899의 원본SVG. 색·비율·1254×1254 viewBox·내부 여백 보존. 기존 wordmark·logo slot 유지 |
| 선택·이동 버튼을 누르라는 설명 | 활성 도구 재클릭·카테고리 전환으로 선택 상태 복귀 |
| 레퍼런스·적용 설정이 왼쪽이라는 설명 | 오른쪽 패널로 정정 |
| 벽 시작/끝%만 설명 | 별도 폭 입력·양 끝 손잡이·위치·폭 적용·%의 의미와 높이/실측 비지원 설명 |
| 격자·기본 자료 안내 없음 | 격자/Alt·Shift45°·분류형 자료6장·명시적 등록/연결 안내 |
| 4단계 생성 행동 위치 | 오른쪽 패널 맨 아래 AI 이미지 생성, 결과 전 결과 탭 비활성 안내 |
| 실험 링크#experiment가 없는 위치를 가리킴 | 현재#study로 정정. 기존#experiment도 같은 장으로 호환 |
| 연습/과업 시작 안내의 혼동 | 홈 자동A, 기록 없는 별도 연습, 다음 자료 준비 후 수동B를 구분 |
| 진행자 안내의 Keep/시점 결정 전제 | 학교 기본 보존5개 그룹·추천 시점·빈 배치/연결을 사전 제공 조건으로 명시 |
| 과거12개 판단 과업 카드의 적용 범위 | 현재 학교 평가표가 아닌 원 기획 초안임을 명시하고 실제 사용자 결정 항목으로 별도 평가 단위 확정 안내 |

## 변경 파일
App.tsx·index.html·새 public/brand SVG는 심벌과 favicon만 변경한다. ExperimentPanel.tsx는 가이드 deep link만 변경한다. 수집·종료·설문·ZIP·배치·보존·AI 모델·quota·사용자 데이터 로직은 수정하지 않는다.
.gitattributes의 해당SVG -text 규칙은 checkout의 자동 줄바꿈 변환을 막아 원본 bytes/hash를 보존한다.

USER_GUIDE_CONTENT.json과 build-guides.py는 웹·Markdown·PDF의 생성 원본이다. public/guide의 웹·PDF·실제 화면5장·manifest와 USER_GUIDE.md·EXPERIMENT_RUNBOOK_AND_VIDEO.md 및 output/pdf의 참여자/진행자 PDF를 갱신한다. 진행자 답안·평가표는 public에 배포하지 않는다. 관련 EXPERIMENT_LOGGING·UX_SPEC_CHANGELOG·.omd/preferences 기록을 갱신한다. SVG 출처/hash는 FIGMA_LOGO_ASSET_20261012.json.

## 실제 검증

- 지정 Figma 노드의 design context·screenshot·metadata를 읽고 원본 SVG6154bytes/SHA-256을 기록했다. Figma 쓰기를 수행하지 않았다.
- 격리된 Edge/Playwright에서 새 학교 프로젝트로 홈과4단계1920×1080 화면을 캡처하고 직접 확인했다. 새 심벌·기존 wordmark·40% 벽면 폭·3개 전시대 reference 연결·고정 생성 footer·결과 전 disabled 탭을 확인했다.
- 공개 가이드8개 장·h1 1개, 새 탭이 기존 작업 URL을 유지, 실험 링크#study와 과거#experiment, 전체 목차 제목이 header 아래에 표시되는 것을 확인했다.
- 1440/390/320px에서 문서 가로 넘침이 없고 실험 제목은 고정 header 아래에 있었다.1440: headingY168.28/headerBottom77,390:156.55/115,320:156.78/115.
- 홈에서 A 자동 시작, 종료·설문6개·실제 ZIP12파일, 수동B 시작과 받을 기록 선택, 새로고침 재개·종료·설문·B ZIP12파일을 확인했다. 실제 자료 난이도의 동등성/비교효과를 검증한 것이 아니다.
- PDF HTTP200·%PDF 형식·공개/로컬 bytes 일치·실제 다운로드를 확인했다. 최종 참여자10페이지·진행자6페이지를 Poppler로 렌더링해 한글·표·페이지 나눔·footer를 확인했다. 마지막 FAQ의 중복 설명은 해당 본문 안내에 남기고 제거해 거의 빈 추가 페이지를 없앴다.
- npm test:33파일280개 통과. npm run lint·앱/API TypeScript·production build 통과. 유료 이미지 요청0회. 페이지 script 오류0개.

브라우저 증거: public/guide/screenshots/manifest.json 및 ignored qa-screens/logo-guide-20261012/, 별도 writable visualization root의 logo-guide-20261012/report.json·guide screenshots·PDF render·실험ZIP. 로컬 서버의 초기 sandbox loopback 접근 실패는 같은 host 실행으로 해결했다. Windows가 QA ZIP을 잠글 때 Vite watcher가 종료하는 현상은 검증 파일을 앱 감시 폴더 밖에 저장해 해결했으며 앱/Vite 설정을 변경하지 않았다. MCP Node REPL의 bundled Playwright 접근 EPERM은 직접 승인된 프로젝트 CLI 브라우저 방식으로 검증했다.

화면 캡처 검증에서는 이미지 생성 endpoint를 차단했으므로 생성 설정의 서버 연결 안내는 실제 운영 서버 건강/잔여 횟수 검증이 아니다. 시점·배치·가이드 조작과 실제 AI 이미지 생성 품질을 구분한다. 이번 변경은 새 모델 호출·실험 비교 화면·자동 자료 교체·평가자 코딩·통계 검증을 추가하지 않는다.
