# Acceptance test matrix

## 13개 화면 주석·2초 알림 회귀 · 2026-10-01 (최신 검사)

- 전체 28개 파일/229개 테스트, lint, 프론트·서버 TypeScript 및 production build 통과. 이번 추가 7개 테스트는 바인딩 해석 원자적 변경, 출처/crop/대상 유지, 천장·회전된 상품 호스트 이동과 잘못된 위치 거부를 검사한다.
- `scripts/qa-workspace.mjs`: 격리 Chrome에서 학교 공간 → 오른쪽 영역 그리기/설명/선택 속성 → 4개 전시대·천장 조명·상품 지지대 → crop+Shift+실제 HTML drag/drop → 같은 매핑 탭 내용 변경 → 잠금·충돌 검사 경로를 통한 이동/undo/redo/reload → 생성 전 요약/결과 탭 비활성 → 모의 응답 결과/부분 수정/stale/history → 삭제/X/2초 이후 복구를 수행했다.
- 실제 안내의 X 즉시 닫기와 2200ms 뒤 DOM 제거, 알림 만료 이후 Ctrl+Z 삭제 복구를 확인했다. 단순 알림이 공간/배치/결과 상태를 지우지 않는다.
- 12장 기존 자료를 삭제 없이 읽고 신규 업로드를 차단하며 3열·3행 미리보기, 전체 보기 12장·선택·Escape·고정 X를 확인했다. 1575×884/1280×720/1070×671에서 적용 버튼과 범례가 창 안에 있고 가로 스크롤/문서 overflow/JS 오류가 없었다. 범례를 열어도 도면 높이는 같다.
- `scripts/qa-prototype.mjs`에서 20/8 경계·초과 과거 자료 보존·시점 장애물 대안·눈높이/undo/reload를 재검사했다. 가벽 A/B 선택·양면 매핑·사진 삭제 Undo·구조 잠금·영역 편집·구형 reload·실제 사전 제공 샘플 열기도 격리 브라우저에서 통과했다.
- 유료 이미지 요청 0회. 모의 응답은 전송 데이터·결과 보관·부분 수정 검사이며 실제 생성 이미지 품질 증거가 아니다. 기존 >500kB JS bundle 경고는 남는다. 검증 범위에서 새 차단 오류는 발견하지 않았다.

## 제목 행의 진행 표시 검증 · 2026-10-01

- 격리 Chrome에서 1575×884, 1440×900, 1280×720, 1070×671 각각의 공간/레이아웃/레퍼런스/생성 전 확인 화면을 검사했다. 진행 표시는 같은 제목 행에서 이동 버튼 왼쪽에 있고, 단계명·버튼의 겹침이나 문서 바깥 스크롤은 없다.
- 단계 클릭, 키보드 Enter, 새 제목으로 초점 이동, browser Back/Forward, 새로고침과 프로젝트 상태 보존을 확인했다. 각 화면에는 네 단계와 현재 단계 한 개만 표시한다.
- 기존 27개 파일/222개 테스트, lint, 프론트·서버 TypeScript 및 production build 통과. 유료 생성 요청 0회. 기존 큰 JS bundle 경고는 유지된다.

## 최종 UT 단순화 검증 · 2026-10-01 (최신 결과)

- 전체 27개 파일 / 222개 자동 테스트 통과. lint, 프론트·서버 TypeScript, production build 통과.
- 추가 29개 테스트: 19→20/20→21, 구형 >20/8 유지, 7→8/8→9, 반복 연결 count, spatial/passage, 도구에서 floor/ceiling 숨김, 추천 시점 유효 위치·가벽/가구/문 여유 회피·다양성·마이그레이션·높이/stale·로그·노출 단계.
- 실제 격리 Chrome: 학교 자료 → 전시대4/테이블/의자/조명/영역 → crop+Shift/HTML drop/벽·전체 연결 → 추천3/선택 시점 편집 → 모의 응답 결과/부분 수정/로그. 가벽 A/B·삭제 Undo·속성·잠금·구형 reload·사전 제공 샘플도 통과.
- 별도 실제 화면 검사: 20/8 버튼·업로드 비활성, Undo/Redo·reload, 구형23개/9장 보존, 가벽으로 막힌 입구 대안, optional 눈높이 같은 ID·복원, 새 업로드의 종횡비/이전 표시 제거/실내 윤곽/Undo/Redo.
- browser harness: scripts/qa-prototype.mjs (격리 프로필, 유료 생성 불가). 1070×671/1280×720/1600×900 문서 overflow·JS 오류 없음.
- 유료 모델을 이번 작업에서 호출하지 않았다. 모의 응답은 AI 품질 증거가 아니며 실제 도면 재현·서로 다른 시점 품질은 별도 검증 대상이다. build의 기존 >500kB bundle 경고는 남는다.
- 상세/UT 전 확인 사항: PROTOTYPE_FINAL_REVIEW_20261001.md.

## 레이아웃 우선 4단계 최종 회귀 · 2026-10-01

