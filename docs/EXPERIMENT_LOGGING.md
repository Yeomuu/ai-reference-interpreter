# 실험 기록과 제출

## 참가자 홈 자동 시작 · 2026-10-07

홈은 시작 버튼 앞에 익명 번호와 편집 기록이 브라우저에 저장됨을 안내한다. P01 형식 입력 후 시작하면 과업 A/structured 기록을 자동 준비한다. 별도 로그 초기 설정을 강제하지 않는다. 기록 중 같은 참가자는 해당 프로젝트를 이어가고 다른 참가자는 기존 기록 종료를 먼저 안내한다. 일반/다른 공간 경로의 기존 수동 A/B 기록은 유지한다. B 선택은 프로젝트 자료나 인터페이스를 자동 변경하지 않는다.

design_goal은 사용자 작성 의도로 최종 condition_snapshot/assessment_output에 포함하며 변경은 기존 공통 조건 이벤트로 추적한다. 원본 이미지·파일명·개인 식별 자료는 이벤트에 기록하지 않는다. 서버 수집·자동 제출·정답 채움·사람 평가 자동화는 추가하지 않았다. 홈에 준비된 기본 구조/참고 자료와 새 빈 배치를 실제 과업 설계에서 명시해야 한다.

## 최종 제한·추천 시점 이벤트 · 2026-10-01

동의한 현재 프로젝트에서 layout_limit_reached/reference_limit_reached를 한도 도달 또는 차단 시 기록한다. count/limit 값만 보완하며 이미지·파일명·새 개인정보 필드는 기록하지 않는다. 자동 시점 추가에는 camera_recommendation_created, 처음 수동 수정에는 camera_recommendation_modified를 남긴다. camera 이벤트의 view_preset/height_m/pitch_deg는 허용 목록에 추가한다. 기존 연속 회전/드래그 기록 병합과 최종 조건 snapshot·ZIP 구조는 유지한다. 자동 추천과 사람의 수정을 같은 작업량으로 해석하지 않도록 이벤트 이름으로 구분한다.

## 확인한 근거와 범위

2026-09-28에 사용자가 첨부한 **염예빈-2026 가을 학술대회 아이디어 정리 및 디벨롭 (1).pdf**는 총 14페이지다. 요청한 마지막 5페이지(10–14)를 텍스트와 렌더링으로 확인하고, 필드와 이벤트 정의를 해석하기 위해 3–9페이지의 관련 절차도 읽었다. Google 문서 자체는 접근할 수 없었으므로 PDF를 근거로 삼는다.

문서는 조건 정확도·누락·오연결을 주 지표로, 시간·수정·통제감·부담을 보조 지표로 둔다. 단계별 이동과 배치 오류·복구 로그는 이를 설명하는 진단 자료다. 최종 조건의 정확도는 과업별 정답 기준과 사람의 평가로 코딩한다. 실제 AI 생성 품질은 생성한 경우에만 추가 분석하며 인터페이스의 효과와 모델 성능을 구분한다.

현재 구현은 **structured 조건의 수집·제출**이다. 자유 텍스트 비교 화면, A/B 과업 자료의 난이도 동등성, 교차 배정, 사전 설문·인터뷰·평가자 코딩 및 통계 분석은 자동 구현되었다고 주장하지 않는다. A/B 선택은 진행자가 지정한 과업을 표시하는 메타데이터이며 과업 자료를 자동 교체하지 않는다. 전체 비교 실험이 준비되었다는 뜻이 아니다.

## 참여자 사용 순서

1. 진행자가 지정한 프로젝트를 연다. 연습 과업 중에는 기록을 시작하지 않는다.
2. **실험 기록**을 펼쳐 `P01` 형식의 익명 번호와 진행자가 지정한 과업 A/B를 선택한다. 실명·학번을 입력하지 않는다.
3. 안내받은 기록 수집에 동의하고 **이 프로젝트 기록 시작**을 누른다. 일반 서비스 이용 중에는 행동 로그를 수집하지 않는다.
4. 동일한 브라우저의 한 탭에서 과업을 수행한다. 이동·저장·오류 등 의미 있는 행동이 발생할 때 브라우저 저장소에 기록한다. 새로고침 후 미완료 기록이 이어지며 `session_resume`을 남긴다.
5. 시작한 프로젝트에서 **과업 종료**를 누른다. 종료 시점의 구조화 조건과 카메라를 고정 기록한다. 나중에 프로젝트를 수정해도 제출 산출물은 바뀌지 않는다.
6. 과업 직후 6개 문항에 1–5점으로 응답하고 **실험 기록 ZIP 받기**를 누른다. 파일을 실험 진행자에게 전달한다. 미응답은 빈 칸이다.

