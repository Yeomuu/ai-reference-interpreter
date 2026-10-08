# Domain model, valid targets and interaction contracts

## 원본 컴포넌트 상태 정정 · 2026-10-08

분위기 이미지 삭제는 기본 상태에서 숨기고 마우스 hover 또는 키보드 focus-within에서 보여준다. 이미지 윤곽도 원본 Default/Variant2 마스크로 바뀐다. 삭제 버튼은 명시적 한국어 접근 이름과 focus-visible을 갖고 클릭 즉시 기존 삭제/영구 복구 경로를 호출한다. 알림이 사라져도 삭제 복구와 history는 유지한다.

분위기 이미지의 원본 문구에 맞춰 클릭 파일 선택과 native file drop을 모두 같은 검증/저장 handler로 연결한다. 비활성 상태에서는 두 경로 모두 차단한다. 홈 로고로 프로젝트 목록 dialog를 열고 Escape/X로 닫는다. STEP 01은 Next를 sidebar 하단에 유지하며 섹션·구조·목표가 원본 크기로 함께 표시된다. 편집 탭·Shift mapping·카메라 복귀·Undo/Redo는 변경하지 않는다.

## 홈 기본값 수정·화면 정리 · 2026-10-08

프로젝트 이름·공간 유형은 편집 가능한 controlled text input이며 처음 값만 STUDY_START에서 제공한다. 공백만 있는 값·잘못된 참가자 번호는 시작을 막는다. 진행 중 프로젝트 재개 시 사용자가 홈에서 건드린 필드만 공통 revision으로 저장한다. 편집하지 않은 기본값은 저장된 사용자 값을 덮어쓰지 않는다. 기존 기록·배치·결과·복구 계약을 유지한다. 보조 정보 접기와 중복 경고 제거는 표시만 바꾸며 생성 차단 조건·검증·시점 선택은 유지한다.

## 홈 시작·기본 구조·디자인 목표 · 2026-10-07

참가자 번호는 대문자로 정규화하고 P+숫자 2~4자리로 검증한다. 프로젝트명·공간 유형·참가자 번호가 모두 유효할 때 시작 버튼을 활성화한다. prepareStudy가 저장과 기록 시작에 성공한 뒤 전환을 실행하고 중복 클릭을 차단한다. 진행 중 기록은 같은 참가자·프로젝트로 이어가며 다른 참가자 기록은 종료 후 새로 시작하도록 안내한다. 목록 대화상자는 X/Escape로 닫고 기존 프로젝트·새 사용자 공간 작업을 보존한다.

필수 기본 구조는 보존 해제·이동·변형·삭제·문 열림 방향 변경을 허용하지 않는다. 연결된 장식/조명은 기존 typed-anchor 및 Keep-aware 검사로 판단한다. legacy의 명시적 보존 해제 상태는 복원한다.

디자인 목표는 1000자 한도, 입력 blur에서 공통 조건으로 저장한다. 수정은 Undo/Redo와 결과 stale 처리에 포함되며 생성 전 요약·결과 당시 조건에 표시한다. 분위기 이미지 업로드는 4장 한도와 전체 8장 한도를 함께 검사한다. 출입 여유와 통행 동선의 빗금은 서로 다른 색으로 표시한다.

## 캔버스 A/B 면 선택 · 2026-10-06

가벽의 A/B 표시는 부착 면을 고르는 버튼이다. 새 요소 배치·기존 벽 부착 요소 편집·레퍼런스 적용에서 클릭 또는 Enter/Space로 고른 면이 패널 선택과 즉시 동기화된다. 이 선택은 임시 입력이며 기존 벽 구간 적용/레퍼런스 적용 버튼으로 검증 후 저장한다. 면만 골랐을 때 구조·부착 구간·레퍼런스 연결을 저장하거나 변경하지 않는다. 같은 면의 점유 충돌과 반대 면의 허용 중첩을 유지하며 새로고침/Undo/Redo는 저장한 면을 기준으로 복구한다.

## 주석 기반 수정 조작 · 2026-10-01 (우선 적용)

그리기 이름/선 방향/윤곽/붙일 벽은 레이아웃 오른쪽으로 모은다. 선택 물체 크기·회전과 가벽 A/B 부착 면은 계속 편집 가능하다. 매핑 화면에서 클릭은 선택, Shift 클릭/다중 선택 모드는 추가 선택, 3px 이상 끌기는 해당 배치 요소의 이동이다. floor-point/ceiling-zone/fixture-surface는 기존 대상·호스트를 유지하고 벽 부착 요소는 기존 벽 이동 검사를 적용한다. 구조와 분위기 영역 자체를 매핑 화면에서 이동하지 않는다. 잠금·충돌·통행·출입 여유·제품 지지대 조건을 우회하지 않는다.

이미지 전체/선택 crop에서 native drag를 시작하고 기존 대상에 놓는다. 선택 영역 안에서 끌면 적용하고, 바깥 또는 Shift 드래그는 다시 영역을 그린다. 적용 버튼과 다중 선택 방식은 계속 사용 가능하다. 연결 내용 변경은 같은 매핑 현황 탭의 폼에서 원자적으로 검증하고 출처/crop/대상 ID를 보존한다.

