# StudyIE Math Notebook — Design System Index

> **Source of truth:** `apps/web/design-system/math-notebook/tokens.json`
> **Code mirror:** `apps/web/app/assessment/_engine/tokens.ts`
> **Inspiration tag:** `responsive-utility-saas` (responsive primitives layered on top of an unchanged palette/typography)

This index file points to the project's canonical design system. Per-page overrides live under `math-notebook/pages/` and supersede the master only for that page.

## Layers

| Layer | File | Role |
|-------|------|------|
| 1 — Project master | `math-notebook/MASTER.md` + `math-notebook/tokens.json` | Canonical palette, typography, motion, **responsive primitives** |
| 2 — Code | `apps/web/app/assessment/_engine/tokens.ts` | Typed exports consumed by every component |
| 3 — Page overrides | `math-notebook/pages/*.md` | Page-specific deviations (none currently) |

## Versioning

| Field | Value |
|-------|-------|
| schemaVersion | `2.1.0` |
| sha256 (tokens.json) | `2268026a85c4f44f5cf9cd7becdd0308557064e1c9451739bab9fe3566832378` |
| Last update | 2026-05-03 |
| Change | Added responsive primitives — breakpoints, fluid type scale, fluid space ramp, touch targets, container widths. No palette / typography changes. |

## Responsive guarantee

The desktop chrome (zinc neutrals, indigo accent, Inter, three-pane 264 / 1fr / 1.4fr grid) is **unchanged at lg+ breakpoints**. Below 1024 px the layout reflows:

- **< 768 (mobile):** single-column stack — question pane + choices on top of workings; chat collapses into a bottom-sheet drawer; sidebar collapses to slide-over. Stage stops scaling so text stays legible.
- **768 – 1023 (tablet):** two columns — contents collapsed to a 64 px rail, main pad stacks chat above workings.
- **≥ 1024 (desktop):** three-pane grid (current behaviour).

Touch targets read from `tap.touch` (44 px) on coarse-pointer devices and `tap.pointer` (32 px) on fine-pointer; type sizes use the `fontSizeFluid` clamp() ramp; spacings use `spaceFluid`.

See `math-notebook/MASTER.md` "Responsive primitives (added in 2.1.0)" for the full rationale.
