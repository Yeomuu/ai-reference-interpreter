# Codex execution contract — AI Reference Interpreter

Read `docs/PRODUCT.md`, `docs/DESIGN_SYSTEM.md`, `docs/INTERACTIONS.md`, `docs/ARCHITECTURE.md`, and `docs/QA.md` before coding. These files are the source of truth for product behavior, visual tokens, data types, code structure, and acceptance criteria. Do not use prior conversation context. Implement the actual service, not a research-themed demo.

## Priority
1. Product invariants and safety in PRODUCT/INTERACTIONS.
2. Design tokens and component rules in DESIGN_SYSTEM.
3. Architecture and acceptance criteria in ARCHITECTURE/QA.
4. Existing Figma reference for layout and proportions. The Figma wireframes are preliminary and contain abstract placeholders; these docs override inconsistent or missing behavior.

## Non-negotiable
- No maps, geocoding, street view, or address-search onboarding.
- Distinguish existing-space photos, inspiration photos, product photos and the floor plan. Never treat inspiration imagery as measured geometry.
- The floor plan is the **only authoritative 2D placement canvas**; space photos are references for existing appearance and geometry. If no plan is available, offer a clearly labeled schematic plan editor. Never claim its measurements are accurate.
- Keep means preserve an existing object/structure, not forbid all decoration at its location. Validate proposed operations for compatibility with preservation; allow removable wall art on a kept wall, forbid demolishing that wall. Door swing, passage clearance, window and pillar conflicts require explicit checks.
- Each design element has typed anchors and permitted targets: floor fixtures → floor points/areas; wall graphics → wall segments; suspended lighting → ceiling zones; wall-mounted light → wall; standing light → floor; ambient light/color/material → area/surface/whole-space. Invalid locations are disabled or rejected with a plain-language reason.
- One common space configuration; camera-specific viewpoints/results. A change in common configuration marks previous images as stale, never silently edits or deletes them.
- Preserve user control: AI suggestions must remain suggestions; keep/export and placement decisions are explicit user choices.
- All visible UI text is Korean. Never call the product a '연구용 와이어프레임'.
- Use Paperlogy only via legitimately obtained font assets or CSS @font-face with user-provided files. Include the verified supplied font assets and their license notices in production so development and deployment use the same fonts. Do not download unverified fonts or invent font URLs. Fallback to Noto Sans KR, then system sans-serif only when the intended font is unavailable.
- Use **only actually available free Nucleo UI Essential Outline SVGs**, sourced from the official free pack and only after checking licensing. Keep original assets in `public/icons/nucleo/` with attribution/license notice if required. Maintain explicit `docs/ICON_MANIFEST.md`: official asset filename → semantic component name → usage. If an icon is unavailable, use a text-only control until sourced; never use Lucide, emoji, homemade lookalikes, premium Nucleo icons, or hotlinked URLs as substitutes.
- Tokens and layout rules are not decorative suggestions: enforce them in components and CSS, do not scatter one-off hex colors, shadows, borders, font sizes or component variants.
- Never imply an AI image or spatial consistency was produced unless an actual configured image model ran. Without credentials show a functional 'demo mode' clearly marked as a preloaded sample, not a fictional network call.
- Avoid hardcoded API keys; no paid APIs required for basic navigation/placement. Use local browser persistence for MVP, verify file formats, sizes, CORS where applicable, and sanitize user-provided content.

## Work method
Inspect repository first. Plan minimal route and data model. Implement a fully usable vertical slice from project creation through placing typed elements, camera setup, review, results/sample state, revision and export. After each major change run available lint/typecheck/tests/build, inspect the rendered UI and keyboard paths, fix errors; do not claim tests you have not run. Do not add ornamental dashboards, gratuitous gradients, arbitrary colors or fake controls. If the source is inaccessible, preserve constraints from these local docs and report the missing source.

## User-directed preservation and recovery update · 2026-09-28
- A structure's origin (`base`/`partition`) is separate from its preservation lock. Original structures start preserved; the user can explicitly turn “필수 보존 (위치 고정)” off/on. Off permits validated plan correction; it never establishes physical relocation feasibility. Respect explicit off during reload/migration. Keep-aware conflict and typed-anchor checks still apply.
- Reference deletion must clean current derived elements, preserve historical results/attribution and offer persistent undo. Individual element deletion keeps its reference source. Retain any image asset used by current data, history or undo.
- The earlier three-page planning excerpt was superseded by the latest verified 14-page PDF. Do not claim direct access to inaccessible Google Doc tabs. Preserve the Reference → Element → Location and condition-revision workflow; do not introduce a CAD/3D system merely because an illustrative screen depicts it.