결과 탭은 results.length가 0일 때 비활성이고 URL 호환은 유지한다. 일시 안내는 공통 2초/X로 닫지만 저장된 문제·기록·undo는 그대로다. 범례/전체 이미지 목록은 사용자가 펼친 메뉴로, 알림 타이머를 적용하지 않는다.

## 최종 추가 제한과 선택 시점 · 2026-10-01 (우선 적용)

신규 배치 물체 최대 20개, 컨셉·요소·제품 레퍼런스 이미지 최대 8장. 초과 시 물체 버튼/업로드를 비활성화하고 이유를 함께 표시하며 commit 경계에서도 검증한다. 구형 초과 데이터는 그대로 읽고 수정/삭제/Undo 복구를 허용한다. 구조·영역·매핑 조건을 물체 개수로 세지 않는다. 기존 floor/ceiling 대상은 호환하지만 새 영역 도구에는 노출하지 않는다.

camera/review/results는 4단계에 속하고 기본 화면은 review다. 추천 시점은 명시된 바닥·장애물·출입 여유를 검사해 생성한다. 아직 수정하지 않은 자동 추천 위치는 레이아웃 변경 후 4단계에서 필요할 때 복구하며, 숨겨진 임시 추천점 때문에 가벽/기둥 그리기를 막지 않는다. 수동/수정 시점은 자동 이동하지 않고 기존 충돌·수정 경로를 유지한다. 카메라 삭제는 자동 재생성하지 않으며 Undo로만 복구한다.

눈높이·내려다보는 각도는 접힌 추가 설정이다. 여성/남성 눈높이 임시값은 같은 카메라의 높이만 바꾸며 별도 카메라를 만들지 않는다. 높이/각도 변경은 해당 시점의 이전 결과를 stale로 표시한다. 인체치수 근거가 확인되지 않은 임시 평균값 안내를 제거하지 않는다.

## 가벽 양면 부착 · 2026-09-30

가벽의 벽 구간 배치에는 방향이 고정된 A/B 면을 저장한다. 도면의 가벽 시작점에서 끝점으로 볼 때 수직 오프셋의 양쪽이며, 확대·저장·새로고침 후에도 같은 면이다. 배치 속성에서 인접한 공간 이름과 도면의 A/B 표식을 보고 면을 명시적으로 고른다. 면을 지정하지 않은 이전 데이터는 임의로 한쪽에 붙이지 않으며 시안 생성 전에 선택을 요구한다. 같은 가벽 구간의 서로 다른 면에 탈착식 그래픽·제품을 각각 붙일 수 있으나 같은 면의 물리적 중복은 계속 막는다. 선택 면은 배치 목록·검토·결과 조건 기록·평면도 안내 이미지·모델 입력에 보존한다. 선택한 카메라가 반대쪽 면에 있으면 해당 요소를 보이지 않게 하도록 모델에 명시하되, 생성 이미지를 기하학적으로 보증한다고 주장하지 않는다.

## 레이아웃과 이미지 연결 · 2026-10-01

space/keep은 1단계, placement는 2단계, references는 3단계, camera/review/results는 4단계다. 2단계에서 참고 이미지 없이 전시대·가구·조명을 배치한다. 3단계의 클릭은 단일 선택, Shift 클릭 또는 다중 선택 모드는 선택 추가/제거다. 이미지 썸네일 또는 선택 영역을 대상에 끌거나 대상을 선택한 뒤 적용 버튼을 사용한다. 여러 호환 대상은 같은 영역을 한 번에 적용하고, 하나라도 잘못된 대상이면 전체 변경을 거절한다. 조명 분위기는 조명·영역에 적용하며 벽/영역 연결은 실제 구조를 복제하지 않는 표면 조건으로 저장한다.

매핑 현황의 변경·연결 해제는 레이아웃 위치를 보존한다. 이미지 삭제는 연결을 해제하고 현재 배치를 보존하며 이전 출처·결과 및 삭제 복구도 유지한다. 가벽에 새 부착 요소를 놓을 때 A/B 면을 명시한다. 도구 저장은 탭을 자동 이동시키지 않으며 기존 이동·크기·회전·보존 및 충돌 검사를 사용한다. 검토 오류는 실제 수정 가능한 레이아웃/자료/시점 화면으로 연결한다.

카메라는 1~3단계에 숨긴다. 시점 편집에만 방향·시야·회전 손잡이를 표시한다. 검토와 결과 요약에서는 위치만 표시한다. 부분 수정은 이전 이미지·조건 스냅샷을 지우지 않고 이전 조건으로 표시한다. 브라우저 history·reload와 캔버스 실행 취소/다시 실행을 유지한다.


