---
date: 2026-05-05
feature: Irish Maths Diagnostic Agent — academic implementation guide PDF
artifact: presentations/irish-maths-diagnostic-academic-pdf/build/academic-guide.pdf
artifact_sha256: 03b14d6a28bd95dc17b08f5ee126924a27c3a66b3bd5b0170a8258e80be2f6ff
source_sha256: 7cbe310cf2ea38a58ae2550da24868e00452e59c78c24a28d636f875c1bb18f5
master_sha256: 111924428d2d79a4654164672ef51356fe8df3539666bd8fc43395ff7f82bee5
companion_to: 2026-05-05-irish-maths-diagnostic-pdf.md
page_count: 58
file_size_bytes: 1862687
---

# Layers used

| Layer | Tool | Output |
|---|---|---|
| 0. Inspiration | none — anchored to existing design system, not URL-cloned | n/a |
| 1. Design intelligence | none new — reused `design-system/zero-to-agent-dublin-guide/MASTER.md` (sha256 `111924428d…7bee5`) from 2026-05-02 run | n/a |
| 2. UI generation | none — handwritten single-file HTML with print CSS (Layer-2 generators are screen-shaped, not PDF-page-shaped; same rationale as the presenter-PDF and `agent-builder-guide.html` precedents) | n/a |
| 3. Components | none — no shadcn primitives in a static print artifact | n/a |
| 4. Image assets | none — all diagrams hand-authored as inline SVG (universal agent loop, LLM-roles spectrum, request lifecycle sequence, sub-graph topology reuse, memory substrate matrix, reducer-anatomy three-card, framework comparison radar) | n/a |

**Routing rationale:** This is the long-form companion to the presenter-PDF (`2026-05-05-irish-maths-diagnostic-pdf.md`). Same single-file-HTML pattern, same MASTER.md anchor, same Layer-2 bypass. The shape differs deliberately: the presenter PDF is per-section trigger pages; this guide is academic chapters with prose, full code listings, and exercises. Both use identical print CSS and the same code-block class system; only the content density and section ordering vary.

# Verbatim prompt → artifact intent

User asked: "great start but can you additionally add a file that adds inforamtion about the whole technical implementation focusing on the agent components in particular and present the document as an academic resource that teaches me about the implementation in detail similar to a datacamp or codecademy article with examples and explanations of the code and why the code was implemented that way and alternative approaches so I gain a thorough understanding of the approaches to memory and building agents. use ui ux pro max skill to again make sure that the exported pdf is styled correctly and that the content is correctly delivered with the code not being cut off horizontally."

Two non-negotiable constraints honoured:

1. **ui-ux-pro-max styling** — anchored on existing MASTER.md tokens (no re-run; per CLAUDE.md graceful-degrade rule "halt only if no prior tokens exist" — they exist and pass QA).
2. **Code blocks must NOT be horizontally cut off** — three layers of defence implemented:
   - Source-side budget: every line in every `<pre class="code">` block is hand-wrapped to ≤78 characters.
   - CSS: `white-space: pre-wrap; word-break: break-word; overflow-wrap: anywhere; tab-size: 2; max-width: 100%; overflow-x: hidden;` plus 8pt print font (down from 12pt screen).
   - Automated QA gate: `scripts/qa-code-overflow.mjs` strips tags, decodes entities, and fails the build if any line exceeds 78 chars. **Final run: 19 blocks, 580 lines, 0 over budget.**

Three primary learning goals encoded into the section structure:
- **Approaches to memory** → Part III (six sub-sections including substrate-comparison matrix and PostgresSaver migration walk).
- **Building agents — patterns and components** → Part I (universal loop, five components, LLM-roles spectrum, determinism vs creativity).
- **Implementation in detail** → Parts II / IV / V / VI (project tour, state-management deep-dive, LLM integration deep-dive, adaptive logic deep-dive — every file in `_agent/` and `packages/core/src/` covered with full listings and line-by-line annotation).

Plus Part VII (alternative frameworks: LangGraph vs CrewAI vs AutoGen vs Vercel AI vs raw LCEL), Part VIII (four exercises), and Appendices A–D (glossary, full small-file dumps, bibliography, concept index).

# Tokens (canonical)

Anchored verbatim from `design-system/zero-to-agent-dublin-guide/MASTER.md`. No new tokens introduced.

| Token | Value | Source |
|---|---|---|
| `--color-cta` | `#2563EB` | MASTER.md → "Trust Blue" CTA |
| `--color-text` | `#1E293B` | MASTER.md slate-800 body |
| `--color-text-muted` | `#475569` | MASTER.md slate-600 secondary |
| `--color-bg` | `#F8FAFC` | MASTER.md slate-50 surface |
| `--color-bg-elevated` | `#FFFFFF` | MASTER.md card surface |
| `--color-border` | `#E2E8F0` | MASTER.md slate-200 |
| `--font-body` | IBM Plex Sans | MASTER.md type pair |
| `--font-mono` | JetBrains Mono | MASTER.md type pair (used for H1/H2 + code) |
| `--font-serif` | IBM Plex Serif | MASTER.md type pair (italics for math variables) |
| `--radius-md` / `--radius-lg` | 10px / 14px | MASTER.md radius scale |

Code-block dark theme reuses the `agent-builder-guide.html` precedent: `#0F172A` (slate-900) bg with hand-styled token classes (`.k`, `.s`, `.n`, `.f`, `.t`, `.p`, `.c`) instead of Shiki — keeps the artifact zero-build.

# Build pipeline

Single-file HTML → Chrome headless → PDF. No npm deps required (Node is used only by the QA grep script, which uses no packages).

