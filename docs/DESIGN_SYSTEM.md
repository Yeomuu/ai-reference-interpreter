# Design system — AI Reference Interpreter / v1.2

> Updated 2026-09-28 from the current product/interaction contracts and four reference studies:
> Apple, Toss, Ohouse (오늘의집), and The Pinkfong Company.
>
> These reference systems are **principle sources, not token sources**. Do not copy their brand colors,
> fonts, logos, proprietary components, page compositions, or marketing treatment into this product.
> Product behavior remains governed by `PRODUCT.md` and `INTERACTIONS.md`.

---

## 0. Authority and design decision order

When visual references, old Figma screens, code, and product rules disagree, use this order:

1. Current `PRODUCT.md` and `INTERACTIONS.md` product invariants.
2. Current `DESIGN_SYSTEM.md` tokens, component contracts, and accessibility rules.
3. Current repository behavior when it does not conflict with 1–2.
4. Current Figma wireframes for layout proportions and information hierarchy.
5. `DESIGN_REFERENCE_SYNTHESIS.md` and external/reference design systems as inspiration only.

Do not change product behavior merely to imitate a reference service.

The product is a **spatial concept editing tool**, not a marketing page, dashboard showcase,
consumer-commerce clone, or research-themed wireframe.

---

## 1. Design premise

### 1.1 Core experience

The interface should feel like a **quiet white studio** around four kinds of evidence:

- existing-space photographs,
- the floor plan,
- reference/product imagery,
- generated or sample result imagery.

Those objects should carry the visual weight. UI chrome exists to help users understand,
select, place, validate, compare, and revise them.

### 1.2 Product character

Use these adjectives as a check when evaluating a screen:

- calm
- precise
- spatial
- editable
- trustworthy
- visually restrained
- image-forward
- explicit about state
- easy to recover from mistakes

Avoid:

- promotional hero sections
- ornamental dashboards
- gratuitous gradients
- large decorative illustrations
- emoji as functional UI
- decorative purple branding everywhere
- excessive shadows or glass effects
- nested cards for every row
- playful copy that makes constraints ambiguous

### 1.3 Reference-derived principles

The four reference studies inform the service in different ways:

**Apple → content primacy and agency**
- Keep controls visually restrained around content.
- Use one obvious primary action in a local task region.
- Make selection, state, reversibility, and consequences understandable.
- Do not spread translucent/glass treatment across content surfaces.

**Toss → state clarity and predictable controls**
- Every actionable component must have explicit default, hover, pressed, focus-visible,
  disabled, and loading behavior where relevant.
- Color is functional, not decorative.
- Copy should say what happens next in plain language.
- Do not merge mobile-product geometry into this desktop editor.

**Ohouse → image-led quietness**
- White canvas and dark neutral text support visual content.
- Do not wrap every image/list item in a heavy outer card.
- Let reference and result images appear visually generous.
- Use borders, spacing, and hierarchy before adding shadows.

**Pinkfong → brand/product boundary discipline**
- Brand identity art is separate from product controls.
- A recognizable accent or display asset from another brand is not a universal UI token.
- Keep our brand mark, Nucleo action icons, user images, and semantic UI colors conceptually separate.

---

## 2. Visual hierarchy

### 2.1 What must dominate

Priority from strongest to weakest:

1. active plan / active result / active reference image
2. selected element or camera and its editable condition
3. current-step title and primary task action
4. supporting lists and summaries
5. metadata, provenance, counts, helper copy

The canvas or active image must never be visually weaker than surrounding chrome.

### 2.2 Local primary action rule

A task region may expose **one filled near-black primary action**.

Examples:
- 다음 단계
- 조건 확인
- AI 이미지 생성
- 이미지 저장

A second action in the same region must be secondary/outlined, text-only, or destructive when
semantically required.

Do not use violet as the primary CTA fill.

### 2.3 Progressive disclosure

Keep the first view concise.

- Put current actionable conditions before full history or full Keep lists.
- Collapse long preservation lists behind a visible count with an explicit expand control.
- Show advanced coordinate/numeric controls as keyboard alternatives, not the main editor.
- Keep additional viewpoints optional after a valid first viewpoint.
- Do not hide required validation behind hover-only affordances.

---

## 3. Foundations