## Document entities
`Project { id, name, spaceType, concept, sourceImages[], floorPlan, keeps[], references[], elements[], cameras[], results[], commonRevision }`.
`SourceImage { id, role:'existing-space'|'inspiration'|'product', uri, name, referenceId?, crop?, note? }`.
`FloorPlan { kind:'uploaded'|'schematic', width,height, units?:'unknown'|'mm'|'m', structures: Structure[], areas: Area[], geometryConfidence:'measured'|'schematic' }`.
`Structure { id, kind:'wall'|'window'|'pillar'|'door'|'entrance'|'ceiling'|'floor'|'existing-light', geometry, connectedPhotoRegionId?, photoAnchor?, role?:'base'|'partition', immutable?:boolean, preservationSettings?, protected:boolean, lightTone?, name }`. `role` records base/partition origin; `immutable` is the user-controlled preservation lock, and `protected`/active Keep also lock edits. Explicit false survives migration and reload. `preservationSettings` retains description and allowed surface treatment while the active Keep is off. `lightTone` remains editable while a light is preserved; releasing its lock allows validated correction of its plan position.
`Keep { id, structureId, intent:'preserve', description, allowedSurfaceTreatment?:boolean }`.
`Reference { id, imageId, role:'ambience'|'element'|'product', note, extractedElements[], exclusions[] }`.
`DesignElement { id, sourceReferenceId, label, kind: ElementKind, status:'apply'|'exclude', target: PlacementTarget|null, appearance?, conditions? }`.
`Camera { id, name, x,y, directionDegrees, fovPreset?, primary:boolean }`.
`Result { id, cameraId, commonRevision, createdAt, imageUri, origin:'ai'|'sample', approved:boolean, stale:boolean, conditionsSnapshot }`.

Coordinates use normalized plan positions plus referenced structure/area IDs; use a stable transform from plan coordinates to screen pixels. Store placement in semantic model, **never raw browser screen coordinates**. Preserve source dimensions and aspect ratio. Recompute hit testing after zoom or canvas resize. The canvas holds plan imagery, structures/Keep, design elements and camera viewpoints as synchronized layers over the same coordinates, but only shows task-relevant layers: structure in Space/Keep, structure and applied elements in Placement, and structure, applied elements and cameras in Viewpoint. Hiding a layer never deletes or changes its saved data. It does not need a generic “도면 이동” mode.

The Space plan explicitly labels its provenance. A prepared sample schematic is authored example data; a new schematic begins from a generic outline; an uploaded plan is the user's image, preserving its dimensions/aspect ratio with no imposed sample rectangle. None is inferred from existing-space photos. An upload does not extract walls, dimensions, usable floor or passages. The plan is the 2D basis used later for Keep, placement and camera coordinates, so the same screen provides direct structure and usable-floor/passage marking actions. Choosing a structure or area tool keeps the plan visible: point structures use a click, segments use a start-to-end drag, and areas use a corner-to-corner drag or a manually clicked polygon outline. Drawn geometry is committed only after normal domain validation, and the coordinate form is a secondary keyboard alternative.

The Space editor explicitly separates selecting/moving from drawing. Show structure choices and named area purposes as visible tools. A window, door or entrance uses a named host wall: label the available walls on the canvas, highlight the active wall, and allow wall selection through either its name or line. Start a drag near a wall and snap both endpoints onto that wall; clicking without dragging selects the wall without adding an opening. An off-wall or too-short gesture gives guidance beside the canvas. Escape, pointer cancellation and switching tools/projects discard unfinished geometry. After a successful marking, save it and retain the selected tab/tool for continuous drawing. Only the user's “그리기 마치기”, “사진·도면 함께 보기” or selecting/moving tab leaves drawing mode; do not force a tab change. A movable, unprotected partition shows its name and “이동 가능” before selection, a dashed line and a large line/label hit target. If none exists, say so and offer an add-partition action; dragging empty floor is not a pan interaction.

Validate proposed structure/area drawings and design-element placements before committing. Reject duplicate/overlapping structures of the same kind, overlapping openings on one wall, and occupied physical elements on the same floor/wall/ceiling layer. A door and entrance may describe the identical opening. Boundary-wall junctions remain possible; movable partitions cannot cross another wall interior. A new passage must avoid pillars, walls and physical floor fixtures. Reject the same area kind at the same bounds (within a small normalized drawing tolerance), but allow intentional floor/ceiling/ambience layers, smaller named subareas and connecting passage rectangles. Areas describe scope, not an object footprint. Keep still permits compatible removable decoration on its wall. Positioned ceiling lights use a shared 4% × 4% schematic footprint at the saved ceiling-zone offset. Distinct positions in one ceiling zone are allowed; floor furniture is on a separate occupancy layer. Existing ceiling lights and nearby ceiling fixtures still block overlapping positions. Lights without an offset and other ceiling fixtures with unknown extent retain the conservative whole-zone check. This is a plan approximation, never a measured fixture size. Rejected edits preserve prior saved geometry and placement.

## Typed placement matrix
| Element kind | Allowed target | Required parameters | Forbidden examples |
|---|---|---|---|
| freestanding-fixture / furniture | floor point or bounded floor zone | position, rotation, footprint | wall center, pillar, door swing, blocked passage |
| photozone / wall-graphic / wall-mounted-product | existing wall segment | wallId, span/anchor, optional height descriptor | free floor pixel, doorway/window cutout |
| ceiling-light / hanging-display | ceiling zone | zoneId, optional offset/height | floor-only point |
| wall-light | existing wall segment | wallId, offset | floating floor |
| standing-light | floor point | position, footprint | ceiling anchor |
| ambient-light / global-palette | whole space or named area | scope + areaId when scoped | isolated furniture point |
| floor-material | floor area | areaId | wall-only anchor |
| wall-material | wall segment or wall area | wallId + span | floor point |