## User-directed labels, navigation and experiment update · 2026-09-28
- Actual structure names and one official lock badge replace numbered Keep labels. Preserve the current drawing tab/tool after saving.
- Project/step URLs must support browser history and reload. Optional study logs follow the latest 14-page PDF, last five pages plus relevant definitions, as documented in docs/EXPERIMENT_LOGGING.md. Do not claim an implemented free-text comparison, filled ground truth, server collection or human-coded accuracy.

## User-directed generation update · 2026-09-28
- Read the API key from server env; require no participant key, access code or invitation link. A durable shared private quota must reserve before paid calls, fail closed on storage faults, and reject replays. Current maximums are 60/day across all anonymous browsers and 20/day per signed anonymous browser, shared across Production/Preview. Both reset only at Korean midnight according to server time. Never reset on deploy, failure or a public request; preserve immutable replay claims and existing ledger records through migration.

## Design reference governance · supplied update 2026-09-28


The repository may include reference studies for Apple, Toss, Ohouse and The Pinkfong Company.
They are **reference inspiration only**. Never merge them into a synthetic brand or import their
exact colors, fonts, logos, proprietary assets, marketing layouts or context-specific component
geometry.

Apply their useful principles only through the project-owned `docs/DESIGN_SYSTEM.md`:

- Apple: content primacy, restrained chrome, clear action hierarchy, recoverability.
- Toss: explicit component states, predictable feedback, direct UI language.
- Ohouse: image-forward white workspace, quiet controls, avoid over-cardification.
- Pinkfong: strict boundary between identity assets, fonts and actual product UI.

When implementing a screen:
1. preserve the product invariant first;
2. use project semantic tokens;
3. use the shared component/state contract;
4. keep plan/reference/result imagery visually primary;
5. add visual polish only if it does not compete with the user's spatial work.

Never copy a reference brand's accent as a new product token. Never substitute its font for Paperlogy /
Noto Sans KR. Never add another icon library. A new visual token or component variant must be justified
in `docs/UX_SPEC_CHANGELOG.md`.


Latest visual source: Figma active v1.3 section `125:2` and Design System v1.2. Follow the reconciled current docs, not archived examples. Keep existing user-directed preservation, navigation, experiment and quota contracts.

## User-directed editing and batch update · 2026-09-29
- A fresh uploaded plan starts without the previous rectangle/annotations and releases current placements, with deletion undo; retaining old annotations is an explicit alternate choice. Preserve image aspect ratio. Schematic starters offer portrait/landscape or a manually traced polygon; curved edges are an approximation, never automatic extraction or measured CAD.
- Compatible removable graphics/lights may attach to a kept wall without repeated confirmation. Keep still locks the underlying geometry and blocks replacement/removal. Wall elements can transfer along connected corners; physical conflicts remain enforced.
- Applied reference count is unrestricted. Pack sources into bounded input contact sheets without extra model calls and validate their source/crop manifest. Products use an explicit display-support relation; product/support overlap is valid, floor-object/pillar/opening conflicts are not.
- Canvas Ctrl+Z/Ctrl+Shift+Z undo/redo edits within the current tab. Camera deletion preserves result history and is undoable. Batch generation selects existing cameras and consumes one reserved request per image, retains completed images on partial failure and blocks repeated clicks for the whole batch.

## User-directed typography, font deployment and navigation update · 2026-10-08
- Include the supplied web fonts in production; the earlier font-binary handoff prohibition is removed. Keep licensing and provenance records.
- The user now authorizes readable web typography over exact Figma text sizes: captions 12px, secondary content 14px, body 16px, category/progress labels 18px, titles 20–22px. Preserve appropriate existing 16–18px text. Reduce the home display copy and wordmark modestly while keeping their identity roles.
- Keep step navigation inside the side panel at its bottom, like Step 1. Place the reference panel on the right so navigation remains in the right side panel throughout the workflow. Keep a visible navigation fallback when a legacy inspector is explicitly hidden.
- Do not edit Figma. Keep source icons, colors, functionality and user data; verify development and production font loading, rendered typography and panel navigation.