- 24개 테스트 파일 / 193개 테스트, lint, 프론트·서버 TypeScript 및 production build 통과.
- 격리된 실제 Chrome에서 학교 공간부터 전시대 4개·테이블·의자·조명·영역 배치, 영역 다중 매핑(1·2·4), 실제 HTML 드롭, 벽/전체 조명 연결, 시점·검토·테스트 응답 결과·부분 수정과 로그를 확인함. 새로고침/history/연결 해제/되돌리기/다시 실행을 확인함.
- 가벽 A/B 면 부착·반대 면 연결, 이미지 삭제 복구와 레이아웃 보존, 위치 고정, 영역 이름·크기, 구형 프로젝트의 실제 수정 저장, 사전 제공 샘플 열기를 추가 확인함.
- 1070×671, 1280×720, 1600×900에서 문서 외부 overflow와 JS 오류가 없음. 캔버스 구조는 알림에 밀리지 않음. 카메라 방향은 편집에서만, 검토/결과는 위치만 표시함.
- 유료 이미지 호출은 실행하지 않음. mock 결과는 테스트 브라우저에만 저장되며 실제 AI 공간 재현 품질은 이 검사 범위에 포함하지 않음.
- 상세 파일·마이그레이션·경계는 `LAYOUT_MAPPING_REFACTOR_20260930.md` 참고.

## 생성 버튼 비활성화 진단 · 2026-09-30

- 프로덕션 `/api/status` 읽기 전용 확인: 서버 사용 가능, 공용 59/60회 남음, 처리 중 아님. 익명 브라우저 기준 잔여량은 해당 브라우저마다 다르므로 별도로 표시한다.
- 새 학교 졸업전시와 같은 공간 팝업 시작 예시에서 모든 참고 요소가 처음에는 미적용 상태여서 생성 버튼이 비활성화됨을 재현했다. 이는 사용자가 요소를 직접 선택하는 4단계 계약과 일치한다.
- 검토 화면의 생성 영역에 첫 필수 조건과 바로 수정하는 경로를 표시한다. 격리된 브라우저에서 수정 링크가 참고 요소 화면으로 이동하고, 벽 그래픽 하나를 적용한 뒤에는 조건 오류 없이 버튼이 활성화됨을 확인했다. 유료 모델 호출은 실행하지 않았다.

## 가벽 양면 부착 회귀 · 2026-09-30

- 가벽에 포스터·벽 부착 제품을 배치할 때 A/B 면을 선택한다. 인접 공간 영역이 저장돼 있으면 공간 이름도 보여 준다. 기존 면 미지정 배치는 임의 변환 없이 생성 전 확인에서 수정으로 연결된다.
- 도면의 선택 면 표식, 배치 목록, 검토, 결과 조건, 저장 후 새로고침, 생성용 평면도 및 선택 시점별 프롬프트가 같은 면을 나타낸다. 반대쪽 시점의 프롬프트는 해당 부착물을 숨기도록 명시한다.
- 한 가벽의 같은 구간에 앞뒤 별도 부착은 허용하고 같은 면의 중복은 거부한다. 가벽에서 다른 벽으로 옮기면 면을 다시 고른다. 기존 벽·Keep의 배치 동작은 유지한다.

## 도면 가시성·수정 회귀 확인 · 2026-09-30

- `npm test`: 22개 파일, 180개 테스트 통과. `npm run lint`, `npm run build` 통과. Vite의 500 kB 청크 경고는 남아 있으나 빌드 실패는 아니다.
- 격리된 Chrome 1440×900에서 학교 졸업전시 신규 프로젝트를 열었다. 잠금 해제 버튼을 누르면 사용자가 제공한 `open-lock.svg`로 바뀌는 것을 확인했다.
- 공간 영역을 추가하고 이름·폭을 변경한 뒤 새로고침해 값이 남는 것을 확인했다. 동일한 영역을 다시 추가할 때 저장이 막히고 도면 표면의 높이가 변하지 않았다.
- 검토 화면에서 카메라 도면을 확인했다. 조건 문제의 `수정하기`는 참고 요소 화면으로 이동했고 브라우저 뒤로 가기로 검토 화면에 복귀했다. 시점 2개를 추가해 총 3개가 서로 다른 바닥 위치에 배치되고 시점 검증 오류가 없음을 확인했다.
- 기존 카메라를 도면 중앙으로 옮긴 뒤 `입구 기준 위치 제안`으로 다시 입구 근처의 유효 바닥에 배치했다. 이미 저장한 카메라 위치는 자동으로 덮어쓰지 않는다.
- 이번 검증에서는 유료 AI 이미지 생성을 다시 실행하지 않았다. 화이트보드 보존 문구와 옆 벽 그래픽 배치의 실제 생성 결과는 이전 1회 테스트 이후 추가 검증되지 않았다.

## 네 단계 사용자 평가 회귀 · 2026-09-30