### 3.1 Color tokens

Project-owned values:

```css
:root {
  --neutral-white:#FFFFFF;
  --neutral-25:#FBFCFD;
  --neutral-50:#F7F8FA;
  --neutral-100:#F1F3F6;
  --neutral-200:#E5E9ED;
  --neutral-400:#A3ABB5;
  --neutral-600:#56616F;
  --neutral-900:#17191D;

  --violet-50:#F0EDF9;
  --violet-200:#C7BEE8;
  --violet-500:#7568B8;
  --violet-700:#6253A8;

  --green-50:#E6F3EE;
  --green-700:#35725D;

  --red-50:#FAEFF1;
  --red-700:#A4505D;

  --blue-50:#EDF6FA;
  --blue-700:#3D7693;

  --surface-base:var(--neutral-white);
  --surface-subtle:var(--neutral-25);
  --surface-workspace:var(--neutral-50);
  --surface-hover:var(--neutral-50);
  --surface-pressed:var(--neutral-100);
  --surface-selected:var(--violet-50);

  --surface-glass:rgb(255 255 255 / 94%);
  --surface-glass-fallback:var(--neutral-white);

  --text-primary:var(--neutral-900);
  --text-secondary:var(--neutral-600);
  --text-tertiary:var(--neutral-400);
  --text-inverse:var(--neutral-white);

  --border-default:var(--neutral-200);
  --border-control:#87919C;
  --border-strong:var(--neutral-400);
  --border-selected:var(--violet-200);

  --action-primary:var(--neutral-900);
  --action-primary-text:var(--neutral-white);
  --action-selected:var(--violet-700);

  --state-keep-bg:var(--green-50);
  --state-keep-fg:var(--green-700);
  --state-error-bg:var(--red-50);
  --state-error-fg:var(--red-700);
  --state-info-bg:var(--blue-50);
  --state-info-fg:var(--blue-700);

  --canvas-structure:var(--neutral-600);
  --canvas-selection:var(--violet-500);

  --focus-ring:var(--violet-500);

  --space-4:4px;
  --space-8:8px;
  --space-12:12px;
  --space-16:16px;
  --space-20:20px;
  --space-24:24px;
  --space-32:32px;
  --space-40:40px;
  --space-48:48px;

  --radius-4:4px;
  --radius-8:8px;
  --radius-12:12px;
  --radius-16:16px;

  --control-height-32:32px;
  --control-height-40:40px;
  --control-height-44:44px;
  --control-height-48:48px;

  --shadow-panel:0 2px 12px rgb(23 25 29 / 4%);
  --shadow-float:0 12px 32px rgb(23 25 29 / 8%);
  --shadow-footer:0 -2px 12px rgb(23 25 29 / 4%);

  --glass-blur:blur(10px);

  --motion-fast:150ms;
  --motion-base:200ms;
  --motion-slow:220ms;
  --ease-standard:cubic-bezier(.2, 0, 0, 1);

  --font-ui:Paperlogy,"Noto Sans KR",system-ui,sans-serif;
}
```

### 3.2 Semantic usage

- **Near-black**: primary action, strongest text, camera body where appropriate.
- **Violet**: selection, selected segment, selected outline, focus cue. Not decoration.
- **Green**: Keep/preservation and success only.
- **Red**: destructive, invalid, incompatible, blocking error.
- **Blue**: structural information such as existing window or neutral informational cue.
- **Neutral**: default surfaces, borders, hierarchy, secondary actions.

Never rely on color alone. Pair semantic color with text, icon, shape, border, or pattern.

### 3.3 User imagery vs UI colors

Do not tint, color-grade, blur, dim, or otherwise stylize user images merely to make them fit the UI.

Semantic UI colors must not be sampled from an uploaded photo or product image.

---

## 4. Surfaces, borders, and elevation

### 4.1 Panel hierarchy

**Outer panels**
- opaque white
- 1px `--border-default`
- 16px radius
- at most `--shadow-panel`

Examples:
- project/source panel
- floor-plan workspace shell
- inspector shell
- result-viewer shell

**Inner groups**
- flat by default
- no additional shadow
- use dividers, spacing, background contrast, or 1px borders

Examples:
- condition rows
- element list rows
- reference metadata rows
- form groups