완료 전에도 중간 백업 ZIP을 받을 수 있다. 서버로 자동 제출되지 않으며, 다른 컴퓨터·브라우저에서는 이 기록이 보이지 않는다. 저장 공간 문제는 지속 경고로 표시한다. 새로고침 전에 ZIP을 받는다. 손상된 기록은 덮어쓰지 않는다. 서로 다른 참여자가 같은 브라우저를 쓴다면 익명 번호와 이전 세션 선택을 확인한다. 다른 프로젝트로 이동한 동안 그 프로젝트의 행동은 현재 과업 로그에 섞지 않는다.

## 공통 필드와 개인정보

`event_id`, `participant_id`, `session_id`, `condition:'structured'`, `task_set`, `event_name`, `step`, `object_type`, `object_id`, `result`, `payload`, `ts_client`, `ts_server`, `elapsed_ms`를 저장한다. 문서의 단계명에 맞춰 Keep은 `preservation`, 레퍼런스는 `reference`, 시점은 `viewpoint`, 결과는 `result`로 직렬화한다.

서버에 행동 로그를 전송하지 않으므로 **`ts_server:null`**이며 서버 시각을 만들어 넣지 않는다. `elapsed_ms`는 클라이언트의 과업 시작 이후 시간이다. 중간 입력 문장, 모든 키 입력, 매 프레임 마우스 좌표, URL·IP·브라우저 외부 사용 기록, 원본 이미지, 원본 파일명, API 키·참여 토큰은 수집·내보내지 않는다. 이벤트 payload는 명시한 필드만 허용한다. 최종 조건 산출물에는 평가에 필요한 사용자의 조건 문장이 포함되므로 작업 내용에도 실명·학번을 쓰지 않도록 안내한다. 파일 다운로드를 사이트 내 서버 제출이나 자동 백업으로 표시하지 않는다.

## 이벤트 연결

| 동작 | 기록 |
|---|---|
| 수집 시작/종료 | `experiment_start`, `condition_start`, `condition_complete` |
| 화면 이동·뒤로 가기 | `step_enter`, `step_exit`, `back_navigation` (UI/브라우저 이동 구분) |
| 창 전환 | `window_blur`, `window_focus`; 새로고침·재진입은 `session_resume` |
| Keep 상세·켜기·끄기 | `preservation_detail_open`, `preservation_select`, `preservation_unselect` |
| 레퍼런스 선택·등록·삭제 | `reference_select`, `reference_add`, `reference_remove`; 역할 수정이 커밋되면 `reference_role_change` |
| 부분 참조와 요소 | `reference_region_select`, `element_create`, `element_apply`, `element_exclude`, `element_remove` |
| 조건 편집 | `condition_edit_start`, `condition_edit_save`, `condition_edit_cancel`; 시간·문자 수·변경 필드만 기록 |
| 포인터 조작 시작·종료·취소 | `drag_start`, `drag_end`, `drag_cancel` (요소/구조/카메라, 조작 종류·대상; 검증 결과는 별도 이벤트) |
| 배치 시도·저장·이동·제거·거절 | `placement_start`, `placement_commit`, `placement_move`, `placement_remove`, `placement_invalid` |
| 구조/영역 표시 | `structure_create`, `structure_move`, `structure_invalid`, `area_create`, `area_invalid` (요소 배치 오류와 분리) |
| 카메라 생성·이동·회전·저장·삭제 | `camera_create`, `camera_move`, `camera_rotate`, `camera_save`, `camera_remove` |
| 검토·수정 루프 | `review_open`, `review_issue_detected`, `review_edit_jump`, `review_edit_target`, `review_return` |
| 유료 생성 | `generation_request`, `generation_complete`, `generation_fail` (요청 ID·시간·불확실 여부) |
| 사전 제공 샘플 | `sample_preview_request`, `sample_preview_complete` (실제 생성과 구분) |
| 결과/공통 조건/복구 | `result_view`, `result_approve`, `result_mark_stale`, `configuration_commit`, `deletion_undo` |