1. 첫 화면에서 한국공학대학교 프로젝트룸의 졸업전시 사례가 주 예시임을 읽을 수 있고, 기존 공간 사진과 미실측 도면의 출처·역할이 구분된다. AURA 팝업은 보조 예시다. 학교 사례에 기존 팝업 이미지가 학교 공간의 결과로 표시되지 않는다.
2. 페이지 진행 표시는 정확히 네 단계다. 기존 Keep·배치·시점·조건·결과 기능과 URL은 단계 내부에서 접근 가능하다. 각 단계의 기본 다음 버튼으로 추가 설명 없이 결과까지 진행할 수 있다.
3. 참고 이미지 2~3장에서 선택한 항목만 적용 조건에 들어간다. 선택, 제외, 배치, 시점 선택을 앞뒤로 이동·새로고침해도 유지한다. 결과에서 한 항목만 수정하면 기존 이미지와 그 조건 스냅샷은 보존되고 새 시안은 새 조건을 사용한다.
4. 데스크톱 실제 브라우저에서 처음부터 끝까지 수행하고 뒤로 가기·앞으로 가기, 키보드 초점, 주요 버튼 문구, 상태 저장을 확인한다. 유료 이미지 테스트는 승인된 한 장만 실행하고 그 결과가 실제 생성인지 출처를 검증한다.

이전의 7개 내부 화면 회귀 항목은 위 네 단계의 하위 기능 수용 기준으로 유지한다.

## Space drawing regression cases · 2026-09-28

- Window/door/entrance tools name and highlight the host wall on the visible plan. Wall name/line click changes the host without adding a zero-length opening; a nearby start and off-line drag snap to the same wall. Empty-floor and tiny gestures explain the next action beside the canvas.
- A successfully drawn point/segment/rectangle is saved without changing the current drawing tab/tool. Repeat drawings work; only an explicit user action ends the mode. Escape, canceled pointer capture and switching tools or projects cancel unfinished geometry. Numeric alternatives run the same validators.
- Only released structures without locked attached children show movement labels and dashed strokes before selection. Drag both shape/line and label; retain size, direction and initial grab offset. Arrow keys move the selected structure. Plans with all structures locked give an accurate no-movable-structure state.
- Reject a duplicate pillar/wall/light, occupied wall opening and same-kind identical area. New passages cannot cover physical floor items, pillars or walls. A rejected drawing leaves the plan unchanged.
- Two physical floor items cannot overlap; wall decorations cannot share the same span; ceiling fixtures cannot reserve overlapping zones. Floor-vs-ceiling, ambience layers, smaller named scopes and allowed removable graphics on a Keep wall remain valid. Invalid edits retain the previous valid target.