UI chooses tool from element kind automatically; users only select valid targets. For unclear reference elements prompt user to confirm element kind before placement. A modal that offers all target types for every item is **not** acceptable. If a location is invalid, leave old valid placement intact and show the reason; don't silently relocate it.

The plan is the primary direct manipulation surface. Clicking a valid target places an unplaced item; dragging a placed floor item moves it without an initial jump, and its explicit rotation handle changes its angle. A placed wall element slides along its compatible wall segment and transfers onto a connected adjacent wall when the pointer follows the corner. Preserve physical span and orientation; validate the destination on release. The typed wall selector remains a keyboard alternative. Ceiling and area conditions retain their typed inspector tools and do not gain an arbitrary floor drag handle. All registered usable floor areas remain visible, including when a whole-space condition covers them. An optional, unkept partition can be dragged within the plan while retaining its length and orientation. In Viewpoint, a recognizable camera marker has distinct hit targets: drag its body to move without an initial jump within the walkable region, or drag its visible rotation handle to change heading. The walkable check includes circular/rectangular pillars and applied floor fixtures. Clicking empty floor must not move a camera. Every committed gesture runs the same domain validation as inspector input; rejected edits restore the prior valid state with an explanation. Keep semantic and numeric inspector controls as accessible keyboard alternatives, but do not make percent coordinates the main interaction. Use a plain pointer for click-to-place, `grab`/`grabbing` only for genuinely movable controls, and a crosshair only for an actual draw/area gesture. A visible focus state or selection outline on a permanent structure must never imply it can move.

An extracted element card and the placement inspector display saved apply/exclude conditions, appearance/material conditions and element type as read-only text. “조건 편집” opens draft fields in the Reference step; only explicit save commits these fields together, and cancel discards drafts. Changing type invalidates only an incompatible old target through the domain update. A separate apply/exclude action stays available without opening the editor. The Placement list contains only applied items; excluded items remain in References and Review.

## Keep compatibility

Name structures on plan/photo overlays using their actual names, with the verified Nucleo lock icon at one side for an active Keep. Do not number them as Keep 01/02 or repeat a “보존” text badge. A separate selection outline indicates selection, not preservation or movement. Keep descriptions and the on/off control remain explicit in the inspector. Use CSS-pixel label sizing and separated wall/opening labels so names remain legible when the plan shrinks.
Keep protects the underlying registered structure/appearance as specified, not the empty space around it. A preserved wall accepts compatible removable wall graphics/lights without an extra permission flag or repeated confirmation, but a command to remove/move/replace wall is invalid. A kept pillar occupies floor space and cannot be overlapped by a freestanding fixture. If a floor is kept, a movable display may still sit on it unless it entails prohibited drilling/resurfacing. A kept entrance/window must retain openings, accessibility and apparent position. Never treat every element touching a Keep highlight as a collision. For unsupported geometric cases, show the warning beside the plan and require an explicit “확인하고 배치” action before committing, rather than pretending engineering validation.

Original shell walls, pillars, windows, entrance/door openings and registered fixed ceiling lights start with preservation enabled. The user can turn “필수 보존 (위치 고정)” off/on for every structure in Keep or its Placement inspector. On synchronizes the active Keep and both lock flags; off removes the active Keep and clears both flags. Restore remembered descriptions/permissions when re-enabling; do not re-lock an explicitly released saved structure. Keep structural origin separate from the lock so an unlocked boundary is not misclassified as a new partition. Locked structures cannot move or be deleted. Released structures can be corrected by dragging the shape/name, arrow keys or numeric alternatives. Collision rejection leaves the old geometry intact. A parent wall moves with its attached openings only when all their locks are off; otherwise name the blocking opening and offer its selection. An opening moves along its parent wall and retains its clearance. Deleting a wall with dependent openings or wall elements is rejected with a repair reason. Deletion can be undone until the next successful edit; prior outputs stay stale rather than disappearing. The photo overlay must identify the selected item and explain that photo markers are approximate correspondence, not draggable measured structure. A clearly labeled photo-marker edit may correct `photoAnchor` without changing plan geometry or invalidating generation conditions. A newly registered removable partition is explicitly distinct from the original shell: the user may add, edit or remove it subject to existing floor elements, pillars, entrance clearance and passage checks, and may optionally apply Keep to it. A preserved existing ceiling light has fixed position and editable `lightTone`; off permits validated plan-position correction. The UI states that plan editing does not establish real-world construction feasibility. Reference-derived ambient lighting is a proposed whole-space/area appearance condition and is not itself an existing light fixture.

A new schematic plan starts with its four boundary walls registered as mandatory original structure and corresponding Keeps. Because the outline is schematic, this does not claim measured dimensions. A removable partition must stay inside a registered usable floor area; uploaded plans need an explicitly marked floor area before partition placement.

