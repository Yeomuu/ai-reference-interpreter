# Suggested Codex implementation architecture

This is a starting architecture, not a requirement to change an existing repository. If empty, use React + TypeScript + Vite, CSS variables/design token stylesheet, and a small accessible component layer; avoid adding large design-system dependencies or a paid backend. Choose and explain canvas approach (SVG with typed hit areas is sufficient for schematic MVP). Keep image, immutable structure, movable element and camera overlays in one normalized coordinate system, while rendering only the layers relevant to each task. Optionally use a lightweight drag library only if necessary and tested with zoom, resize and typed validation; a generic pan tool is unnecessary for this 2D workflow.

```text
src/
  app/              router, shell and page flow
  domain/           typed entities, Keep compatibility, placement matrix, validation, revision rules
  components/ui/    buttons, fields, dialogs, notices and NucleoIcon (manifest based)
  components/space/ plan renderer, layered tools, hit-test, direct manipulation and inspector
  features/project/ import and schematic editor
  features/keep/    permanent base structures, optional Keep and removable partition manager
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
The deployed Vite app may add a small server function for live OpenAI image creation while preserving the offline sample provider. Keep `OPENAI_API_KEY` and `GENERATION_ACCESS_CODE` in server-only environment variables, never in Vite-prefixed client configuration, source control, project records or network responses. A public status route reports availability without a paid call or secret material. The generation route requires the access code, validates the serialized project and selected camera with the same domain preflight, restricts image roles/count/type/size and issues one image request only after explicit user action. Keep the model/quality/size and output-price example in one configuration so the client can show their real scope. Uploaded and generated binaries live in IndexedDB on the user's browser; localStorage contains only `asset://` references and snapshots. Preserve earlier results on provider failure and mark asynchronous output stale if the source project or camera changed during execution. A local Vite development server does not itself host Vercel Functions; use the deployed environment or a compatible local function runner for end-to-end verification.

## References
- Google Doc: https://docs.google.com/document/d/1ACvyr2W8FkFqxCOeUUGbDniS8gvQctPcwj4BFovNLSw/edit
- Figma current wireframes: https://www.figma.com/design/J2ZHftzWmLR7OQhpyMFJQA/?node-id=107-2
- Reference UI guides: https://vercel.com/geist/introduction ; https://developer.apple.com/design/human-interface-guidelines ; https://developer.samsung.com/one-ui ; https://tossmini-docs.toss.im/tds-mobile/ ; https://designlibrary.yeogi.com/ ; https://montage.wanted.co.kr/
- Official Nucleo site: https://nucleoapp.com/ (only verified official free pack assets are permitted).