Avoid more than **two visually nested framed levels**.

### 4.2 Glass treatment

Allowed only for transient or navigational chrome:

- header
- step navigation
- fixed footer
- detached canvas toolbar

Not allowed for:
- plan canvas itself
- existing-space image
- reference image
- result image
- inspector content
- form panel
- generation explanation

If `backdrop-filter` is unsupported or reduced transparency is requested:
- remove blur
- use opaque white
- preserve border separation
- preserve all labels and focus cues

### 4.3 Shadow policy

Use shadow to explain layer separation, not prestige.

- outer panel: optional `--shadow-panel`
- genuinely floating menu/popover: `--shadow-float`
- fixed footer if visually detached: `--shadow-footer`
- list row/card/input/button: no shadow by default
- selected state: border/fill/focus treatment, not lift animation

---

## 5. Typography

### 5.1 Font policy

Local development:
- Paperlogy 400 / 500 / 600 / 700 from the verified user-provided files described in
  `FONT_PROVENANCE.md`.

Production fallback:
1. `Noto Sans KR`
2. `system-ui`
3. `sans-serif`

Do not invent a Paperlogy CDN URL.
Do not silently bundle font binaries into a handoff.

### 5.2 Type ramp

| Role | Size / line | Weight | Use |
|---|---:|---:|---|
| Page title | 28 / 40 | 700 | current step/page title |
| Large heading | 22 / 32 | 700 | rare large section title |
| Panel heading | 18 / 28 | 600–700 | editor/result panel titles |
| Body | 16 / 26 | 400 | explanatory content |
| Compact body | 14 / 22 | 400 | editor copy, rows |
| Label | 14 / 22 | 500 | controls, values, actions |
| Compact label | 12 / 18 | 500 | status/meta label |
| Caption | 12 / 18 | 400 | provenance, secondary metadata |

Rules:
- operational source names, condition values, editable values, and action labels: **>=14px**
- 12px only for secondary metadata/caption/status
- do not use oversized display typography in the editor
- do not use uppercase for Korean UI labels
- English technical tokens may appear in documentation, not normal visible UI

---

## 6. Iconography and brand assets

### 6.1 Brand mark

`public/brand/mark.svg` is the product brand mark.

Use:
- header identity
- favicon

Do not use it as:
- add/delete/edit icon
- Keep marker
- camera control
- status symbol

### 6.2 Nucleo-only functional icon rule

Use only the verified official free **Nucleo UI Essential Outline 18** assets listed in
`ICON_MANIFEST.md`.

Permitted approach:
- official free React component from `nucleo-ui-essential-outline-18@1.1.7`
- unchanged static SVG rendered from that component
- unchanged geometry/viewBox/currentColor

Forbidden:
- Lucide
- Heroicons
- Font Awesome
- emoji
- hand-drawn lookalikes
- premium Nucleo assets
- guessed Nucleo filenames
- hotlinked icon URLs

If there is no verified icon for the meaning, use a **text-only control**.

### 6.3 Icon button geometry

- hit target: 40×40 minimum
- visible icon: 18–24px
- aria-label required
- icon-only control only when meaning is familiar and verified
- unfamiliar actions pair icon + Korean text
- destructive icons require red semantic treatment plus an explicit label/context

---

## 7. Layout and responsive behavior

### 7.1 Desktop reference

Primary design viewport: **1440×900**

- header: 64px
- desktop step rail: 176px at the left, following the latest Figma v1.3
- horizontal main-content margin: 24px; header margin: 36px
- below 1200px, horizontal step navigation: 56px; below 768px preserve a 44px target
- canvas/editor: >=50% of main workspace width

### 7.2 Placement / Viewpoint workspace

Desktop:
- left list: 220–260px, responsive to available width after the step rail
- center plan: flexible, largest and >=50% of the editor region
- right inspector: 260–300px
- gutters: 16–20px
- left/right panels collapse independently
- canvas expands into released width

The same plan surface should remain visually stable between Placement and Viewpoint.
Only task-relevant layers and tools change.

### 7.3 Responsive

**>=1200px**
- three-column editor where applicable
- plan and active inspector visible together

**768–1199px**
- plan occupies full first workspace row
- list and inspector below
- do not squeeze canvas between fixed sidebars

