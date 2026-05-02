# Math Notebook — Design System (Master)

> **Logic:** When building a specific page, first check `design-system/math-notebook/pages/[page-name].md`. If that file exists, its rules **override** this Master file. Otherwise follow the rules below verbatim.

**Project:** Math Notebook · adaptive Project-Maths assessment
**Aesthetic:** Modern, clean, education-friendly. Inter typography, zinc neutral surface, indigo accent, flat cards with subtle shadow elevation. **Not** a hand-drawn or pencil aesthetic.
**Canonical machine version:** `tokens.json` in this folder. CSS values must come from there — do not invent.

---

## Color palette

| Role | Hex | Token |
|------|-----|-------|
| Canvas (page) | `#fafafa` | `color.bg.canvas` |
| Surface (cards) | `#ffffff` | `color.bg.surface` |
| Muted surface | `#f4f4f5` | `color.bg.muted` |
| Border default | `#e4e4e7` | `color.border.default` |
| Border subtle | `#f1f5f9` | `color.border.subtle` |
| Ink primary | `#18181b` | `color.ink.primary` |
| Ink secondary | `#3f3f46` | `color.ink.secondary` |
| Ink muted | `#52525b` | `color.ink.muted` |
| Ink soft | `#71717a` | `color.ink.soft` |
| **Accent primary** | `#4f46e5` | `color.accent.primary` |
| Accent hover | `#4338ca` | `color.accent.primaryHover` |
| Accent soft | `#eef2ff` | `color.accent.primarySoft` |
| Accent edge | `#c7d2fe` | `color.accent.primaryEdge` |
| Good (correct) | bg `#ecfdf5` · ink `#047857` · edge `#a7f3d0` | `color.feedback.good*` |
| Warn (in-progress) | bg `#fffbeb` · ink `#b45309` · edge `#fcd34d` | `color.feedback.warn*` |
| Bad (wrong) | bg `#fef2f2` · ink `#b91c1c` · edge `#fecaca` | `color.feedback.bad*` |
| Info | bg `#eff6ff` · ink `#1d4ed8` · edge `#bfdbfe` | `color.feedback.info*` |
| Pen swatches | black `#18181b` · blue `#2563eb` · red `#dc2626` · green `#059669` · amber `#d97706` | `color.pen.*` |

**Contrast:** All ink-on-surface pairs ≥ 4.5:1. Don't put muted ink on muted bg.

---

## Typography

**Family:** `Inter` only — across all UI chrome, headings, and body. Mono is reserved for raw data (sessionId, JSON debug).

Google Fonts import (already wired in `app/layout.tsx`):
```
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
```

**Weight scale:** 400 regular · 500 medium · 600 semibold · 700 bold. Hierarchy is weight-driven, not family-driven.

**Size scale (px):** micro 11 · tiny 12 · small 13 · body 14 · bodyLg 15 · lead 16 · h4 17 · h3 20 · h2 24 · h1 32 · celebration 64.

**Letter-spacing:** `-0.02em` on h1/h2 only. Never on body. Uppercase eyebrows get `+0.06em`.

**Line-height:** 1.5–1.6 for body · 1.15–1.2 for headings.

---

## Layout

**Stage:** 1280×800 art-board, scaled `min(vw/1280, vh/800, 2)` so the notebook fills the viewport. The 2× cap prevents pixelation on 4K.

**Three-pane workbook grid (assessment):** `264px 1fr 1.4fr` — Contents · Chat · Workings. 1px `color.border.default` between panes — never the dark wood frame, never inset shadows.

**Top bar:** 56 px min-height, white surface, 1px bottom border, M-monogram chip (28×28 indigo `radius.md`) + product name `h4 semibold` + separator + tagline. Stat row right-aligned.

**Footer:** white surface, 1px top border, `color.ink.soft` 12 px text.

**Containers:** Always `radius.lg` (12) for cards, `radius.xl` (16) for hero/dialog. Buttons are `radius.md` (8). Pills are `radius.pill`.

---

## Elevation

| Layer | Value |
|-------|-------|
| Card (default) | `shadow.xs` = `0 1px 2px rgba(15,23,42,0.04)` |
| Hover/raised | `shadow.sm` |
| Floating panel | `shadow.md` |
| Dialog | `shadow.lg` |
| Focus ring | `0 0 0 3px rgba(99,102,241,0.2)` |

No inset shadows. No box-shadow imitating paper texture.

---

## Component patterns

### Card (`SketchBox` / `Card`)
Flat white surface, 1 px `color.border.default`, `shadow.xs`, `radius.lg`. The `seed` / `sw` legacy props are accepted but ignored.