캔버스 드래그는 시작·종료·취소와 확정 시점의 최종 좌표만 기록한다. 단순 선택은 drag_cancel로 끝나며 배치 수정으로 세지 않는다. 카메라 방향 슬라이더도 조작 종료 시 한 번으로 묶는다. 유효하지 않은 배치의 payload는 실제 도메인 오류 코드(`pillar-collision`, `door-clearance`, `outside-floor`, `invalid-target-kind` 등)와 대상을 기록한다. Keep 공간에 탈착식 그래픽을 올리는 것처럼 허용되는 겹침을 오류로 세지 않는다. 기본 자료·일반 파일 업로드·미리보기를 통해 실제 모델을 호출했다는 가짜 이벤트를 만들지 않는다.

## ZIP의 12개 파일

| 파일 | 용도 |
|---|---|
| `manifest.json` | 스키마·수출 시각·완료 여부·브라우저 저장·이미지 미포함 표시 |
| `sessions.json`, `sessions.csv` | 익명 번호·조건·과업·시작/종료·시간 |
| `events.jsonl`, `events.csv` | 원시 의미 이벤트 (UTF-8, CSV는 Excel용 BOM과 수식 방어) |
| `initial_conditions.json`, `final_outputs.json` | 시작 조건, 종료 시점의 구조화 조건·시점·결과 ID/출처/승인 여부 |
| `metrics.json` | 총 시간·외부 중단·복구·체류·수정·되돌아가기·오류 이유 분포 |
| `surveys.csv` | 과업 직후 6개 문항·1–5점 또는 미응답 |
| `task_ground_truth_template.csv` | 진행자가 **실험 전에** 채울 정답 조건과 평가자의 0/1·오류 유형 양식 |
| `interview_notes_template.csv` | 별도 인터뷰·정성 코드 양식; 가짜 메모 없음 |
| `README.txt` | 전달 방법, 해석 범위와 미구현 비교 조건 |

개인 원본 이미지와 도면, 업로드 파일명, 결과 이미지 바이너리는 ZIP에 넣지 않는다. 실제 AI 결과를 추가 평가하려면 결과 화면의 이미지 내보내기로 별도 전달하고 익명 세션·결과 ID와 대응표를 진행자가 관리한다.

## 지표 계산과 해석

- Task Completion Time은 시작→완료 전체 시간이다. 숨김/다른 창 상태는 별도 interruption으로 계산한다. 생각하는 시간을 임의로 제외하지 않는다. 재진입 사이 관측 공백은 `unobserved_ms`로 따로 표시하고 총 시간에 포함한다. 서버 검증 시각이나 정확한 작업 시간으로 단정하지 않는다.
- 단계 체류는 enter/exit 구간, Backtrack은 이전 작업 단계로 간 횟수다. 프로젝트 목록 열기는 Backtrack에 넣지 않는다.
- Review Correction Loop는 Review에서 나가 **실제 조건 또는 카메라를 수정하고** Review로 돌아온 횟수다. 단순 왕복을 수정 루프로 세지 않는다.
- 복구 시간은 첫 미해결 `placement_invalid`→다음 `placement_commit` 간격이다. 반복 오류를 별도 횟수로 세며 아직 해결되지 않았으면 `unresolved_invalid:true`를 남긴다.
- Revision Count는 실제 변경이 있는 조건 저장, 유효 배치 커밋, 카메라 저장의 합이다. 저장하지 않은 초안·취소·카메라 슬라이더의 모든 프레임을 수정으로 세지 않는다.
- Coverage/Omission/Misconnection은 **null**과 `requires_ground_truth_and_human_coding` 상태로 둔다. 진행자가 과업 정답을 작성하고 평가자가 문서의 오류 분류로 코딩해야 한다. 형상 검증 성공이 생성 이미지의 조건 정확도 판정은 아니다.