**<768px**
- plan first
- list/inspector available by default after plan
- preserve browsing/review capability
- explicitly state that detailed floor-plan editing works best on desktop
- no hidden critical action behind hover

Do not use a generic plan pan mode for this 2D flow.

### 7.4 Spacing rhythm

Use an 8px base rhythm.

Preferred:
4, 8, 12, 16, 20, 24, 32, 40, 48.

Avoid arbitrary 13/17/27px spacing unless required by an image ratio or exact geometry.

---

## 8. Image and media behavior

### 8.1 Existing-space photos

- visually generous
- active frame centered
- preserve aspect ratio
- bounded panel height on desktop
- show current/total count
- previous/next text controls
- pointer drag may navigate collection
- hide native horizontal scrollbar without removing keyboard access
- show a narrow neighbor preview only when a neighbor exists

### 8.2 Reference/product images

Reference image is evidence, not decoration.

- image gets the largest area in Reference step
- source name and role stay legible
- show selected crop/region explicitly
- atmosphere/product/element roles must be distinguishable by text, not color alone
- `object-fit: contain` by default
- do not crop unless user explicitly selected/cropped a region

### 8.3 Floor plan

- never distort aspect ratio
- plan remains visible while drawing/editing structures and areas
- provenance note stays near the plan
- uploaded, schematic, and prepared sample states are explicitly named
- do not visually imply that schematic geometry is measured

### 8.4 Result image

- ResultViewer gets the strongest image hierarchy on Results
- active result large
- current origin (`AI` / `sample`) explicit
- stale/approved/version states explicit
- result history appears after current result and current actionable conditions

---

## 9. Action component rules

### 9.1 PrimaryButton

- height: 40 or 44px
- radius: 12px
- background: `--action-primary`
- text: white
- one primary per local task region

States:
- default: near-black fill
- hover: subtle lightening using a project token/overlay; no lift shadow
- pressed: subtle darkening
- focus-visible: 2px violet focus ring + 2px offset
- disabled: neutral-100 fill + neutral-400 text, no pointer action
- loading: preserve button width and label context; block duplicate action

Do not invent another primary color.

### 9.2 SecondaryButton

- 40 or 44px
- white surface
- `--border-control`
- neutral label
- 12px radius

States:
- hover: `--surface-hover`
- pressed: `--surface-pressed`
- focus-visible: same focus ring
- disabled: muted border/text, explicit disabled semantics

### 9.3 DestructiveButton

- separate from primary
- red semantic border/text or restrained red fill when consequence is high and confirmed
- never use red for ordinary cancel/back

### 9.4 Text actions

Use for low-priority controls:
- 조건 편집
- 펼쳐보기
- 이전 이미지
- 다음 이미지
- 패널 숨기기

Do not style every text action as a pill.

---

## 10. Inputs, segmented controls, badges

### 10.1 Input / Select / Textarea

- 40–44px single-line height
- 12px radius
- visible `--border-control`
- label above or immediately associated
- helper/error text stays adjacent
- focus ring: violet 2px + offset
- read-only and disabled look different
- validation message names the problem and next safe action

### 10.2 Segmented control

Use for compact mutually exclusive local choices only.

- one visually selected segment
- selected: violet-50 + violet-200 border + violet-700 text
- default: white/neutral
- height 32–40px
- do not use for long navigation hierarchy

### 10.3 Status badge

Use only for descriptive state.

Examples:
- 적용됨
- 제외됨
- 배치 완료
- 충돌
- 필수 유지
- 이전 설정
- AI
- 샘플

- compact
- 4px radius or small capsule when text needs it
- not clickable unless explicitly a control with proper affordance
- color + text together

---

## 11. Editor-specific components

### 11.1 PlanSourceNote

Purpose:
- explain whether plan is uploaded / manually started schematic / prepared sample
- explain confidence/provenance

It must not:
- duplicate drawing tool actions
- claim photo-derived geometry
- dominate the workspace

### 11.2 KeepMarker

Visual contract:
- actual structure name + one verified lock icon for active preservation; no Keep numbering or preservation halo
- structural origin is separate from the user-controlled preservation lock
- selected fixed structure may highlight but must not show move handles
- no `grab` cursor for immutable structures
- selected explanation states what is and is not editable