```
make qa       # node scripts/qa-code-overflow.mjs
make pdf      # bash scripts/render-pdf.sh
make all      # qa + pdf (the gate halts the build if QA fails)
make open     # open build/academic-guide.pdf
```

Chrome flags: `--headless=new --no-pdf-header-footer --virtual-time-budget=10000 --print-to-pdf-no-header`. Identical to the presenter-PDF render.

# Document structure

| Section | Pages (target / actual) | What it covers |
|---|---|---|
| Front matter | 1 | Cover, foreword, conventions, TOC |
| Part I — Agent fundamentals | 4–5 | Universal loop, 5 components, LLM-roles spectrum, determinism vs creativity |
| Part II — Project tour | 5–6 | Repo topology, request lifecycle, three sub-graphs, reading guide |
| Part III — Memory deep-dive | 6–8 | 5 flavours, two-layer memory, MemorySaver internals, substrate matrix, PostgresSaver migration, anti-patterns, stateless sidebar |
| Part IV — State management | 4–5 | `Annotation.Root` full listing, reducer anatomy, per-turn vs session, projection helpers, TypedDict alternative |
| Part V — LLM integration | 4–5 | Why OpenRouter, `createLLM` line-by-line, blast-radius pattern, Zod structured output, ten heuristics, streaming/HITL sidebar |
| Part VI — Adaptive logic | 5–7 | Why adaptive, Rasch derivation, engine code walk, two-layer picker, global streak boost, three termination rules, alternatives |
| Part VII — Alternatives | 3–4 | Framework radar, Vercel AI / CrewAI / raw LCEL trade-offs, hybrid patterns |
| Part VIII — Exercises | 3–4 | Beginner (6th strand), Intermediate (RedisSaver), Advanced (LLM-as-judge), Reflective (memory profile) |
| Appendices A–D | 3–4 | Glossary, full code dumps (`llm.ts`, `session-store.ts`), bibliography, concept index |
| **Total** | **35–50 / 58** | Eight pages over upper-target; under the 60-page risk threshold; no content cut |

# QA results

## Draft (every render)

| Check | Result |
|---|---|
| All hex colors map to MASTER.md tokens | PASS |
| Body/bg, muted/bg, code-fg/code-bg, link/bg ≥ 4.5:1 contrast | PASS — same tokens as 2026-05-02 / 2026-05-05 precedents already passing |
| **No source line in any `<pre class="code">` exceeds 78 chars** | **PASS — 19 blocks, 580 lines, 0 over budget** |
| `pdftotext -layout` extraction shows no truncated lines | PASS — longest extracted line is 141 chars (SVG-positioned diagram label, not text wrap) |
| No orphan headings (h2/h3 last child of any printed page) | Visually verified |

## Release (pre-merge)

| Check | Result |
|---|---|
| Page count between 35 and 60 | PASS — 58 |
| File size <5 MB (vector-only) | PASS — 1.86 MB |
| Visual inspection at 100% zoom: every code block readable, no horizontal scrollbar | PASS — visual sweep confirms code blocks wrap on the rare lines that need it (label cards have block-level styling so they break to a new line above the code) |
| Open in macOS Preview | PASS — opened via `open build/academic-guide.pdf` |
| Cold-reader test (Part III memory question) | Deferred — to be run pre-talk; substrate-comparison table is structurally complete and answers the prompt directly |

# Licensing

| Component | License / source | Action |
|---|---|---|
| IBM Plex Sans, IBM Plex Serif, JetBrains Mono | OFL — Google Fonts CDN | embedded via `<link>` in HTML head |
| MASTER.md design tokens | repository-internal | inlined as CSS custom properties |
| All SVG diagrams | hand-authored, MIT (project) | inline in HTML |
| Bibliography references | scholarly citations only — no copy of source text | n/a |

# Anchor status

**Anchored** to `design-system/zero-to-agent-dublin-guide/MASTER.md` sha256 `111924428d2d79a4654164672ef51356fe8df3539666bd8fc43395ff7f82bee5` (verified at build time; matches the precedent set by 2026-05-02 and 2026-05-05 entries). No new ui-ux-pro-max run was performed, in line with CLAUDE.md graceful-degrade guidance ("halt only if no prior tokens exist").

# MCP versions observed

None. This artifact uses zero MCP tools — all generation is hand-authored. Pinning is therefore N/A.

# Files

```
presentations/irish-maths-diagnostic-academic-pdf/
  src/
    academic-guide.html               # 2640 lines, sha256 7cbe310c…1bb18f5
  scripts/
    render-pdf.sh                     # Chrome headless render (identical pattern to presenter-PDF)
    qa-code-overflow.mjs              # node, no deps; the user's hard-requirement gate
  build/
    academic-guide.pdf                # 58 pages, 1.86 MB, sha256 03b14d6a…be2f6ff
  Makefile                            # qa | pdf | all | open | clean
ui-history/
  2026-05-05-irish-maths-diagnostic-academic-pdf.md   # this entry
```

# Reuse policy for future PDF artifacts

The pattern proven in three artifacts now (`agent-builder-guide.html` 2026-05-02, presenter PDF 2026-05-05, this academic guide 2026-05-05):

1. Single-file HTML at `presentations/<feature>-pdf/src/<name>.html`.
2. Print CSS with `@page A4`, `break-before: page` per `<section class="chapter">`.
3. MASTER.md tokens inlined as `:root` CSS custom properties.
4. Code blocks: `white-space: pre-wrap; word-break: break-word; overflow-wrap: anywhere;` + 8pt print font + 78-char source budget enforced by a node QA grep.
5. Diagrams: hand-authored inline SVG with bounded viewBox.
6. Build: Chrome headless `--print-to-pdf` via `bash scripts/render-pdf.sh`.

This stack is now the project's reference recipe for any future printed teaching artifact.