## Camera and review
A camera lives in walkable region and has directional heading. Primary camera is required, extras optional. On adding a viewpoint from either Camera or Results, search for a valid floor location near the intended start point and refuse the addition with a plain explanation if none is available. An invalid location from older saved data stays visible with a persistent inspector warning until the user repairs it. If an element/reference/Keep/common property changes, increment commonRevision and mark all older results stale; changing a single camera makes only that camera's results stale. A result's camera snapshot includes position, heading and field of view; a legacy snapshot without field of view means the standard preset. Compare all three when saving a request that finished after other edits. Show stale badge on older output; don't discard previous image history. Generated output is not guaranteed structurally consistent across cameras. Single-view and selected multi-view batches are available; every view is optional beyond the primary and independently reviewed. Delete an unnecessary camera while retaining its stale images/snapshots and provide canvas undo.

The plan stays beside the selected element or camera inspector at >=1000px. Both side panels can collapse independently and the center canvas reflows into the available width. At 768–999px, the plan takes the full first workspace row and both panels follow below; at narrower widths, the applied-item/camera list is available by default after the plan. Structure, area and passage controls sit immediately beside the plan in a button group attached to it; do not require scrolling past the workspace to find them. Changing steps brings the current step into view in the horizontal navigation and moves keyboard focus to the new page heading.

Before preview, summarize the current inputs in ordinary Korean: mandatory/optional preservation, applied elements with source and location, excluded items, selected viewpoint and a restrained description of the resulting intended mood. A long Keep list may start collapsed behind a count, but its full contents must remain expandable before preview. This synthesis is computed from chosen conditions; it must not imply an image model has predicted or generated a result. A control that opens a new sample preview and one that opens saved result history need distinct labels and destinations. A preflight issue link must open the actual editing step, including Keep conflicts and missing references.

Review offers two explicit paths after valid preflight: a free, preloaded sample that does not reflect the user's current conditions, and—only when the server API key and durable shared quota store are configured—one paid OpenAI image request per selected camera, sequentially processed by a single user action. With multiple existing-space photographs, the user chooses the one photograph used for this request; its ID belongs in the AI result snapshot and only AI results label it as generation input. A whole-image element sends the original reference pixels. If every applied element from one source selects part of that image, prepare one crop or combine two to four distinct crops into one image; reject more than four before the paid request. The participant control states “선택한 시점마다 이미지 1장을 만듭니다. 시점 수만큼 생성 횟수가 차감됩니다.” Detailed transmitted inputs and structural limitations are accessible in “사용 자료·결과 안내”. Per-image API pricing, provider pricing links and “비용 발생” suffixes do not belong in this participant flow; operational billing guidance remains in API_INTEGRATION.md. The user supplies no API key, access code or participation link. Display the service-wide daily remaining count and the signed anonymous browser daily remaining count (60/day and 20/day); both use Korean midnight, and explain that all browsers share the service cap and accepted requests consume it even on failure, give a plain-language exhausted/busy reason, and offer read-only status refresh. The “생성 가능 여부 확인” control refreshes server availability and shared remaining counts, never image progress or generation. Show a disabled “확인 중…”/aria-busy state while it runs. Entering Review and completing an image request already refresh availability automatically. Clicking the paid action once issues exactly one request per selected view, with a distinct replay-protected request UUID for each; disable both preview controls while it runs and preserve earlier results on failure. If the network or success response leaves the paid outcome unknown, keep the paid action locked in the page session for 180 seconds and then require an explicit risk acknowledgement before retry; a definite error response may be retried normally. The server requires a valid request UUID and same-origin request, validates all inputs before atomically reserving the durable quota, and rejects exhausted limits, active requests and repeated IDs before contacting the provider. Missing/corrupt/unreachable quota state fails closed. Keep reservations on provider errors or unknown outcomes to bound billing. Model output is stored as a browser image asset rather than a large base64 string in localStorage. If saving its project record then fails, keep the generated result visible in page memory with a persistent warning, image export and a save retry action before reload, including when the user switched projects while the request ran. Result history labels `origin:'ai'` and `origin:'sample'` independently, and an in-progress result retains the condition snapshot from the click even if the user later edits another setting.

Multiple existing-space photographs, result versions and approved images use a horizontally navigable collection with the current/total count, previous/next text controls and pointer drag. The native horizontal scrollbar is visually hidden while keyboard access and overflow navigation remain available. Photo frames are vertically centered in their available block. The active photo and approved result are horizontally centered, with a narrow glimpse of the previous and next item when each exists. Selecting an old result does not alter the current common settings.

Informational and success notices begin a gradual fade three seconds after display and are removed when that fade finishes. Their close control immediately dismisses them. Blocking validation, save failure and other must-read notices persist in the page alert across step navigation until dismissed or resolved. Preflight issue rows name the affected condition and link to its editing step. Respect reduced-motion preferences for the fade.

## Failure and empty states
No plan: offer schematic plan editor with unknown geometry indicator. No existing photo: request upload, don't treat mood image as real room. Missing target: block generation with direct link to unplaced element. Unsupported location: plain explanation and highlight eligible zones. No AI credentials: sample preview clearly labeled; do not write 'AI generation complete'. API failure: preserve previous result and allow retry. Failed individual camera: other cameras unaffected. Uploaded files: MIME/size/type checks, revoke object URLs appropriately.

## Final design hierarchy · 2026-09-28

