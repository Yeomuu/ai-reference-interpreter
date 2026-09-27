# Design system — AI Reference Interpreter / v1.1

## Design intent and reference hierarchy
A quiet white studio tool; the existing-space photos, reference imagery, plan and results are the focal objects. Functional styling inspired by Geist's disciplined tokens/density, Apple HIG's clarity and feedback, Samsung One UI's task hierarchy, Toss and Yeogi's predictable components and Wanted Montage's systematic reuse; **do not copy or import their assets**. Our specific numbers below are project decisions, not claims that the external guides prescribe them.

The seven white UI references supplied on 2026-09-26 guide the editor's visual finish: softly rounded outer panels, thin neutral dividers, compact segmented selections, a large uncluttered work surface, and one near-black primary action per task. They are visual references for a spatial editing service, not instructions to add a marketing hero, a decorative dashboard, a new color theme, or controls unrelated to the documented workflow. Functional behavior and the existing Figma layout hierarchy remain governed by the local product and interaction documents.

## Brand & palette
White content panels sit on a light neutral work surface. A near-black primary action and restrained muted violet active selection establish hierarchy. Keep, error and informational semantics have independent hues. No arbitrary vivid purple CTA, gradient surface, decorative illustrations or emoji. A single, very light elevation is permitted on outer panels; inner cards and form rows use borders and spacing rather than additional shadows.

The original brand mark lives in `public/brand/mark.svg`: a plan boundary and selected point using neutral-900, white and violet-200. Use this same mark in the header and favicon. It is brand identity artwork, not a substitute for Nucleo action icons.

```css
:root {
  --neutral-white:#FFFFFF; --neutral-25:#FBFCFD; --neutral-50:#F7F8FA;
  --neutral-100:#F1F3F6; --neutral-200:#E5E9ED; --neutral-400:#A3ABB5;
  --neutral-600:#56616F; --neutral-900:#17191D;
  --violet-50:#F0EDF9; --violet-200:#C7BEE8; --violet-500:#7568B8; --violet-700:#6253A8;
  --green-50:#E6F3EE; --green-700:#35725D;
  --red-50:#FAEFF1; --red-700:#A4505D;
  --blue-50:#EDF6FA; --blue-700:#3D7693;
  --surface-base:var(--neutral-white); --surface-subtle:var(--neutral-25);
  --surface-workspace:var(--neutral-50); --surface-selected:var(--violet-50);
  --surface-glass:rgb(255 255 255 / 94%); --surface-glass-fallback:var(--neutral-white);
  --text-primary:var(--neutral-900); --text-secondary:var(--neutral-600);
  --text-inverse:var(--neutral-white); --border-default:var(--neutral-200);
  --border-control:#87919C;
  --border-strong:var(--neutral-400); --border-selected:var(--violet-200);
  --action-primary:var(--neutral-900); --action-primary-text:var(--neutral-white);
  --action-selected:var(--violet-700);
  --state-keep-bg:var(--green-50); --state-keep-fg:var(--green-700);
  --state-error-bg:var(--red-50); --state-error-fg:var(--red-700);
  --state-info-bg:var(--blue-50); --state-info-fg:var(--blue-700);
  --canvas-structure:var(--neutral-600); --canvas-selection:var(--violet-500);
  --space-4:4px; --space-8:8px; --space-12:12px; --space-16:16px;
  --space-20:20px; --space-24:24px; --space-32:32px; --space-40:40px; --space-48:48px;
  --radius-4:4px; --radius-8:8px; --radius-12:12px; --radius-16:16px;
  --shadow-float:0 12px 32px rgb(23 25 29 / 8%);
  --shadow-panel:0 2px 12px rgb(23 25 29 / 4%);
  --shadow-footer:0 -2px 12px rgb(23 25 29 / 4%);
  --glass-blur:blur(10px);
  --control-height-32:32px; --control-height-40:40px; --control-height-44:44px; --control-height-48:48px;
  --font-ui:Paperlogy,"Noto Sans KR",system-ui,sans-serif;
}
```

**Usage rules:** neutral primary CTA max one per main task region, secondary button outlined/subtle; violet = selected node, selected segment, focus cue; green = Keep only/success; red = incompatible action or destructive action; blue = informational structural cue such as existing window. `--border-control` gives inputs and outlined actions a visible boundary on white. Never rely on color alone: include icon/text and stroke/shape differences. Keep layers and element markers remain readable above floor image. Distinguish product photo colors from UI semantic colors.