1. Start without credentials and create/open sample project; every page works, no pretend AI invocation. No map UI/routes/data/dependencies.
2. Add existing-space image, inspiration mood image and product image; each shows distinct role; user cannot mistake a mood image for measured plan.
3. Add/load schematic plan and label its unmeasured status; its four starting boundary walls have mandatory Keeps. The Space screen distinguishes a prepared sample, a user-started schematic and an uploaded plan, explains that no geometry is inferred from photos/uploads, and offers working structure and usable-floor/passage actions beside the plan. The canvas stays visible when switching structure and area tools. Verify point click, segment drag and rectangle drag each commit a visible, validated result; invalid drawings leave prior geometry intact with a reason. Place further structural wall/window/door/pillar; register each as original mandatory structure or removable partition as appropriate. Numeric coordinates remain a keyboard alternative. Keep selections persist across navigation.
4. Original shell walls, pillars and existing ceiling lights start preserved. Toggle off/on with pointer and keyboard, confirm active Keep and geometry locks synchronize, remembered descriptions/permissions survive, and explicit off survives reload and sample migration. While on, drag/delete is blocked; while off, direct plan correction works in Space, Keep and Placement. Existing-light tone remains editable. Openings stay attached to their wall; locked child openings explain why a released parent cannot move. A removable partition can be edited or removed only within usable floor and subject to furniture, pillar, entrance and passage conflict checks. Wall Keep + removable wall graphic is accepted. Kept wall demolition is rejected. Fixture overlapping kept pillar or obstructing door is rejected with informative text. These cases need pure-function tests.
5. Select furniture: only floor target enabled, wall target rejected; select wall graphic: only wall enabled, floor rejected; ambient lighting: entire room/area allowed, isolated point disallowed. All registered usable floor areas and a whole-space condition appear in the plan. The reference-derived ambient card is clearly distinguished from a fixed existing light. Changes are reflected in inspector, plan overlay and review, even after zoom. A valid placement that has a Keep surface-treatment warning waits for explicit review/confirmation rather than silently saving.
6. Reference exclusions never appear as applied elements or in the placement list. Saved apply/exclude and appearance/material conditions and type display as text in Reference and Placement until “조건 편집” opens draft fields in Reference. Cancel leaves prior values intact; Save changes only the selected element, and changing its type clears only an incompatible placement while preserving a compatible one. Missing target blocks generation/preflight and links to the offending element; missing references link to Reference and Keep conflicts link to Keep.
7. Set primary camera inside space, persist direction; optional second view starts on a validated usable floor point and retains the same common plan settings. Reject addition clearly if no valid start exists. Older saved invalid camera positions show an inline inspector reason. Common edit marks old results stale; camera-only edit only stales that view's outputs.
8. Demo result clearly identifies sample provenance; no claim of generated image or perfect multi-view consistency. Partial revision preserves unedited conditions.
9. UI at 1440/900 and 1280/800: the complete initial plan interaction surface is within the viewport, with a left step rail and title-adjacent task controls; no horizontal body overflow. At 1000–1199px keep adjacent panels and horizontal step navigation; panels collapse independently. At 768px the plan remains full width above both editor panels even with both expanded, with no overlap; Space puts the plan before photos. At 390px the same task controls form one bottom action bar with >=44px hit height, and the list fallback is available without first opening a hidden panel. Both side panels collapse independently and the canvas resizes. Current step is brought into view in narrow horizontal navigation. Body text meets readable size, desktop primary editing hit areas are at least 40px, focus moves to the new page heading, alternative text and controls accessible. Mobile camera body and rotation hit regions remain distinct and large enough for direct dragging. Header/navigation stay outside the scroll boundary; focused/scrolled wall/window targets remain reachable inside their owning panel.
10. Colors, spacing and text styles come from tokens. Exactly one visual primary action per main context; icon assets only official free Nucleo SVG files enumerated by actual manifest with exact official module/file provenance and license. Missing icons are text-only, never substitutes.
11. Run available lint, typecheck, unit tests and production build; fix failures. Inspect rendered screenshots at desktop, tablet breakpoint and narrow width. Reject/quarantine malformed persisted plans, nested collections and result snapshots without crashing or overwriting their raw record. Check that the production build contains no user-provided Paperlogy font binary and still renders with the Korean font fallback. Report unimplemented parts as unfinished, not complete.
12. On the plan, drag a placed compatible floor item and rotate it with the visible handle; dragging begins from the current position without jumping to the pointer. Camera markers appear only in Viewpoint alongside structure and applied elements, where a recognizable labeled body drags position and a separate labeled handle rotates direction; empty-floor clicks do not move the camera. Camera placement rejects rectangular or circular pillar overlap and applied floor fixture occupancy. Structure-only Space/Keep views and structure+element Placement views omit camera markers without changing saved viewpoints. Commit valid edits to the inspector and layered plan; reject invalid edits without losing the prior valid target. Nonmovable structures in Viewpoint are not fake keyboard buttons or drag affordances. Click-to-place uses a pointer cursor; only an actual region-drawing gesture uses a crosshair. Numeric input remains an accessible alternative. Read-only plan regions allow touch page scrolling.
13. Multiple existing-space photos, history entries and approved images have current/total position, previous/next controls and drag navigation without a visible lower scrollbar. Existing photos center vertically; active photo and approved image center horizontally with small previous/next previews only when available. Check first, middle and last item as well as pointer and keyboard navigation; Tab focus on a slide synchronizes its selected count, and reduced-motion preference prevents forced smooth scrolling.
14. Preflight provides a first-pass synthesis based on saved preservation, apply/exclude, placement and camera conditions without claiming image generation or a guaranteed visual result. New sample preview and saved result history are separate actions with distinct labels.
15. A noncritical status notice remains readable for three seconds, then fades out; its close control removes it immediately. Blocking validation and save-failure alerts persist across step navigation until dismissed or resolved; preflight issue rows link to the affected editing step. Reduced-motion preference does not hide essential information.
16. A read-only generation status request incurs no model charge. Without server credentials, the same seven-step sample workflow remains usable and no AI result is claimed. When configured, Review shows one paid AI action beside a clearly separate free sample action, the selected camera and selected existing-space photograph, one-sentence image guidance, and transmitted roles/cropped reference behavior in an optional disclosure. No per-image API price, technical resolution, “비용 발생” suffix or provider pricing link appears in the main participant panel. “생성 가능 여부 확인” refreshes availability/quota with disabled loading feedback and cannot create an image. One reference source with more than four distinct selected regions is rejected before a paid call. A missing/invalid request UUID, cross-origin request, exhausted or unavailable shared quota, invalid project or oversized/wrong-role payload is rejected before a provider call; one action creates one image request per selected camera; the whole batch is guarded against duplicate clicks. A definite provider error leaves all prior result versions intact. For an uncertain sent request, paid retry stays locked for 180 seconds and resumes only after an explicit acknowledgement; the free sample still works.
17. A successful live response is labeled AI generated, stored as an IndexedDB asset with only its `asset://` URI in localStorage, downloadable with its actual MIME extension, and linked to the click-time condition snapshot containing the selected existing-photo ID. Older results without that ID remain readable and do not claim an input photo. If common conditions or camera position, heading or field of view change while the request is running, the new output is marked stale without overwriting current settings. Older snapshots without a field of view remain readable as the standard preset. If project-record storage fails after image generation, the result stays visible in memory with a persistent cost warning, image download and save retry, even when the user opened another project during generation. Generated images are not described as measured or guaranteed to satisfy Keep and circulation. Confirm the production bundle contains no API key, access code, user font binary or `.env` file. Verify the deployed status endpoint and UI separately from the local Vite demo; make no paid smoke test without an explicit cost decision.