- Use the Korean task names recorded in PRODUCT. At >=1200px the steps occupy the left rail; narrower screens use the existing horizontal step navigation. The title-adjacent previous/next controls become the mobile bottom bar without duplicate buttons. Keep browser History, heading focus and current-step visibility.
- In 유지할 요소, the plan is the large first surface. The right inspector shows the selected structure's existing-space photo with only its corresponding approximate marker, its real name and its preservation switch. An expandable structure list provides a text alternative to the plan. Selecting a structure never changes its lock.
- Panel visibility actions sit beside the plan title and expose their pressed state. Collapsing either side expands the real canvas. Header/navigation stay outside the task's scrolling boundary; focused plan controls remain reachable within their owning panel.
- In 시점, camera labels, official icons and rotation controls keep readable CSS-pixel sizes at every zoom. Moving an explanation label to avoid a camera body changes neither saved geometry nor viewpoint. Numeric position input is an explicit expandable keyboard alternative; direct movement, rotation and validation remain unchanged.
- 생성 전 확인 first presents actual preserved names, each placed element's target, exclusions, selected view and the intended mood. Detailed conditions remain expandable and editable. The separate sample action is available with the brief; the adjacent generation inspector uses one concise sentence with shared quota and expandable data-use details. Operator pricing stays out of the participant panel. Validation issues and unknown-request recovery warnings stay visible.
- Optional experiment controls follow the workspace. Logging remains opt-in; moving the disclosure never starts a session. Source/condition/target names wrap at readable sizes instead of clipping.

### Viewport and notification behavior · user update 2026-09-28

The document and application frame do not scroll. On desktop, long lists, properties and review/result content scroll within their own panel; on stacked layouts below 1000px, only the active task workspace scrolls. Focus/Tab and numeric alternatives can bring their target into that boundary without moving the header or navigation. No workflow control may be made inaccessible by `overflow:hidden`.

Global notices, blocking errors and persistent deletion undo occupy an absolute overlay stack above the lower utility area, with immediate close/recovery controls and existing live-region semantics. Their appearance, fade or removal changes no plan/image bounds. They must not cover title-adjacent previous/next navigation. A local validation reason still appears beside its tool. Project information and the opt-in study panel open over the workspace within the available frame; history, approved-result collections and reference notes expand only on explicit user action. Saving does not close the selected drawing tab or tool.

## Reference deletion and recovery · 2026-09-28
The selected reference has a text-labeled “이미지 삭제” control. Its inline confirmation names the image and counts all connected applied/excluded elements. Focus the safe cancel control, return focus on cancellation, and support Escape. Confirm removes the current Reference, its unshared SourceImage and its derived elements in one common revision. Cancel changes nothing. A separate element delete cleans extraction links but keeps the source; apply/exclude remains a reversible retained condition, distinct from deletion. Elements provide “원본 레퍼런스 보기”.

Deletion offers a persistent “삭제 되돌리기” action independent of the three-second success notice. Undo restores changed common fields with a new revision, never rolling back result history or cameras. Dismissal or the next successful edit ends that undo opportunity. Keep image binaries while referenced by any stored project, historical snapshot or pending undo; clean unused deleted binaries after that opportunity ends. Snapshots record source-image metadata and backfill available metadata for older records before deletion. Upload controls show busy state and prevent overlapping registration. Wrap card actions at narrow widths instead of clipping them.

Generation includes the saved geometry of both preserved and released structures, using separate labels; never reintroduce an automatic preservation instruction for released structures. This is a condition request, not a guarantee of generated compliance.

## Current editing contracts · 2026-09-29
- `Area.outline?: Point[]` defines a valid non-crossing normalized polygon; `bounds` is its validated bounding box. Polygon interiors, not just the box, constrain fixtures/cameras/partitions. Draw vertices by click, close using the first point or Enter/윤곽 저장, undo the last point or Escape to cancel. A failed draft remains editable. Rectangular numeric alternatives remain available.
- Fresh plan replacement clears structures/areas/Keeps and current geometry anchors with undo; retain-annotations is explicit. Alignment confirmation is a compact disclosure with overlaid content, preserving canvas space. Drawing tools remain active after saves.
- `display-product` targets `fixture-surface { fixtureElementId, offset:{x,y} }`; the support must be applied fixture/furniture with a valid floor target. Relative positions follow support rotation/aspect ratio. Support removal/exclusion/type change clears dependent targets while retaining the product and history. `origin:'basic-support'` identifies an explicit user-added support, never an object extracted from a product image.
- `other-floor`, `other-wall`, `other-ceiling`, `other-area` use their respective typed targets and existing collision rules. Floor supports must have footprints and cannot occupy a polygon's bounding-box cutout. Products on supports are not separate floor obstacles.
- Compatible decoration touching Keep is valid without a blocking confirmation. Replacement/removal of the underlying structure remains invalid; fixed-light tone is the existing exception. `allowedSurfaceTreatment` remains readable for legacy/history but does not gate removable wall art. Host wall selection is labeled/highlighted. New openings overlapping pillars are rejected regardless of drawing order.
- Canvas errors/placement warnings are absolute overlays. Successful notices fade; validation never changes plan dimensions or saved geometry. Canvas Ctrl+Z/Ctrl+Shift+Z handles edit history (50 snapshots/tab/project), canceling an active gesture first; polygon drafts undo their vertices first. Redo is cleared by a new edit. Historic results stay present and stale when their conditions differ. Persistent reference/element/plan deletion undo remains separate.
- Reference list is scoped to focused source; selecting an element moves it to the first row and scrolls its panel to the top under a sticky heading. Shape markers distinguish camera, fixture and product while keeping the official icon manifest.
- Applied source count is unrestricted. More than three sources use numbered contact sheets, retaining every source and crop/grid in a validated manifest. Images/body/prompt remain bounded and smaller panels may lose visual detail. Preparing a sheet has no model call.
- The batch locks both generation controls until every selected view finishes or the batch stops. Save each result on arrival; later failure never discards earlier images. Capacity is checked for the chosen count in UI and each request reserves atomically server-side; another browser may consume shared capacity between requests. Never automatically retry a failed/uncertain paid request. Free sample remains a single clearly preloaded sample.

