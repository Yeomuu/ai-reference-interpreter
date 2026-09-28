# Design reference synthesis — AI Reference Interpreter

## Purpose

This document explains how the four supplied `DESIGN*.md` reference studies should influence
AI Reference Interpreter.

It is **not** a token merge. The source brands remain separate products with different contexts.
Their exact colors, fonts, logos, marketing geometry and proprietary components must not be imported.

Project product behavior remains governed by:

1. `PRODUCT.md`
2. `INTERACTIONS.md`
3. `DESIGN_SYSTEM.md`
4. `ARCHITECTURE.md` / `QA.md`
5. this reference synthesis
6. external visual references

---

## 1. Apple — what to take

### Adopt as principles

- Let content remain visually primary.
- Keep controls restrained and familiar.
- Prefer one clear chromatic/action emphasis in a local composition.
- Make state and selected items explicit.
- Preserve context and allow recovery from mistakes.
- Treat transparency/glass as a functional chrome layer, not decoration across content.

### Do not copy

- Apple blue
- SF Pro
- pill geometry
- Apple marketing page spacing
- Liquid Glass as a decorative site-wide material
- Apple Store/HIG components as direct component templates

### Translation to this service

The plan, source photographs, references and results are the "content."
The editor chrome should become quieter as the central evidence becomes more important.

---

## 2. Toss — what to take

### Adopt as principles

- Color should communicate function.
- Action components require explicit state contracts.
- Loading/disabled/pressed/focus states are part of the component definition.
- Labels and feedback should say what happens next.
- Repeated patterns should behave consistently.

### Do not copy

- Toss blue
- Toss Product Sans
- TDS mobile 56px xlarge button geometry
- fintech-specific weak/primary color variants
- mobile component density on desktop

### Translation to this service

Primary actions stay near-black.
Violet remains selection/focus.
Keep/error/info keep independent semantic colors.
The important Toss influence is **state completeness**, not visual branding.

---

## 3. Ohouse — what to take

### Adopt as principles

- White/neutral UI can stay quiet around visually rich space imagery.
- Image-led surfaces should not be over-framed.
- Product/reference imagery can carry much of the visual hierarchy.
- Use compact controls and neutral text around large media.
- Avoid treating every content item as a raised card.

### Do not copy

- Ohouse action blue
- Pretendard as a service font token
- commerce card/price/badge patterns
- unverified mobile/responsive behavior

### Translation to this service

Reference and result screens should feel image-forward.
Use outer-panel framing only where it clarifies workspace boundaries.
Inside those panels, rely on spacing/dividers instead of stacked cards.

---

## 4. The Pinkfong Company — what to take

### Adopt as principles

- Keep identity assets and product UI assets separate.
- Do not generalize one brand accent into every interface state.
- Treat fonts and identity assets as provenance-sensitive resources.
- Preserve surface/context boundaries when adapting references.

### Do not copy

- Pinkfong pink
- Baby Shark display font
- corporate CTA geometry
- entertainment/child-facing tone
- franchise identity assets

### Translation to this service

`public/brand/mark.svg` is our identity mark.
Nucleo is the action-icon source.
Paperlogy is the local UI font source.
Semantic status colors belong to the product system.
These roles must not be mixed.

---

## 5. Combined design position

The service should feel like:

> A calm, image-forward spatial editor where the plan and visual references are primary,
> states are explicit, actions are predictable, and brand styling never competes with the user's work.

### Five governing principles

1. **Evidence first**  
   Space photos, plan, references and results dominate the composition.

2. **One task, one primary action**  
   A local region should not present competing filled CTAs.

3. **State is visible**  
   Selected, fixed, Keep, invalid, stale, sample/AI and loading states must be explicit.

4. **Structure before decoration**  
   Use spacing, borders, hierarchy and type before shadow, glass, accent or animation.

5. **Source boundaries are real**  
   Do not silently borrow brand colors, proprietary fonts, icons or component geometry from references.

---

## 6. Reference → project mapping

| Reference quality | Project application |
|---|---|
| Apple content primacy | plan/reference/result remain visually dominant |
| Apple limited action accent | one near-black primary action per task region |
| Apple agency/recovery | explicit save/cancel, stale history, reversible edits |
| Toss state contracts | full action/input state definitions |
| Toss direct language | short Korean labels and plain-language errors |
| Ohouse image-forward surface | large media, quiet controls, limited framing |
| Ohouse light outer structure | white surface + thin border, minimal inner cards |
| Pinkfong provenance boundary | brand mark ≠ action icon ≠ semantic color ≠ user asset |

---

## 7. What this update intentionally does not change

- No maps/geocoding/street view.
- Floor plan remains the authoritative 2D placement canvas.
- Keep remains a preservation rule, not a blanket exclusion zone.
- Elements retain typed placement targets.
- Camera editing remains in Viewpoint.
- Free sample and paid AI generation remain separate.
- Paperlogy/Noto fallback policy remains.
- Nucleo free-only icon policy remains.
- Existing product flow and domain validation remain governed by current product documents.

## 8. Current Figma guide verification · 2026-09-28

The public `ARI · Design System / v1.2` guide (node `111:2`) was visually inspected, including
its `REAL PRODUCT REFERENCE PATTERNS` table. It names Recraft, Krea, Adobe Firefly, Figma and
Planner 5D as examples of task-local editing/export, progressive disclosure, nearby image actions,
a shared central canvas and direct plan manipulation. This is an interpretation of the supplied
Figma reference, not a claim of new independent audits of those services. Apply those principles
through this project's own tokens and working controls; add no CAD, 3D, account or marketing flow.

Latest active layouts: `AI Reference Interpreter · 사용자 중심 와이어프레임 · v1.3`, node `125:2`.
The v1.0/v1.2 wireframe groups marked archive are historical. Current product-directed lock,
route, logging and direct-generation contracts override stale numbered Keep and access-code examples.