Keep means preservation of the underlying structure, not an automatic exclusion zone around it.

### 11.3 ElementCard

Show:
- source
- element label
- element type
- allowed target
- apply/exclude state
- placement status
- concise condition summary

States:
- not placed
- placed
- conflict
- excluded

Rules:
- saved condition is read-only until explicit `조건 편집`
- Save/Cancel required for condition draft
- excluded elements do not appear in Placement list

### 11.4 PlacementInspector

Only show controls valid for the current element type.

Examples:
- floor furniture: floor position, rotation, footprint
- wall graphic: wall/span; no free-floor X/Y
- ambient light: whole-space/area scope; no point drag
- ceiling light: ceiling zone; no floor controls

Do not show a generic "target type" modal for every element.

### 11.5 PlanCanvas

The plan is a task surface, not a decorative diagram.

Layer behavior:
- Space/Keep: structure focus
- Placement: structure + usable floor + applied elements
- Viewpoint: structure + applied elements + cameras

Interaction:
- select/move mode separate from draw mode
- click-to-place uses normal pointer
- `grab/grabbing` only on movable objects
- crosshair only while drawing
- zoom + reset allowed
- generic pan mode not part of flow
- keyboard-selectable structures and semantic/numeric fallback
- direct hit target >=40 CSS px where practical after resize/zoom

Fixed structure focus must never imply movability.

### 11.6 Camera marker

- recognizable body
- separate labeled rotation handle
- body drag = position
- handle drag = heading
- empty floor click does not move camera
- invalid saved position stays visible with inspector reason
- camera hidden from Space/Keep/Placement

### 11.7 ConditionSummary

Order:
1. blocking issues
2. mandatory/optional preservation count
3. applied elements with source + target
4. excluded elements
5. selected camera
6. restrained intended-mood synthesis
7. expanded detail

The mood summary is a summary of user inputs, not an AI prediction.

### 11.8 GenerationPanel

Paid generation is visually separated from free sample preview.

Show before paid action:
- selected viewpoint
- chosen existing-space anchor photo
- image transfer summary
- one-image scope
- one concise sentence: “설정한 조건과 선택한 시점으로 이미지 1장을 만듭니다.”
- transmitted inputs/result limitations in “사용 자료·결과 안내”; no per-image API price or provider pricing link
- shared total/daily quota and plain-language busy/exhausted reason; no user key, code or invitation link
- structural-accuracy limitation

Primary action:
- when AI configured: near-black `AI 이미지 생성`
- when AI unavailable: free sample action may become the only primary

Name the readiness action “생성 가능 여부 확인”. It refreshes availability and remaining shared counts, never image progress. Show a disabled “확인 중…”/aria-busy state during refresh. Do not add a “비용 발생” suffix to the participant image action.

### 11.9 ResultViewer

- result image largest
- current conditions next to or directly below the image
- origin/version/approval/stale status explicit
- saved history visually distinct from new preview
- active item centered in galleries
- current/total + prev/next text controls + pointer drag
- keep keyboard navigation
- do not require multiple viewpoints to complete a project

---

## 12. Feedback and motion

### 12.1 Notice hierarchy

**Toast**
- noncritical info/success
- begins gradual fade after 3s
- manual close remains immediate
- not the sole source of an error explanation

**Inline alert / page alert**
- blocking validation
- save failure
- unknown paid-request outcome
- stays until dismissed or resolved

**Modal**
- high-impact irreversible action only

### 12.2 Motion

Local project motion tokens:
- fast: 150ms
- standard: 200ms
- slow: 220ms
- standard easing: `cubic-bezier(.2,0,0,1)`

Use for:
- hover/focus/selected surface changes
- panel collapse
- compact inspector transitions

Do not animate:
- plan geometry in a way that changes apparent accuracy
- Keep conflicts as playful bounce/shake
- critical error disappearance
- user imagery with filters/zoom merely for decoration

Respect `prefers-reduced-motion`.

---

## 13. Content and Korean UI voice

All normal visible product UI is Korean.

### 13.1 Voice

- short
- direct
- task-based
- concrete
- non-promotional