### 여러 시점의 연속 생성 · 2026-09-29
- 서버는 이미지 응답 전에 해당 요청의 진행 중 잠금 해제를 기다린다. 저장소 오류/지연 때문에 이미 생성한 이미지가 전달되지 않는 일을 막도록 해제 대기는 최대 8초 및 함수의 남은 시간 이내로 제한한다. 미해제 잠금과 예약 기록은 유지한다.
- 첫 시점 이후에는 다음 시점 이름과 완료 수를 표시하고 읽기 전용 상태 GET으로 다음 요청 가능 여부를 확인한다. 처리 중이면 2초 간격으로 최대 20초 대기한다. 이 확인은 생성 호출이나 횟수 예약이 아니다. 다음 시점의 유료 POST는 준비 상태가 확인된 뒤 새 UUID로 한 번만 실행한다.
- 한도 소진·상태 조회 실패·대기 시간 초과에서는 먼저 완성한 이미지를 보관하고 남은 시점을 중단한 이유를 표시한다. 아직 보내지 않은 시점에 생성 실패 이벤트나 불확실한 과금 표시를 만들지 않는다. 실제 전송한 요청의 실패/불확실 결과는 기존 재요청 보호를 따른다.

## 위치 연결과 영역 표시 · 2026-09-29
- References: 요소 이름 버튼으로 선택한다. 등록 폼에서 조명 분위기 등 적용 범위를 바로 지정할 수 있으며 ‘배치에서 나중에 지정’도 가능하다. 저장된 선택 요소에서는 같은 선택기로 위치를 수정한다. 이미지 크롭은 출처 선택이며 공간 범위 연결과 혼동하지 않는다.
- Placement: 오른쪽 ‘적용 위치 연결’ 또는 도면 영역 이름/목록으로 현재 요소를 연결한다. 등록과 배치가 같은 실제 영역 ID를 저장한다. 유형이 다른 위치는 비활성이고, 점유 등 충돌은 도메인 검증으로 거절한다. 전체 공간 조명과 다른 레퍼런스의 특정 영역 조명은 동시에 유지할 수 있다.
- 새 공간/천장/바닥 영역 추가는 명시적 버튼으로 공간 준비의 해당 도구를 연다. 저장은 즉시 수행하되 사용자가 그리기를 마친다.
- ‘영역·동선 N개’는 화면 안에 뜨는 표시 설정이다. 종류별 개수·필터와 전체 이름 목록을 제공하며 선택 영역은 필터와 관계없이 표시한다. 기본 이름표는 선택 영역 하나이고, 나머지는 옅게 표시한다. 이름표 전체 표시는 선택적으로 켜며 여유가 없는 이름은 실제 이름 목록으로 접근한다. 경계 패턴으로 바닥/천장/공간/동선을 구분한다.
- 도면 경계 선택은 그리기 중 새 제스처를 가로채지 않는다. 표시 설정의 클릭은 도면 치수/연결/수정 버전에 영향을 주지 않는다. 팝업은 바깥 클릭·Escape로 닫는다. Escape는 열기 컨트롤로 초점을 복원한다. 열기 컨트롤에서 Tab으로 첫 설정에 들어가고 설정 마지막 Tab은 도면으로, 첫 설정 Shift+Tab은 열기 컨트롤로 이동한다.
- 높이가 짧거나 폭이 좁은 공간 준비에서는 해당 작업 영역 하나가 내부 스크롤을 가지며 캔버스 전체의 최소 작업 높이를 보장한다. 작은 별도 스크롤 구간에 캔버스를 가두지 않는다. 앱 바깥 페이지는 스크롤하지 않는다.