### Button (`SketchBtn` / `Button`)
- **primary** — indigo bg, white ink, no border, hover `primaryHover`
- **secondary** — white bg, 1px border default, active state uses `accent.primarySoft` bg + `accent.primaryEdge` border + `accent.primaryInk` text
- **ghost** — transparent, hover `bg.muted`
- Min height 38 px (small 30 px). `cursor: pointer` always.
- Transition: `120ms cubic-bezier(0.4, 0, 0.2, 1)` on background/border/color only.

### Chat bubble
- **Tutor:** white surface, 1px border, `radius: 14` with `borderTopLeftRadius: 4`. Author caption uppercase tiny semibold in mood color.
- **You:** indigo `accent.primary`, white ink, right-aligned, `radius: 14` with `borderTopRightRadius: 4`. No border.
- Bubble width caps: tutor 88 %, you 78 %.
- Group consecutive messages from the same author — show "tutor" caption only on the first in a run.

### Feedback ribbon
Inline pill: feedback bg + 1px feedback edge + feedback ink. `radius.pill`, `fontSize.tiny`, weight medium.

### Tutor avatar
28–40 px circular chip, `accent.primarySoft` bg, indigo "T" initial, semibold. Mood-colored status dot bottom-right; pulses (`mn-pulse 1.4s infinite`) only when `talking`.

---

## Iconography

**Lucide-style** line glyphs: 24×24 viewBox, **1.6 px stroke**, rounded line caps and joins, `currentColor` ink. All glyphs in `_components/glyphs.tsx`. Standard sizes: 13/14/16/20.

**Never use emojis as UI icons.** Emojis allowed only as user/tutor-authored content inside chat bubbles or feedback ribbons.

---

## Motion

- Micro-interactions: `120ms cubic-bezier(0.4, 0, 0.2, 1)` (token `motion.fast`).
- Standard: 200 ms (`motion.base`).
- Transitions: only `background`, `border-color`, `color`, `opacity`, `transform`. **Never** width/height. No layout-shifting hover scale.
- Celebration pop: `mn-pop 1.1s` keyframe (defined in `globals.css`).
- Talking pulse: `mn-pulse 1.4s` keyframe.
- Respect `prefers-reduced-motion` — already wired in `globals.css`.

---

## Accessibility (mandatory)

- Touch targets ≥ 44 px (small variants ≥ 30 px).
- All interactive elements have visible focus (`:focus-visible` → 3 px indigo glow ring).
- Icon-only buttons must have `aria-label` or `title`.
- Live regions (`role="status"` `aria-live="polite"`) for celebration overlay and ribbons.
- Color is **never** the only signal — pair with glyph (Tick/Cross/Dot) and text.
- Text contrast ≥ 4.5:1 across all surface combinations.
- Keyboard nav must visit all sidebar question rows, all answer choices, all tool buttons in DOM order.

---

## Anti-patterns (do not reintroduce)

1. ❌ Hand-drawn / pencil aesthetic. No SketchBox SVG-path jitter, no dashed pencil borders.
2. ❌ Caveat or Kalam fonts. Inter only.
3. ❌ Dark-wood letterbox frame around the stage. Stage background is `bg.canvas`.
4. ❌ Cream / sepia paper colors. Use `bg.surface` (#ffffff) for paper-like surfaces.
5. ❌ Emojis as UI icons. SVG only.
6. ❌ Lowercase-only display text. Sentence case for prose, Title Case for buttons, UPPERCASE for tiny eyebrows only.
7. ❌ Hover transforms that move/scale layout. Color & opacity transitions only.
8. ❌ Inventing colors. Pull every value from `tokens.json`.

---

## Pre-delivery checklist

- [ ] `tokens.json` opened — all colors and font sizes match.
- [ ] No emoji icons (`grep -RIn "[\\u{1F300}-\\u{1FAFF}]" app` returns nothing in JSX).
- [ ] All buttons have `cursor: pointer` (Button primitive enforces this).
- [ ] All icon-only buttons have `aria-label`.
- [ ] `prefers-reduced-motion` works (Mac System Settings → Display → Reduce motion).
- [ ] Touch targets ≥ 44 px on tools / answer choices.
- [ ] Sidebar text contrast 4.5:1 between `ink.muted` and `bg.surface`.
- [ ] Focus rings visible on Tab through any pane.
- [ ] `pnpm typecheck` clean.
- [ ] `pnpm build` produces all routes statically (`/`, `/assessment`, `/assessment/smoke`).