Prefer:
- `곡선형 진열대를 배치할 바닥 영역을 선택하세요.`
- `이 벽은 기존 구조로 유지해야 합니다.`
- `현재 위치는 출입구와 겹쳐 배치할 수 없습니다.`
- `조건을 수정한 뒤 다시 생성할 수 있습니다.`

Avoid:
- `AI가 멋진 공간을 만들어드릴게요!`
- `완벽하게 반영했어요`
- `걱정하지 마세요`
- vague error codes without explanation

### 13.2 Action labels

Use verb + object when ambiguity exists.

Good:
- 사진 추가
- 도면 교체
- 조건 편집
- 배치 저장
- 시점 추가
- 이미지 생성
- 이미지 저장
- 결과 이력 보기

Avoid generic:
- 확인
- 계속
- 완료

unless the context already makes the result unmistakable.

### 13.3 AI/sample provenance language

Never say:
- `AI 생성 완료` for a preloaded sample
- `정확히 반영됨` without human verification
- `구조 보존 성공` based only on request submission

Use:
- `사전 제공 샘플`
- `AI 생성 결과`
- `직접 확인이 필요한 결과`
- `이전 조건으로 생성된 결과`

---

## 14. Accessibility

Target:
- body text contrast >= 4.5:1
- essential icons/control boundaries >= 3:1
- keyboard path for every essential task
- visible focus ring
- no color-only state
- no pointer-only interaction
- no focus traps
- no unexpected auto-scroll
- current step brought into view and new heading focused after step change

Plan:
- structure names visible/readable
- active wall gets text + stroke difference
- movable partition gets `이동 가능` before selection
- permanent structure gets no draggable styling
- canvas hit targets remain usable after resize/zoom

Respect:
- reduced motion
- reduced transparency
- forced colors

---

## 15. Page-level hierarchy

### Projects
- saved/sample projects + one clear new-project form
- not a KPI/dashboard homepage
- current project identity stronger than metadata

### Space
- existing-space photo and plan are separate evidence surfaces
- plan provenance visible
- plan drawing tools adjacent to plan
- current photo vertically centered in bounded panel

### Keep
- selected structure and allowed edits first
- linked photo/plan context
- long Keep/fixed-structure list after actionable information

### References
- selected source image largest
- source role/name visible
- crop/region selection visible
- extracted conditions right-side or adjacent
- apply/exclude clear without opening full edit form

### Placement
- left applied-item list
- center plan largest
- right typed inspector
- no camera
- side panels independently collapsible

### Viewpoint
- same large center plan
- camera list + inspector
- camera body and rotation handle distinct
- one primary camera required

### Review
- blocking issues first
- compact condition synthesis
- Keep details collapsible
- free sample and paid generation explicitly separate
- concise one-image guidance and accessible data-use details before generation; API billing guidance remains in operator documentation

### Results
- current result image dominant
- actionable current conditions next
- approval/export
- history and approved collection after current result
- additional viewpoints optional

---

## 16. Codex / implementation rules

1. Use CSS variables from the design system. Do not scatter new hex values.
2. Reuse shared components before creating a page-specific variant.
3. New token/variant requires a documented reason.
4. Do not introduce another icon library.
5. Do not substitute a reference brand's font or action color.
6. Do not style user images for visual consistency.
7. Do not add a new card merely to separate content if spacing/divider can do the job.
8. Do not hide essential actions in hover-only affordances.
9. Do not use a filled violet primary CTA.
10. Do not duplicate one action in multiple toolbars.
11. Do not create a fake interactive control.
12. Make disabled/loading/focus states functional, not screenshot-only.
13. Validate layout at 1440, 1280, 768, and ~390px.
14. Validate keyboard focus and reduced-motion behavior.
15. Check that plan remains the largest editor object on Placement/Viewpoint.
16. Check that result/reference imagery remains visually primary.
17. Preserve product invariants from `PRODUCT.md` and `INTERACTIONS.md`.
18. Record meaningful visual-rule changes in `UX_SPEC_CHANGELOG.md`.

---

## 17. Design review checklist

Before accepting a screen, ask:

### Hierarchy
- Is the plan/reference/result more visually prominent than its controls?
- Is there only one local primary action?
- Can the user immediately identify the current selected object and state?