## 놓기 전에 보이는 이동 검사 · 2026-09-29
- 동선/여닫이 공간은 모든 도면 모드에서 빗금과 실제 이름으로 표시한다. 동선 필터는 “항상 표시” 상태이며 저장 데이터를 수정하지 않는다. 바닥 경계·배치 물체 점유 범위는 기존 도메인 검증이 쓰는 실제 등록 데이터로 그린다.
- 구조/요소 표시를 꺼도 최소 충돌 윤곽은 남긴다. 움직이는 바닥 물체의 이전 위치를 자기 장애물처럼 표시하지 않는다. 진열 상품과 연결된 진열대의 허용 중첩은 유지한다.
- 구조·바닥 요소·벽 부착 요소·카메라의 드래그/회전 미리보기는 놓을 때 사용하는 검증을 그대로 실행한다. 불가한 후보는 붉은 윤곽과 실제 이유를 보여준다. 드래그 중에는 저장/수정 버전을 바꾸지 않으며 놓았을 때 기존 검증/저장 경로를 사용한다.
- 이동 피드백과 거절 안내는 absolute overlay이며 캔버스 크기·저장 위치를 바꾸지 않는다. 아래쪽으로 이동 중인 후보의 피드백은 위쪽에 표시한다. 상시 빗금 설명은 도형 밖에 놓는다. 표시 이름이 이동된 경우 연결선으로 실제 범위를 가리키며 공간이 부족한 화면에서 이름표를 접어도 범위 윤곽은 남는다.
- Keep/시점에서도 거절 이유가 캔버스 안에 남고 닫을 수 있다. 정상 저장 시 이전 도면 오류를 해제한다. 클릭/방향키/수치 편집도 최종 검사와 이전 위치 복구를 유지한다.
- 기본 카메라 편집은 시점에서만 제공한다. 기둥/가벽을 그리거나 선택하여 옮길 때 기존 카메라 위치가 막는 원인이라면 공식 카메라 아이콘으로 읽기 전용 위치를 보인다. 요소를 선택한 배치 화면에 이전 구조 선택을 남겨 관계없는 카메라를 보여주지 않는다.

## 도면 읽기와 시안 대조 · 2026-09-29
구조 이름표는 큰 카드 대신 조용한 텍스트/배경으로 표시하며 선택/키보드 포커스만 강조한다. 잠금 토글의 40px 조작 영역은 유지한다. 물체의 실제 이름을 표시하고 일상 배치에서는 중복 점유 사각형을 생략한다. 조작 중/레이어 숨김/준비·Keep에서는 충돌 검사 윤곽을 유지한다. 동선·여닫이 윤곽을 이름표로 가리지 않으며 출입문/창 등 작은 구조 이름을 벽 이름보다 먼저 배치한다. 배치/시점의 상세 조작 안내는 접기/펼치기 가능하며 제한 빗금 설명은 상시 표시한다.
시안의 배치 도면 대조는 별도 모달 없이 사용자가 펼친다. 당시 구조·물체·단일 시점 방향을 표시하며 현재 수정이나 카메라 삭제와 무관하게 과거 조건을 유지한다. 조건 스냅샷이 없으면 현재 도면으로 과거 기록을 대신하지 않는다.

## 초점·가이드·연속 과업 · 2026-09-29
- 클릭한 버튼/도면의 검은 기본 포커스 라인을 제거한다. 키보드 탐색 표시와 입력창 편집 상태는 유지한다.
- 사용 가이드는 상단 링크로 새 탭에서 열고 HTML 목차와 PDF 내려받기를 제공한다. 실험 기록에서는 A/B 설명 위치로 직접 연결한다. 작업 탭의 상태를 변경하거나 실험을 자동 시작하지 않는다.
- A/B는 서로 다른 자료 과업의 태그이고 비교 인터페이스 선택이 아니다. 선택만으로 현재 프로젝트의 사진·도면을 바꾸지 않는다.
- 이전 과업을 종료한 뒤 새 과업을 시작하면 ‘받을 기록’은 새 세션을 선택한다. 기록 중 다른 프로젝트를 열었으면 기록 시작 프로젝트로 돌아가라는 이유를 표시한다.
- 기본 진열대 생성 후 배치 화면에서는 방금 만든 진열대를 선택해 바로 위치를 지정한다.
그리기 중 구조 이름표의 투명 조작 영역까지 읽기 전용으로 처리한다. 이름표가 보이는 빈 바닥 위에서도 다음 구조·영역 그리기가 계속되어야 한다. 연결 벽 선택용 별도 라벨은 기존 선택 조작을 유지한다.


## 보이지 않는 요소의 선택 · 2026-10-01
- 물리적 천장 요소는 천장 영역 레이어가 숨겨져 있어도 배치 기호로 표시한다. 분위기 등 범위 조건은 기존처럼 선택 시 강조한다.
- 숨긴 영역·구조·물체는 매핑 hit target을 남기지 않는다. 명시적으로 선택한 요소/영역은 숨김 설정과 관계없이 표시한다.
- 확대 때문에 바깥으로 잘린 물체를 목록에서 새로 선택하면 전체 보기로 돌아온다. 같은 선택 상태에서 사용자가 확대하는 동작은 유지한다.
- 목록의 미배치/제외/연결 확인 표시는 데이터 삭제나 자동 배치가 아니다. 사용자가 기존 편집 기능으로 위치와 연결을 결정한다.

## 레이아웃 Backspace 삭제 · 2026-10-01
2단계 레이아웃 구성의 작업 영역에서 Backspace를 누르면 현재 선택한 배치 요소를 기존 삭제 경로로 제거한다. 구조·영역 선택, 그리기/추가 도구, 입력창·선택 상자·편집 가능 텍스트·대화상자·IME 입력에는 적용하지 않는다. 키를 누르고 있는 동안 다음 요소가 연속 삭제되지 않는다. 다른 단계에는 적용하지 않으며 기존 저장·실행 취소·다시 실행·삭제 복구를 유지한다.