## Surfaces and editor chrome
- Outer project, source, workspace and result panels use an opaque white surface, a neutral border, a 16px radius and at most `--shadow-panel`. Child sections, condition rows and image frames remain flat. Hover or a genuinely floating menu may use `--shadow-float`; selected state still needs a visible border and text.
- Buttons, inputs and segmented controls use a 12px radius. Small status badges use 4px. Segmented tabs show one selected choice with `--surface-selected` and `--border-selected`; selection meaning must also be present in text or accessible state.
- The header, step navigation, fixed footer and detached workspace toolbar may use `--surface-glass` with `--glass-blur` over the light neutral page. Glass is a restrained chrome treatment. The floor plan, existing-space photos, references, results, inspector content and form panels stay opaque so visual evidence and text retain contrast.
- When backdrop filtering is unsupported or the user requests reduced transparency, use `--surface-glass-fallback`, remove blur and keep the neutral separating border. In forced-colors mode, preserve system-visible borders and focus outlines. No operation depends on blur, transparency or shadow to communicate state.
- The canvas has visual priority over surrounding chrome. Tool labels are concise, one toolbar owns each action, and long usage instructions live below the drawing or in an explicitly opened help area that stays available to assistive technology.

## Typography
Paperlogy is used in the local development view from the verified user-provided files recorded in [FONT_PROVENANCE.md](FONT_PROVENANCE.md), with Regular 400, Medium 500, Semibold 600 and Bold 700. The production build omits the TTF files and uses Noto Sans KR, then system sans-serif; do not invent a font URL. Desktop type ramp: page title 28/40 bold, larger heading 22/32 bold when needed, section/panel heading 18/28 semibold/bold, body 16/26 regular, compact body 14/22 regular, label 14/22 medium, compact label 12/18 medium, caption 12/18 regular. Operational source names, condition values and primary action labels are at least 14px; 12px is for secondary metadata and captions. Do not bundle the font binaries in a source handoff.

## Layout, responsive behavior
Desktop reference viewport 1440×900. Header 64, step/navigation bar ~56, main content max usable width 1368 with 36px horizontal margins. Plan/editor workspace at least 50% of content width. Staging board: left element panel 260–300, flexible plan, right inspector 300–340; 16–20px gutters. Both side panels have independent show/hide text controls and the central plan grows or shrinks with available width. Compact redundant canvas headings and help above the drawing so its full interaction surface fits above the fixed footer at 1440×900; task help can follow the drawing and remains announced through `aria-describedby`. Structure, area and passage editing belongs in a button group or adjacent controls within the plan workspace; the selected camera or element inspector remains alongside that same canvas on desktop. Panels are border-separated and use the same outer-panel treatment; avoid nested cards and stacked shadows. Use 8px spacing rhythm with permitted 4px adjustments. Content should scroll without hiding primary actions; viewport 768–1199: full-width plan first, then two panels below; viewport <768: plan-first with list and inspector available by default as a fallback and explicit guidance that detailed floorplan editing works best on desktop. Main images use contain for reference/plan and only crop when user opts into cropping; never distort the plan. Existing-space photo groups vertically center the current frame in a bounded panel height so the active frame and its navigation are visible in the first desktop viewport. Horizontal step navigation brings its current item into view on step changes, without a visible native scrollbar.

**Page hierarchy:** Projects shows the saved/sample list beside a single new-project form. Space pairs existing photographs with the plan and its compact provenance note. Keep places selected-structure status and permitted edits before the long list of fixed structures. References gives the selected source image the largest column and keeps extracted conditions legible in the right panel. Placement and Viewpoint share the same large center plan with independently collapsible side panels; task-relevant layers and a visible selected inspector stay together. Review leads with a compact count and summary of preservation, apply/exclude and camera conditions before expanded details. Results gives the sample/generated image priority, then approval/export actions, with history and the approved collection below; the condition inspector starts with the current view's actionable conditions before the complete Keep list.