### Restraint
- Are there unnecessary shadows, cards, gradients, pills, or glass surfaces?
- Is violet being used for selection/focus rather than decoration?
- Could a border/divider/spacing solve the problem instead?

### State
- Are hover, pressed, focus-visible, disabled, loading, error, and selected states defined where needed?
- Is state communicated with more than color?

### Spatial semantics
- Does the inspector show only valid controls for the selected type?
- Does a fixed structure look fixed?
- Is the camera shown only in Viewpoint?
- Does Keep look like preservation rather than blanket no-go space?

### Provenance
- Are uploaded/schematic/sample plan states explicit?
- Are sample and AI results clearly separated?
- Is a result marked stale when relevant settings changed?

### Accessibility
- Can the same task be completed by keyboard?
- Is focus visible?
- Do reduced motion/transparency modes remain usable?
- Are all important labels at readable sizes?

If any answer fails, fix the system-level cause before adding page-specific polish.


## 18. Verified Figma v1.3 alignment and current-contract reconciliation · 2026-09-28

The public Figma file was opened in an isolated browser. Its latest active section is
`AI Reference Interpreter · 사용자 중심 와이어프레임 · v1.3` (node `125:2`);
`v1.0 archive` and `v1.2 archive` are explicitly historical. The current guide is
`ARI · Design System / v1.2`. The supplied MD pack is the detailed visual contract.

- Follow the v1.3 left step rail on desktop; use horizontal navigation at tablet/mobile widths.
- Task names are 공간 준비, 유지할 요소, 참고 이미지, 배치, 시점, 생성 전 확인, 시안.
  Existing route keys and stored schemas remain unchanged. Keep and Reference remain domain concepts.
- Put the next task action next to the page title on desktop. The same controls form the mobile
  bottom action bar; do not duplicate them in a second toolbar. Retain accessible previous navigation.
- The opt-in experiment disclosure follows the task workspace, so it does not push the plan down.
  It stays available before starting a trial; data collection never begins without consent.
- Source notes are concise with an explicit provenance disclosure. Selection help follows the plan;
  current drawing tools, errors and gestures remain adjacent and visible.
- No silent re-locking, Keep numbering, participant credentials, extra product features or research
  comparison UI may be introduced from older visual examples. The current PRODUCT/INTERACTIONS
  lock, no-forced-tab, routing, logging and shared-quota contracts take precedence.
- New layout tokens (`--layout-nav-width`, editor side widths, header height) describe the measured
  Figma hierarchy. Hover/pressed/disabled/loading states share semantic tokens and motion values.
- Long operational source/condition/target names remain >=14px, wrap rather than clip, and selected
  rows use a border/stroke plus accessible state. Source imagery is not tinted or stylized.

Source: https://www.figma.com/design/J2ZHftzWmLR7OQhpyMFJQA/?node-id=125-2
Implementation and verification record: [QA_DESIGN_UPDATE_20260928.md](QA_DESIGN_UPDATE_20260928.md).

### Implemented state and layout aliases

`--surface-hover` = neutral-50; `--surface-pressed` = neutral-100; `--text-tertiary` = neutral-400;
`--focus-ring` = violet-500. Primary hover mixes neutral-900 with 12% white; pressed mixes it with
20% black. Motion is 150/200/220ms with one standard easing. These are derived states of existing
colors, not additional brand accents. `danger-quiet` is a text-only deletion variant using the
existing error foreground/background, so recoverable deletion does not compete with the next task.

Desktop header/rail: 64/176px. Applied list: clamp(220px,17vw,260px); inspector:
clamp(260px,20vw,300px); reference list: clamp(200px,16vw,240px). Keep uses a full-size plan
plus a 340px selected-object inspector; its photo is an unframed inner group. Review uses a concise
condition brief and a 400px generation inspector. Tablet and phone stack the relevant surfaces.
Camera position inputs and the full review condition list are explicit disclosures; preserve all
validators and recovery actions. Camera marker/handle text renders at 14 CSS pixels independently
of plan zoom; body movement and rotation hits remain separate.

Figma's current guide also lists Recraft, Krea, Adobe Firefly, Figma and Planner 5D interaction
patterns. Apply the task-local edit/export controls, progressive controls, shared canvas and direct
manipulation principles only. Do not import their branding, accounts or extra 2D/3D/CAD features.
