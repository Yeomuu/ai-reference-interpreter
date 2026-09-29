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
The deployed Vite app may add a small server function for live OpenAI image creation while preserving the offline sample provider. Keep `OPENAI_API_KEY` and Blob credentials in server-only environment variables, never in Vite-prefixed client configuration, source control, project records or network responses. A public status route reports availability without a paid call or secret material. The generation route requires no user credentials, validates the serialized project and selected camera with the same domain preflight, restricts image roles/count/type/size and issues one image request only after explicit user action. Keep model/quality/size and operator price metadata in one configuration. The participant panel uses concise one-image-per-selected-view guidance and does not render API pricing; getGenerationStatus reads availability and quota only, and is not a generation-progress endpoint. Uploaded and generated binaries live in IndexedDB on the user's browser; localStorage contains only `asset://` references and snapshots. Preserve earlier results on provider failure and mark asynchronous output stale if the source project or camera changed during execution. A local Vite development server does not itself host Vercel Functions; use the deployed environment or a compatible local function runner for end-to-end verification.

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
`api/_lib/generationQuota.ts` uses the official `@vercel/blob@2.8.0` SDK and private Blob `generation-quota/v1.json`. Strong reads (`useCache:false`) and ETag conditional writes (`ifMatch`) serialize reservations across instances, tabs, users and Production/Preview. The existing ledger migrates to version 2 in place without recreation. Current-day reservations enforce 60/day across all browsers and 20/day per signed anonymous browser at Korean midnight; deployments never reset usage. Immutable per-request claim blobs and retained legacy IDs reject replay across days. One active lease lasts 240 seconds, longer than the function/provider deadline; successful/error response releases only its own lease, never usage. A crash leaves usage consumed and the lease expires. No public initialization/reset route. Missing or malformed state, storage faults, duplicate UUIDs and cap exhaustion stop before the model. Quota stores only request UUID/time/day and a hashed anonymous browser identity, not project inputs or study events. This is a generation-count cap, not a dollar-accurate invoice cap. Source: https://vercel.com/docs/vercel-blob/using-blob-sdk .

## Current implementation extensions · 2026-09-29
- `domain/geometry.ts`: polygon validity/interior containment, preserving normalized coordinates. `Area.outline` is optional within schema 1; persistence validates the polygon and matching bounds. Uploaded plan dimensions remain the canvas aspect ratio. Old data still loads.
- `domain/display.ts`: applied support relations and position transforms; dependency cleanup in revisions. `domain/structureEditing.ts` adds validated shape/end-point correction alongside existing translation. Shape edits cannot mutate locked structures or silently detach connected openings.
- `components/plan-labels.ts` packs name/lock controls in CSS pixels around marker obstacles. Labels render after geometry; separate sibling name and lock buttons avoid nested buttons. `plan-drawing.ts` projects drags onto connected host walls with physical span preservation.
- App keeps 50 past/future common+camera edit snapshots per project in memory. Undo/redo writes through normal persistence and revision rules, retains results and preserves referenced assets. Full history ends on reload; the established one-action deletion undo remains persistent. Canvas draft vertex undo is local and precedes saved-state undo.
- `api/_lib/generationIdentity.ts` signs a random UUID cookie using server-only `GENERATION_IDENTITY_SECRET`, falling back to the existing server API key if unset. HttpOnly/SameSite=Strict/Secure prevents client JS access; POST requires a valid cookie obtained by status GET. API-key rotation without a separate stable secret reissues browser identities, while the shared cap remains. This is browser identity, not authentication or a cross-device participant identity.
- Quota schema 2 retains the existing Blob path/ETag and migrates version 1 lazily. Legacy current-day usage counts against the shared limit; old rows had no browser ID and cannot be attributed retrospectively. Append an immutable `generation-quota/requests/:uuid.json` claim before the conditional ledger reservation. Failure at any storage step stops before a model call. Successful reservation charges once even on provider failure. Midnight rollover uses trusted server time, retains legacy IDs/claims, and never deletes the ledger. Active 240-second lease spans midnight until expiry/release. There is no public reset route.
- `generationContract.ts` canonical source/crop manifests and `imageProvider.ts` numbered contact sheets include all applied reference sources in at most three reference inputs. Server verifies complete coverage/order/roles before reserving. Existing 5-image, 550 KB/image, 4 MB/body and 16k-character prompt bounds remain. Contact-sheet packing reduces per-source resolution; no hidden provider retry or extra image call.
- Review's sequential multi-camera loop captures one common configuration, creates a unique UUID per camera, persists each result, marks asynchronously outdated snapshots stale and stops on failure. Its ref-based lock spans the whole batch and final status refresh. Optional camera snapshot names preserve attribution after deletion without invalidating old snapshots.

API와 API에서 참조하는 도메인/서비스 모듈은 NodeNext 타입 검사와 `.js` 명시 상대 import를 사용한다. Vite bundler 검사만으로 Vercel Node 함수가 정상이라고 판단하지 않으며, 서버 빌드 진단과 프로덕션의 잘못된 입력 거부 경로도 확인한다.