18. Upload a reference, cancel/confirm its deletion, delete the last reference and undo. Confirm selection and empty state stay usable. Deleting a reference removes only its current associated image/derived elements, preserves previous result images/snapshots and marks them stale. Standalone element deletion retains its source and cleans extraction links. Undo remains available after the success notice fades, restores source display and conditions, and never rolls back revisions or result history. Verify unused original cleanup after dismissing undo and retention when history uses the asset.
19. A released pillar or ceiling fixture has a genuine hit area and moves without a jump. Reject new wall/item/door/passage/camera conflicts without changing prior geometry. Parent wall+unlocked opening move together; locked child yields an actionable reason. Re-lock removes the affordance. Structure selection cannot accidentally place a previously selected element. Confirm editable geometry is present in the generation contract and no unconditional preservation wording overrides the user's off choice.
20. Verify delete confirmation focuses Cancel, Escape and cancellation return focus, upload controls show/disable busy state, action rows wrap, and the left Placement list scrolls independently without stretching the plan. Follow an element to its original reference and inspect historical source/location attribution after deletion. Audit against the verified 14-page PDF and its final five pages; record which statements are source-supported and which are implemented UX decisions.


21. Show actual structure names and a single official lock icon for Keep on both plan and photo; no Keep numbering. Verify named wall/opening labels at 1440/1070/768/390px. Save two structures and two areas in succession without leaving their current tab. End drawing only by explicit action.
22. Browser Back/Forward follows step clicks and project changes. Direct project/step routes and reload restore the correct saved project and selection; invalid IDs do not overwrite local projects.
23. No experiment logs before opt-in. Start with anonymous ID and task A/B, commit/edit/cancel/place/reject/recover/review, reload, complete and answer six survey items. Download and independently unzip the actual ZIP; check UTF-8/CRC/12 files and no original pixels/filenames/credentials. Record unknown server time as null. Accuracy scores require human coding, and free-text comparison remains explicitly unimplemented. Continuous camera slider edits count once, and a mere Review round trip is not a correction loop.

24. Direct AI generation requires no API key/code/link input. Test racing server instances with a shared CAS store, duplicate IDs after completion, service-wide 60/day and signed anonymous-browser 20/day Korean-midnight caps, preserving cross-day replay claims, crash lease expiry, stale release and no refund. Verify the deployed private counter survives deployment and invalid input consumes no quota. Status refresh shows remaining counts. Provider/storage network faults never trigger automatic model retries.

25. Verify final Figma v1.3 hierarchy and reconciled Design System v1.2. On desktop, the central Placement/Viewpoint panel occupies at least 50% of its workspace. Keep uses a dominant plan and a selected-object photo/inspector. Expanded numeric alternatives retain their keyboard paths; detailed review conditions remain accessible; free sample, paid generation and saved history remain distinct. Source and target names wrap at >=14px; deletion uses restrained error color; actual keyboard focus, hover, pressed, disabled and loading states are visible. Photo and approved carousels remain centered at first/middle/last positions after resizing. Check reduced motion and forced-colors fallback. Record actual runs in QA_DESIGN_UPDATE_20260928.md.

26. At 1440×900, 1280×800, 1113×697, 768×900 and 390×844, all seven routes retain a viewport-sized shell, zero document scroll and no horizontal overflow. Wheel over page chrome cannot move the page; long panels/stacked workspaces and keyboard focus still reach all controls. Show/fade/close a success notice, show a blocking error and use deletion undo without changing canvas bounds. An error persists after three seconds and navigation stays clickable. Project/study details open without shifting the plan; their top and bottom stay within the frame, including a long study survey. Closed result collections can be opened and their arrows, drag and keyboard paths still work. During reference region selection the preview keeps its aspect ratio and bounding box, and the normalized crop matches the gesture after resizing. Run lint/typecheck/tests/build and rendered regressions; record actual outcomes in QA_VIEWPORT_20260928.md.

## 2026-09-29 추가 필수 검증
27. Fresh portrait upload has no sample rectangle/anchors, retains history and supports deletion undo. Explicit retain choice is distinct. Manual concave polygon persists; cameras/physical footprints outside its interior are rejected. Continuous drawing retains tool, vertical/horizontal correction respects locks, rect/circle sizes are user-selected. Validate opening–pillar collision in either drawing order.
28. Product photo defaults to `display-product`, needs an explicit support or user-added basic support and can overlap that support. Moving/rotating support carries products; exclusion/deletion/type change releases dependent target. Other typed categories reject incompatible anchors. Reference panel contains only focused source, selected card first/sticky title; deletion undo and source/history attribution still work.
29. Keep lock toggles by pointer and keyboard, preserves geometry. Removable art/light placement on a kept wall needs no repeated confirmation; replacement/opening/pillar/passage collisions remain blocked. Wall drag transfers only to connected compatible walls, preserves physical span and restores the old target on invalid release.
30. Canvas Ctrl+Z/Shift+Z undoes/redoes saved structure/area/element/camera edits and local polygon vertices; does not hijack native input editing. Camera deletion preserves images, primary fallback works and last-camera deletion blocks generation. Overlaid error does not change canvas bounds or saved data. Clear scrollbar track retains scrolling affordance.
31. Several checked views create one unique request/result each, with button locked through the batch; completed images survive later failure. UI capacity uses selected count and server reserves per request. Applied reference sources are unrestricted and every source/crop is in the contact-sheet manifest; missing/reordered manifests stop before provider. No extra paid call for image packing.
32. Signed anonymous browser cookie makes its quota stable across status/reload, distinct between browsers, and requires no participant key/code/login. Both counts reset at KST midnight based on server time; deployment does not reset records, requests never replay across days, old current-day usage remains shared. Strong-storage faults stop before any model call. Verify actual production read-only status/cookie separately from mocked provider tests.

