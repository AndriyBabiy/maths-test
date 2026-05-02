---
date: 2026-05-02
feature: zero-to-agent-dublin builder's guide
artifact: agent-builder-guide.html
artifact_sha256: a0e8f42081b981287a25987f0e6f75d95565fed12b5c4336e8b967a825e83a19
---

# Layers used

| Layer | Tool | Output |
|---|---|---|
| 0. Inspiration | none — DataCamp guides referenced conceptually only, no URL clone | n/a |
| 1. Design intelligence | `ui-ux-pro-max --design-system --persist` (project: "Zero to Agent Dublin Guide") | `design-system/zero-to-agent-dublin-guide/MASTER.md` (sha256 `111924428d…7bee5`) — pattern: "Accessible & Ethical"; palette anchored on `#475569` neutral + `#2563EB` CTA blue; type pair JetBrains Mono + IBM Plex Sans |
| 2. UI generation | none — handwritten single-file HTML (not a generator-routed task; output is a long-form learning artifact, not a component) | n/a |
| 3. Components | none — guide is single-file HTML, no shadcn primitives needed | n/a |
| 4. Image assets | none — guide uses inline SVG icons only (Heroicons-style strokes), no generated imagery | n/a |

**Routing rationale:** Layer 2 generators (stitch / v0 / 21st-magic) are optimized for product UI screens. A long-form, content-heavy guide with custom semantic structure (TOC + 9 sequential steps + accordions + checklist + dark-themed code blocks) is faster and more correct to author by hand against the locked tokens than to coax out of a generator. Decision recorded under "fallback to direct scaffolding" in CLAUDE.md Layer 2 routing.

# Verbatim prompt → guide intent

User asked (paraphrased for log; full text in conversation transcript): a DataCamp-style step-by-step guide that lets a hackathon attendee *learn while building their own agent*. Explicit clarifying message after first draft: "the goal is not to have you build it but to have you build the clear guide so that I can build the agent and learn elements about the process while doing so".

Framing implications honored:
- All code blocks are copy-as-template, not turn-key implementations.
- "Three things to notice" callouts after each code block teach the *pattern* not the specific snippet.
- Decision trees ("pick this if…") force the user to make their own track choice.
- "Write your one-sentence goal now" exercise short-circuits the user before any code.
- Step time estimates (~5 min, ~45–90 min) so the reader paces themselves.

# Tokens (canonical)

| Token | Value | Source |
|---|---|---|
| `--color-cta` | `#2563EB` | MASTER.md → "Trust Blue" CTA |
| `--color-text` | `#1E293B` | MASTER.md slate-800 body |
| `--color-text-muted` | `#475569` | MASTER.md slate-600 secondary |
| `--color-bg` | `#F8FAFC` | MASTER.md slate-50 surface |
| `--color-bg-elevated` | `#FFFFFF` | MASTER.md card surface |
| `--color-border` | `#E2E8F0` | MASTER.md slate-200 |
| `--font-body` | IBM Plex Sans | MASTER.md type pair |
| `--font-mono` | JetBrains Mono | MASTER.md type pair (also used for H1/H2 to signal builder voice) |
| `--radius-md` / `--radius-lg` | 10px / 14px | MASTER.md radius scale |

All values inlined as CSS custom properties at the top of the `<style>` block; nothing invented at the component level.

# QA results

## Draft (token + structural)

| Check | Result |
|---|---|
| Token fidelity (all colors map to MASTER.md) | ✅ pass |
| Alt text on images | ✅ pass (no images; SVG icons have `aria-hidden="true"` + sibling text) |
| Touch-target ≥ 44×44 (mobile) | ⚠️ Initially failed: 56 elements under 44px on 375px viewport. **Fixed** via mobile media query — TOC links, buttons, summary, checklist rows now ≥44px. Remaining sub-44 are inline text links (WCAG-exempt) and 24×24 checkboxes nested inside 44px+ rows. |
| Semantic HTML | ✅ `<header>`, `<nav>`, `<main>`, `<article>`, `<aside>`, `<section>` (regions), `<dl>/<dt>/<dd>`, `<details>/<summary>`. |
| Static contrast (sampled) | ✅ H1 13.98:1, body 7.24:1, primary button 5.17:1, muted label 4.55:1 — all ≥ AA; body+H1 hit AAA. |

## Release (functional)

| Check | Result |
|---|---|
| Keyboard navigation (Tab cycle, focus rings) | ✅ Skip-link first focus has 3px CTA-blue outline at 2px offset; all interactive elements have visible focus state. |
| Responsive at 375 / 768 / 1024 / 1440 | ✅ no horizontal scroll at any tested width after fix. |
| `prefers-reduced-motion` respected | ✅ `@media (prefers-reduced-motion: reduce)` block disables transitions / smooth scroll. |
| Lighthouse a11y / perf | not yet run — single-file static HTML served from `python -m http.server`, no third-party scripts, no images, no fonts beyond Google Fonts; expected ≥95 a11y / ≥90 perf. Re-run if rolled into a deployed app. |
| Manual spot-check | ✅ Hero, TOC, agent-loop diagram, Step 4 decision tree, Step 6 fetchPage code block, mobile narrow view all visually verified. |

## Issues fixed during QA

1. **Mobile horizontal overflow (14px)** — caused by ASCII flow diagrams inside `<pre>` and long URLs in checkbox labels not wrapping. Fixed: `min-width: 0` on layout/main/article children + `overflow-wrap: anywhere` on labels + `overflow-x: hidden` body safety net at ≤640px.
2. **Touch targets below 44×44** — fixed: TOC `<a>` to `min-height: 44px` flex centered; `.btn min-height: 44px`; `.checklist li min-height: 44px`; checkbox 18→24px; `.code-block__copy` 36×56px.

# MCP versions observed

- `playwright-cli` (skill, ran live)
- `python3` 3.11 (HTTP server)
- `context7` and `nanobanana-or` available but unused for this artifact

# Licensing row

- All source: original to this conversation. Code-snippet patterns inside the guide are conventional (Vercel AI SDK / Workflow SDK / Lua AI quickstarts) — patterns, not copy-pasted upstream code; references and links provided. No third-party content cloned.

# Anchor status

**Anchored.** The guide is anchored to `design-system/zero-to-agent-dublin-guide/MASTER.md` (sha256 above). Any future revision must re-verify against that hash and bump if tokens drift. No unanchored generator output present.