## Components and states
- PrimaryButton: near-black fill/white text, 40 or 44px high, 12px radius; hover/pressed/focus-visible/disabled/loading; never two competing primaries in one panel.
- SecondaryButton: white + `--border-control` outline, neutral label, 12px radius; destructive button separate red semantic.
- IconButton: ONLY verified official free Nucleo UI Essential Outline SVG from the approved manifest, 40×40 hitbox, icon 18–24px, descriptive aria-label. A static SVG rendered from an unchanged official free Nucleo component is permitted when that official package contains components rather than standalone SVG files. If a matching verified asset is missing, use a short text-only button.
- Input / Select / Textarea: label + optional helper/error; 40–44px height for single-line, 12px radius, `--border-control` outline, focus-visible ring violet 2px with offset, disabled/read-only distinction, inline validation.
- ReferenceCard: fixed preview crop + readable source name + role (ambience/product/element) + apply/exclude state, selection indicated by border and text. Core condition and apply/exclude actions keep at least a 40px high hit area and 14px labels.
- PlanSourceNote: a compact note adjacent to the Space plan identifies sample schematic, manually started schematic or uploaded image before the structure/area button group; never suggest photo-derived geometry. Do not duplicate the button group's actions inside the note.
- ElementCard: source label, type, target constraint, status (not placed/placed/conflict/excluded), may not be dragged onto arbitrary pixels. Saved apply/exclude and appearance/material conditions and type are plain text in Reference and Placement views until the user chooses condition editing; edit fields have explicit Save/Cancel actions.
- KeepMarker: persistent green-tinted shape + numbered/text marker; identify mandatory original structure separately from optional Keep. A fixed marker may be selected for information but must not use move handles, `grab` cursor or draggable hover styling. A selected-item explanation states what the user may edit.
- PlanCanvas: synchronized plan-image, structure/Keep, applied-element and camera layers, filtered by task; zoom with Reset, safe empty states and no cursor-only interaction. Space and Keep emphasize structures, Placement shows structures and proposed elements, and Viewpoint adds camera markers to those context layers. A placed compatible floor element has an actual drag target and a visible rotation control; a wall element slides along its assigned wall; an optional unkept partition can be dragged while fixed/kept structures remain selectable only. In Viewpoint the camera body is visually distinct from its labeled rotation handle, with separate drag affordances; on narrow screens the two transparent hit regions remain large and separated without increasing the visual cone. Invalid saved camera positions show a persistent inline reason in the inspector. Empty-floor clicks do not relocate a camera. Use a normal pointer for click placement and crosshair only while drawing a region. Keyboard-selectable plan structures and selectable element list + numeric/semantic location fallback remain available. Generic plan pan mode is not part of this 2D flow.
- PlacementInspector: shows only controls permitted by current element type. Wall graphics must not expose free-floor X/Y; global ambient settings must not expose point dragging.
- ConditionSummary: group preservation, applied elements with sources/targets, excluded items and selected camera. A long Keep list has a visible count and expandable details so applied/excluded/camera conditions remain near the top. Add a concise synthesis of the intended mood derived from these inputs and explicitly label it as an input-conditions summary. Link each issue to its actual editable source state.
- GenerationPanel: place the paid AI request beside the reviewed conditions, with one near-black primary action only when generation is configured. Show one-image/quality scope, sourced output-price example and variable input cost, image-transfer notice, and a labeled access-code field before that action. Keep the preloaded sample as a separate outlined action with its provenance visible; when generation is unavailable, the sample becomes the sole primary action. A readiness check must not look like a generated result.
- ResultViewer: largest imagery; adjacent non-overlapping settings and clear version/approval/stale status. Result history and approved images use one prominent item, adjacent-edge preview, current/total count, previous/next text controls and pointer drag; center the active approved image so each available neighbor appears as a small edge. Hide the horizontal scrollbar without blocking keyboard navigation. Keep new preview and saved history actions visually and verbally distinct.
- Toast/InlineAlert: informative status messages, never the sole source of error explanation. Noncritical notices wait three seconds, then fade gradually; preserve immediate close. Must-read errors remain until dismissal or resolution. Modal only for high-impact irreversible actions.

## Icons — Nucleo free only
Use only verified official free **Nucleo UI Essential Outline** SVG geometry. The authorized free React package `nucleo-ui-essential-outline-18@1.1.7` contains official icon components but no standalone SVG files, so static SVG renderings of those components with unchanged paths, viewBox and colors are allowed. `docs/ICON_MANIFEST.md` records each real package module name, local SVG filename, official source, license and copyright notice; `public/icons/nucleo/` contains only those approved outputs and the required notice. Never treat Nucleo's paid collection as free, guess a filename, draw an imitation or use another library. If the manifest lacks a verified semantic match, keep the control text-only.

## Accessibility and quality bar
WCAG AA contrast targets: body text ≥4.5:1; essential icons/controls ≥3:1; verify actual token combinations on opaque and glass-backed surfaces. Keyboard navigation and clear focus ring. All status/Keep/invalid placement feedback includes text. Motion 150–220ms for minor state changes; notice fade can last longer to make the transition legible. Respect reduced-motion and reduced-transparency preferences; glass falls back to solid white without hiding labels or borders. Prevent focus traps; don't auto-scroll unexpectedly. Keep user images unfiltered by UI chrome.