Actual current results are recorded in QA_SPATIAL_BATCH_20260929.md; older dated QA files describe their original versions.

## 적용 범위 연결 / 다수 영역 가시성 수용 기준 · 2026-09-29
- 등록 시 두 번째 조명 분위기를 특정 영역에 연결하고 기존 전체 공간 조명이 그대로 유지되어야 한다. 참고 이미지와 배치의 선택기가 같은 위치를 저장하며 새로고침·조건 snapshot·생성 프롬프트에서 실제 영역 연결을 유지한다.
- 천장 조명은 천장 영역만, 벽 조명은 벽만, 스탠드 조명은 바닥 점만 허용한다. 동선은 조명 분위기 연결 대상이 아니다. 점유된 천장 영역은 선택 불가 이유를 제공하고 미지정 상태를 임의로 전체 공간으로 바꾸지 않는다.
- 영역 추가 버튼은 해당 그리기 도구를 명시적으로 연다. 실제 드래그 저장 후 탭/도구가 유지되며 새 영역이 위치 연결 옵션으로 나타난다.
- 20개 이상의 중첩 영역에서 기본 이름표는 선택 하나, 선택한 적용 범위만 강조, 나머지는 흐리게 표시한다. 전체 이름표 옵션의 표시 이름 간 충돌을 회피하고 모든 실제 이름은 목록으로 읽는다. 종류 필터는 저장된 프로젝트/수정 버전/연결을 바꾸지 않는다.
- 1440/1070/390px에서 팝업 경계와 모든 목록 컨트롤이 화면 안에 있고 바깥 페이지 스크롤이 없어야 한다. 표시 팝업은 Escape/바깥 클릭으로 닫고 키보드 진입/복귀를 지원한다. 짧은 공간 준비에서도 캔버스 전체를 내부 작업 스크롤로 확인할 수 있어야 한다.
- 기존 Keep·단축키·배치·카메라 삭제·다중 시점 생성·참고 이미지 삭제/되돌리기·실험 ZIP 회귀를 확인한다. 실제 유료 모델 호출 없이 브라우저 요청을 모의 응답으로 검사한 결과는 실제 이미지 품질 검증으로 기록하지 않는다.

## 이동 제한 범위 / 미리보기 수용 기준 · 2026-09-29
- 공간 준비·Keep·배치·시점 모두 등록된 동선, 여닫이 clearance, 바닥 경계와 실제 물체 점유 윤곽을 보여준다. 표시 필터로 동선을 숨길 수 없으며 구조/요소 레이어를 꺼도 최소 장애물 윤곽을 유지한다. 표시만 변경할 때 저장 데이터/수정 버전이 바뀌지 않는다.
- 보존을 해제한 기둥과 바닥 진열대를 동선에 드래그하여 놓기 전 붉은 후보/실제 이유를 확인한다. 미리보기/거절 후 저장 위치와 캔버스 bounds가 동일해야 한다. 정상 위치는 놓을 때 한 번 저장한다. 정상 저장 후 이전 도면 거절 안내를 제거한다.
- 기둥/가벽 편집 중 실제 카메라 위치 제한은 읽기 전용 marker로 확인한다. 관련 없는 요소 편집에서는 시점 marker/조작을 숨긴다. 카메라는 동선에 이동 가능하고 실제 기둥/진열대는 피한다. 거절 시 시점 위치가 유지된다.
- 이름표가 실제 범위에서 밀리면 연결선을 보여준다. 작은 화면에서도 protected 범위의 윤곽을 접지 않으며 기본 분위기 영역 이름은 선택 하나만 보여준다. 상시 빗금 설명은 도형을 덮지 않는다. 피드백/거절 overlay는 화면 요소를 밀지 않는다.
- 1440/1070/390px에서 실제 pointer drag, 표시 팝업 키보드 진입/종료, 기존 영역 연결/Keep/되돌리기/벽 전환/다중 시점 생성 흐름을 확인한다. 실제 유료 모델을 호출하지 않은 검증은 이미지 품질 테스트로 기록하지 않는다. 실행 결과는 QA_MOVEMENT_VISIBILITY_20260929.md 참조.

