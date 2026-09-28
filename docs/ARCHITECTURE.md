# Suggested Codex implementation architecture

This is a starting architecture, not a requirement to change an existing repository. If empty, use React + TypeScript + Vite, CSS variables/design token stylesheet, and a small accessible component layer; avoid adding large design-system dependencies or a paid backend. Choose and explain canvas approach (SVG with typed hit areas is sufficient for schematic MVP). Keep image, preservation-controlled structure, movable element and camera overlays in one normalized coordinate system, while rendering only the layers relevant to each task. Optionally use a lightweight drag library only if necessary and tested with zoom, resize and typed validation; a generic pan tool is unnecessary for this 2D workflow.

```text
src/
  app/              router, shell and page flow
  domain/           typed entities, Keep compatibility, placement matrix, validation, revision rules
  components/ui/    buttons, fields, dialogs, notices and NucleoIcon (manifest based)
  components/space/ plan renderer, layered tools, hit-test, direct manipulation and inspector
  features/project/ import and schematic editor
  features/keep/    user-controlled preservation, remembered conditions and structural origin
  features/reference/ image roles, selection/exclusion and element cards
  features/placement/ domain-safe placement tools
  features/camera/  per-viewpoint editing
  features/results/ review, sample/provider adapter, revisions, export
  styles/           tokens.css, typography.css, layout.css
  data/             sample project with explicit non-measured plan and demo images
  services/         persistence, imageProvider interface and optional implementation
public/icons/nucleo/ verified official free icon geometry only; static SVG exports of unchanged official components are allowed and mapped in ICON_MANIFEST.md
```

Data must have stable IDs, serialization and versioned local persistence. Validate nested persisted plan, structure and area shapes before restoring them; quarantine malformed records without rendering them or overwriting their original data. Use React state or lightweight store with explicit actions; domain validation pure functions (unit tested) separate from UI. Do not mutate data during render. Avoid storing blob/object URLs in permanent project records without a persistent asset strategy (IndexedDB suggested); use localStorage only for small JSON and safe data. Prefer export JSON with schemaVersion plus image files/assets, or communicate limits of export. Do not fake successful download or provider integration. Workflows should operate with offline sample content and no secrets.

## Optional live image path
The deployed Vite app may add a small server function for live OpenAI image creation while preserving the offline sample provider. Keep `OPENAI_API_KEY` and Blob credentials in server-only environment variables, never in Vite-prefixed client configuration, source control, project records or network responses. A public status route reports availability without a paid call or secret material. The generation route requires no user credentials, validates the serialized project and selected camera with the same domain preflight, restricts image roles/count/type/size and issues one image request only after explicit user action. Keep model/quality/size and operator price metadata in one configuration. The participant panel uses concise one-image guidance and does not render API pricing; getGenerationStatus reads availability and quota only, and is not a generation-progress endpoint. Uploaded and generated binaries live in IndexedDB on the user's browser; localStorage contains only `asset://` references and snapshots. Preserve earlier results on provider failure and mark asynchronous output stale if the source project or camera changed during execution. A local Vite development server does not itself host Vercel Functions; use the deployed environment or a compatible local function runner for end-to-end verification.

## References
- Google Doc: https://docs.google.com/document/d/1ACvyr2W8FkFqxCOeUUGbDniS8gvQctPcwj4BFovNLSw/edit
- Figma final active wireframes v1.3: https://www.figma.com/design/J2ZHftzWmLR7OQhpyMFJQA/?node-id=125-2
- Figma current Design System v1.2: https://www.figma.com/design/J2ZHftzWmLR7OQhpyMFJQA/?node-id=111-2

The current app loads semantic values from `src/styles/tokens.css`, shared component rules/states from `app.css`, the final responsive workspace hierarchy from `studio.css`, and bounded viewport/scroll ownership from `viewport.css` in that order. Component SVG/photo/carousel styles retain their own boundaries. This design update introduces no dependency, route migration, stored-schema migration, paid API path or research feature. Camera label offsets and pixel sizing are presentation only.
- Reference UI guides: https://vercel.com/geist/introduction ; https://developer.apple.com/design/human-interface-guidelines ; https://developer.samsung.com/one-ui ; https://tossmini-docs.toss.im/tds-mobile/ ; https://designlibrary.yeogi.com/ ; https://montage.wanted.co.kr/
- Official Nucleo site: https://nucleoapp.com/ (only verified official free pack assets are permitted).

## Editing actions · 2026-09-28

Project navigation uses `/projects/:projectId/:step`, History `pushState` and `popstate`, with a Vercel SPA rewrite for direct entry. Reload restores the correct locally saved project and its own selection defaults. Unknown project IDs return to the list with a reason. This route is not a public project-sharing database.

Optional experiment collection lives separately from project records at `ai-reference-interpreter:experiment:v1`. An explicit opt-in recorder saves meaningful, schema-versioned events and final assessment conditions, excludes source pixels/URIs/filenames and credentials, and exports a real UTF-8 ZIP. The source, field definitions, event coverage, metrics and limitations are documented in [EXPERIMENT_LOGGING.md](EXPERIMENT_LOGGING.md). It does not invent server timestamps, condition accuracy or free-text trials.
`setStructurePreservation` synchronizes the lock and active Keep independently of `Structure.role`. `structureEditing.ts` owns shape-preserving translation, wall-constrained openings and connected-child checks. Canvas previews use the same translation as commits, and domain validators reject new collisions. `removeReference` cascades current derived elements while retaining result snapshots and source metadata; `removeDesignElement` clears its extraction links. A single pending UI undo stores changed common fields and its expected project/revision. Image cleanup considers stored history and undo before deleting IndexedDB records. Optional role/settings/source-image snapshot fields preserve compatibility with schema version 1, and persistence validates their nested shapes.

## Shared generation quota · 2026-09-28
`api/_lib/generationQuota.ts` uses the official `@vercel/blob@2.8.0` SDK and private Blob `generation-quota/v1.json`. Strong reads (`useCache:false`) and ETag conditional writes (`ifMatch`) serialize reservations across instances, tabs, users and Production/Preview. One initialized ledger retains every request UUID; 60 total reservations never reset on deployments or midnight, while 20/day follows Korea time. One active lease lasts 240 seconds, longer than the function/provider deadline; successful/error response releases only its own lease, never usage. A crash leaves usage consumed and the lease expires. No public initialization/reset route. Missing or malformed state, storage faults, duplicate UUIDs and cap exhaustion stop before the model. Quota stores only anonymous request UUID/time/day, not project inputs or study events. This is a generation-count cap, not a dollar-accurate invoice cap. Source: https://vercel.com/docs/vercel-blob/using-blob-sdk .