본 비교 실험을 시작하기 전에 자유 텍스트 조건, 동등한 A/B 자료, 교차 순서, 평가자 코딩 절차를 준비하고 2–3명 파일럿에서 기록·ZIP 제출을 확인한다. paired 비교·중앙값/IQR·효과 크기 등 분석 방법은 이 문서의 근거 PDF 계획을 따르되 이 앱이 분석 결과를 생성한 것처럼 주장하지 않는다.

## 2026-09-29 편집·배치 확장
최종 조건에 `Area.outline`, 요소 `origin:'basic-support'`, `fixture-surface` 상대 연결과 현재 카메라 배열을 포함한다. `targetPayload`는 진열 상품의 support ID와 상대 위치를 기존 target 연결 이벤트에 기록한다. 여러 시점 생성은 이미지별 UUID의 기존 `generation_request/complete/fail` 이벤트를 기록하고, 카메라 삭제는 기존 `camera_remove`에 기록한다. 실행 취소/다시 실행은 복원된 의미 변경에 따라 기존 요소/구조/시점 이벤트가 발생한다. 별도의 정확도 점수나 사용자가 클릭하지 않은 가짜 생성 이벤트는 추가하지 않는다.

일일 생성 한도의 쿠키/서명/브라우저 해시는 실험 기록과 분리된 서버 예약 식별이다. 참여자 번호로 간주하지 않으며 ZIP에 쿠키·API 키·서버 비밀·원본 이미지 파일을 넣지 않는다. 로그는 기존 동의/브라우저 로컬/실제 ZIP 제출 계약을 유지한다. 횟수 상한의 변경은 무료 텍스트 비교·서버 실험 데이터 수집을 추가하지 않는다.

## 가이드와 연속 과업 확인 · 2026-09-29
참여자 안내는 [USER_GUIDE.md](USER_GUIDE.md), 진행 준비·과업 초안·평가 범위·소개영상 구성은 [EXPERIMENT_RUNBOOK_AND_VIDEO.md](EXPERIMENT_RUNBOOK_AND_VIDEO.md)를 참조한다. 공개 사이트 `/guide/index.html`과 `/guide/user-guide.pdf`에는 참여자 안내만 배포한다. 진행자 문서의 답안 기준이나 영상 촬영 메모는 공개 가이드에 넣지 않는다.
A/B는 원 기획의 자료 과업 예시(화장품 팝업/라이프스타일 전시)이며 자유 텍스트/구조화 방식과 별개의 축이다. 현재 구현은 structured 하나이며 자료 세트 자동 전환이나 완전한 비교 실험이 아니다. 기획 PDF의 방법 순서 교차 예시는 과업 순서까지 완전히 균형화한 설계로 주장하지 않는다.
요소 생성과 동시에 위치를 지정했을 때도 `element_create`에 이어 실제 연결을 담은 `placement_commit`을 한 번 기록한다. 별도 포인터 이동을 요구하거나 가짜 drag 이벤트를 만들지 않는다. A 종료 → B 시작 시 새 B 세션의 ZIP을 기본 선택하고 재진입·종료·설문·실제 ZIP을 확인한다.

## 레이아웃 우선 흐름의 기록 호환 · 2026-10-01

기존 세션/이벤트 schema 1과 기록 동의·종료·ZIP 전달은 유지한다. 새 시작/종료 조건에는 workflow_version=layout-first-v2 및 reference_bindings를 추가해 이미지 영역과 다중 대상 관계를 추적한다. 이전 저장 기록을 소급 변환하지 않는다. layout_item_add에는 내부 요소 유형·layout_kind·정규화 위치, reference_binding_apply에는 target_count, 해제에는 reference_binding_remove를 기록한다. 이미지·파일명·비밀키는 로그에 포함하지 않는다. 단계 이동의 뒤로 돌아가기는 새 실제 순서(배치 → 레퍼런스)를 따른다. 이전 방식과 새 방식의 세션을 동일 UI 버전으로 섞어 해석하지 않는다. 자유 텍스트 비교·서버 수집·자동 정확도 채점은 이 변경으로 추가되지 않는다.