## 여러 시점 연속 생성 회귀 · 2026-09-29
- 진행 중 잠금 해제보다 응답이 먼저 종료되던 순서를 재현한다. 지연된 완료 쓰기가 끝난 뒤 정상 응답이 나가고, 응답 수신 즉시 다른 카메라를 요청해도 실제 quota ledger에서 409 없이 접수되는지 확인한다. 같은 UUID는 여전히 재실행하지 않는다.
- 완료 저장소 오류/CAS 충돌/8초 이상 지연에도 예약 기록과 이미 받은 이미지 응답을 보존한다. 지연된 해제가 다른 요청의 잠금을 제거하지 않아야 한다.
- 3개 시점 선택 후 첫 이미지 저장→서버 처리 중 상태→준비 상태→두 번째/세 번째 이미지 저장을 검사한다. 각 시점별 고유 POST가 정확히 한 번 실행되고 완료 수·다음 이름·중복 클릭 잠금·두 한도의 3회 차감이 일치해야 한다.
- 다음 상태의 한도 소진/503/20초 동안 처리 중이면 첫 이미지를 보관하고 추가 POST 없이 중단한다. 두 번째 실제 전송의 불확실 응답은 첫 이미지를 유지하고 세 번째 요청 및 즉시 재시도를 막는다. 모의 API/이미지를 사용하는 검증은 실제 유료 생성 성공으로 기록하지 않는다.

## 도면 가이드·조명 전이 수용 기준 · 2026-09-29
- 구조/물체 이름, 기존 잠금 40px 클릭·키보드 조작, 모든 모드의 통행/여닫이 윤곽, 표시 팝업, 이동 중 검사, 도면/카메라 되돌리기를 확인한다. 1440/1070/390px에서 바깥 스크롤이 생기지 않아야 한다.
- 실제 클라이언트 요청에 기존 공간 사진 → 저장 배치+선택 시점 가이드 → 적용 레퍼런스 순서의 JPEG가 들어가는지 확인한다. 업로드 배경, 세로 비율, 다각형/회전 물체/진열 상품 좌표, 선택한 카메라만 렌더링하는지 검사한다.
- 가이드 누락/다른 수정 버전/다른 시점은 quota 예약 전 거절한다. 여러 시점마다 서로 다른 가이드와 UUID가 준비되며 첫 결과 이후 후속 생성 회귀도 확인한다.
- 시안 대조는 저장된 조건을 사용한다. 현재 배치 변경/시점 삭제 뒤에도 동일한 비교 도면이 나와야 한다. 샘플/과거 이미지의 정확도를 자동 확인했다고 표시하지 않는다.
- warm ambient-light의 조명 전이와 별도 palette/material 전이를 구분한다. 실제 유료 테스트는 사용자의 비용 승인 후에만 실행하고 단 한 샘플 관찰을 일반적인 구조 정확도 보장으로 기록하지 않는다.

## 사용 가이드·초점·실험 제출 · 2026-09-29
클릭한 버튼/도면/SVG의 기본 검은 outline이 없어야 한다. Tab/Shift+Tab 초점, 입력창 클릭 시 편집 초점, 강제 색상 키보드 초점은 보여야 한다. 1440/1280/1113/768/390 폭에서 상단 가이드를 접근할 수 있어야 한다.
가이드 새 탭·A/B 목차·실제 PDF 다운로드를 확인한다. A 완료 → B 시작에서 새 B ZIP이 선택되고 재접속해 B가 계속 기록되어야 한다. B 종료 후 6문항 응답이 실제 ZIP의 해당 세션에 포함되어야 한다. 생성 시 위치가 지정된 요소도 배치 커밋을 한 번 기록한다.
공개 guide에는 참여자 안내만 포함한다. 정답·촬영 구성·미검증 연구 결론을 참여자 페이지에 노출하지 않는다. 본 비교 실험 준비 미완성과 실제 이미지 품질의 미검증 범위를 최종 보고서에서 구분한다. 문서 목차·표·한국어 글꼴·페이지 잘림을 렌더링으로 확인한다.
참고 이미지가 없는 새 프로젝트 또는 마지막 이미지 삭제 뒤에도 빈 상태 안내·업로드·비활성 요소 추가·삭제 복구가 동작해야 한다. 선택 이미지와 위치 초안이 모두 있을 때만 초안 매핑을 읽는다.

## 4단계 졸업전시 흐름 실행 기록 · 2026-09-30

- 1440×900 격리 브라우저에서 학교 졸업전시 시작 → 참고 이미지 3개에서 요소 선택 → 전시대 바닥 위치 50%, 50% → 기본 시점 → 생성 전 확인까지 실행했다. 뒤로·앞으로·새로고침 뒤 배치 위치가 유지됐다. 뒤로 간 배치 화면에서 전시대 X를 50%에서 60%로 바꾼 뒤 생성 전 요약에도 60%가 반영됐고 페이지 스크립트 오류는 없었다.
- 프로덕션에서 같은 조건으로 실제 이미지 1장을 생성해 결과 화면에 저장되는 것을 확인했다. `/api/generate` 응답 200, 호출 원장 사용량 0→1회, 남은 전체 횟수 59회. 앞선 두 409 응답은 원장 조건부 쓰기에서 막혔으며 모델 호출 전에 발생했고 사용량은 0회였다.
- 생성 이미지는 사각형 공간·왼쪽 창·오른쪽 출입문을 대체로 보여주지만 원본 사진의 큰 화이트보드를 전시 그래픽으로 바꿨다. 이후 화이트보드 보존과 다른 벽 그래픽의 위치를 명시하는 프롬프트를 보강했다. **이 보강 뒤의 실제 이미지는 추가 유료 생성 승인을 받지 않아 검증하지 않았다.** 시안의 구조 일치나 실측 정확도를 보장하지 않는다.
- 최종 수정 뒤 `npm test` 177개 통과, `npm run lint` 통과, `npm run build` 통과. 빌드의 기존 500 kB 번들 경고는 남았다.

## 레이아웃 우선 4단계 개편 실행 기록 · 2026-10-01

- 공간·방향 설정 → 레이아웃 구성 → 레퍼런스 적용 → 시안 생성으로 순서를 변경했다. 참고 이미지 없이 전시대·테이블·의자·조명을 배치하고, 이미지 전체/크롭을 클릭 또는 드롭으로 연결했다. Shift·다중 선택 대상에 한 번에 연결하고 연결 변경/해제·삭제 복구를 확인했다.
- 격리 브라우저의 전체 흐름, 가벽 A/B 면, 잠금 해제, 영역 이름/크기 변경, 구형 저장 데이터, 새로고침과 뒤로/앞으로, 실행 취소/다시 실행, 로그와 사전 제공 샘플을 확인했다. 1070×671 / 1280×720 / 1600×900에서 문서 외부 스크롤 및 JavaScript 오류가 없었다.
- 참고 이미지 없는 상품의 기본 전시대 추가와, 전시대 위 상품의 직접 클릭·상품 사진 연결을 수정 후 재검증했다. 정상적인 상품/받침대 겹침을 유지하며 최종 검토에 충돌 오류가 없었다.
- 자동 테스트 24개 파일/193개 통과, lint와 프론트/서버 TypeScript 빌드 통과. 500 kB 단일 묶음 경고가 남는다. 새 개편의 이미지 요청·저장·stale 전환은 격리된 API 테스트 응답으로 검사했으며 실제 유료 생성 품질 검사로 해석하지 않는다.
- 배포 주소에서 4단계, 다중 연결과 재접속, 시점/검토, 생성 버튼 활성 및 서버 생성 가능 상태를 확인했다. 공용 60회/익명 브라우저 20회 일일 한도와 공개 사용 가이드 PDF를 확인했다. 이 QA의 유료 호출은 0회다. 상세 내용: `LAYOUT_MAPPING_REFACTOR_20260930.md`.


## 요소 표시·원본 공간 기준 회귀 · 2026-10-01
- PlanCanvas 자동 테스트: 선택하지 않은 legacy 천장 물체가 배치/매핑/시점에 보이고 숨긴 천장 영역의 hit target은 없다. 명시적으로 선택한 영역은 보인다. 물체와 연출 조건 수가 분리된다.
- planGuide/prompt 자동 테스트: 천장 offset, 바닥 물체 윤곽, wall mapping span이 가이드에 유지된다. 일반/Overview 생성 모두 원본 건축 외관, 비보존 이동식 가구 비우기, 고정/보존 구조 유지, 단일 호출 조건을 포함한다. 다수 레퍼런스의 기존 API 회귀도 실행한다.
- scripts/qa-element-visibility.mjs: 격리 브라우저에서 새 프로젝트 사진 업로드가 도면을 만들지 않음, 직접 만든 개략 도면 저장/reload, 천장 물체 표시, 미배치/제외/없는 받침 표시, 레이어 숨김 시 hit target 제거, 선택 시 전체 보기, 기존 데이터 유지, 원본 사진+도면의 생성 입력 순서와 결과 저장을 확인한다. API 모델 응답은 mock이며 유료 호출과 실제 결과 품질 검증은 하지 않는다.
- scripts/qa-workspace.mjs 기존 흐름도 함께 검증한다. 이 테스트 또한 mock이며 실제 모델 실행을 뜻하지 않는다.
- 이번 수정 검증 결과: 전체 28개 파일의 자동 테스트 237개, ESLint, 앱/API TypeScript 검사, production build 통과. 격리 브라우저의 기존 workspace 시나리오와 요소 가시성/새 프로젝트/생성 입력 시나리오 통과. 이 검증의 유료 모델 호출은 0회이며 실제 이미지 품질은 재검증하지 않았다.

## 2단계 Backspace 삭제 검증 · 2026-10-01
- 격리 브라우저에서 선택 배치 요소 삭제, 이름/숫자 입력 보호, 길게 누름 반복 삭제 방지, Ctrl+Z/다시 실행/새로고침, 구조·영역 보존, 1·3·4단계 비적용, 다각형 그리기 Backspace 유지와 JS 오류 없음 확인. 유료 모델 호출 0회.
- 관련 편집/매핑/저장 테스트 32개, ESLint, 앱/API TypeScript, production build 통과. 기존 큰 JS 묶음 경고는 유지된다.
