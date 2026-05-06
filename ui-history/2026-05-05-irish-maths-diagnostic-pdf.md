---
date: 2026-05-05
feature: Irish Maths Diagnostic Agent — presenter PDF reference
artifact: presentations/irish-maths-diagnostic-pdf/build/presentation.pdf
artifact_sha256: af26c33e05855056c84bacd2e9668a6bee864a154ee1f4f4c7f8b445fad22764
source_sha256: 592b7a8482188bc2ef9c6cdfbaed57208bb93bed67c940f410f0a63dd57f7249
---

# Layers used

| Layer | Tool | Output |
|---|---|---|
| 0. Inspiration | none — anchored to existing design system, not URL-cloned | n/a |
| 1. Design intelligence | none new — reused `design-system/zero-to-agent-dublin-guide/MASTER.md` (sha256 `111924428d…7bee5`) from 2026-05-02 run | n/a |
| 2. UI generation | none — handwritten single-file HTML with print CSS (Layer-2 generators are screen-shaped, not PDF-page-shaped; same rationale as 2026-05-02 entry) | n/a |
| 3. Components | none — no shadcn primitives in a static print artifact | n/a |
| 4. Image assets | none — all diagrams hand-authored as inline SVG (b-distribution sparkline, sigmoid curve, three sub-graph topology, blast-radius rings, picker matrix tables, trajectory line chart, single-vs-multi-node deployment); no nanobanana invocation | n/a |

**Routing rationale:** A presenter-only PDF reference is structurally identical to the long-form learning artifact precedent at `agent-builder-guide.html` (2026-05-02). Same single-file-HTML pattern, same MASTER.md anchor, same Layer-2 bypass. The only difference is target medium: print (`@media print`, `@page A4 portrait`, `break-before: page` per section) instead of screen.

# Verbatim prompt → artifact intent

User asked: "I need to do a presentation on how this tool was built. I need you to create a pdf resource that is formatted using UI UX pro max skill in order to teach me all of the elements I need to know to be able to present this project thoroughly. The main goal is to learn the core elements of building agents and then in particular what are the unique components of the build that influenced the use of langgraph and how that influences future development. I also need you to explain all of the unique elements of how the agent interacts with the questions and how it progresses on choosing the questions to assess the user."

Three clarifying questions resolved by the user:
1. **Anchor on existing design system** (Recommended) — vs new tokens.
2. **20 min talk for IRT-zero audience** (Recommended) — vs 45-min deep technical.
3. **Presenter-only notes** (NOT the recommended option) — material design pivot from `Distribute to attendees`. Implications honored:
   - Cheat sheet placed at page 2 (not last) for instant lookup.
   - Bullet-heavy "trigger line" style instead of essay prose.
   - "Anticipated Q&A" section appended (page 19) as post-talk fallback.
   - Code excerpts function as on-stage pointers, not as standalone explanations.

Three learning goals encoded into the section structure:
- **Core elements of building agents** → sections 5–8 (architecture, sub-graphs, typed state, cosmetic LLM blast radius).
- **Why LangGraph here** → section 14 (4 features used / 6+ skipped table) + section 15 (production scaling implications).
- **How questions are picked & progressed** → sections 9–13 (item bank, Rasch intuition, Rasch formula + worked example, two-layer picker + worked matrix, streak boost + termination rules).

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

Single-file HTML → Chrome headless → PDF. No npm deps required.

```
make pdf  # bash scripts/render-pdf.sh:
          #   /Applications/Google Chrome.app/Contents/MacOS/Google Chrome \
          #     --headless=new --disable-gpu --no-pdf-header-footer \
          #     --virtual-time-budget=10000 \
          #     --print-to-pdf=build/presentation.pdf \
          #     file://src/presentation.html
```

Decision: skipped the planned KaTeX/Shiki/Mermaid-CLI/Playwright dep stack (from `~/.claude/plans/i-need-to-do-stateless-pelican.md`). The single Rasch formula renders fine in Unicode + IBM Plex Serif italic; code blocks are hand-styled with classed spans; diagrams are inline SVG. Total deps: 0. Match-the-precedent simplicity wins over build-system flexibility for a static artifact.

# Section structure (19 pages rendered)

| Page | Section | Role |
|---|---|---|
| 1 | Cover + Thesis | "Deterministic core / LangGraph shell / Cosmetic LLM" tile + stack line |
| 2 | Presenter Cheat Sheet | 12 numbered bullets — "if I forget everything else" page |
| 3 | Section Map | "Flip to page X for…" two-column index |
| 4 | Problem & UI | 6 strands × 3 stages; KaTeX MCQ frame; ACTIVE_STRANDS code |
| 5 | Architecture | Package boundary diagram + deterministic/cosmetic mapping |
| 6 | Three sub-graphs | Inline SVG of 3 DAGs sharing one MemorySaver |
| 7 | Typed state | Annotation.Root code + last-write-wins reducer table |
| 8 | Cosmetic LLM | Blast-radius rings + try/catch on `narrateNode` |
| 9 | Item bank | Schema + jc-nu-001 literal + b-distribution sparkline |
| 10 | Rasch — intuition | Sigmoid curve + Elo analogy + three-regime table |
| 11–12 | Rasch — formula + worked example | θ_new = θ_old + K·(observed − σ(θ−b)) with arithmetic table |
| 13–14 | Two-layer picker | pickStrand code + worked matrix (strand selection, item selection) |
| 15–16 | Streak boost + termination | streakBoost code + trajectory chart + 3 rules code + bullet explanations |
| 17 | LangGraph honesty | 4 used / 6+ skipped two-column grid |
| 18 | Production realities | MemorySaver scaling ceiling + PostgresSaver swap sketch |
| 19 | Anticipated Q&A | 12 questions in `<dt>/<dd>` format |

Plan target was 16–18 pages; landed at 19. The plan's listed risk fallback ("Compress Section 11 from 1.5 → 1 page; or fold Section 4 into Section 5") was not invoked — the audience-justified extra page on the worked-example sections (11, 12, 13 each spilled to 1.5 pages) is content-load, not bloat. Acceptable for a presenter ref where lookup speed beats page count.

# QA results

## Draft (token + structural)

| Check | Result |
|---|---|
| Token fidelity (all colors map to MASTER.md) | ✅ pass — no hex outside the MASTER.md palette except dark code-block bg `#0F172A` (slate-900, family-coherent extension) |
| Alt text on diagrams | ✅ all SVGs have `role="img"` + `aria-label` describing what they communicate |
| Static contrast (sampled) | ✅ Body 7.24:1, H1 13.98:1, muted 4.55:1, code-fg `#E2E8F0` on `#0F172A` 14.4:1 — all ≥ AA; body+H1 AAA |
| Page count | ⚠️ 19 (target 16–18) — accepted, see section structure note |
| Orphan trigger lines | ⚠️ Two found and fixed: section 9 trigger inlined into caption; section 11 trigger converted to caption-style paragraph |
| Code block height (no `<pre>` taller than one A4 page) | ✅ pass |
| File size (<2MB target) | ✅ 1.4 MB |

## Release (functional)

| Check | Result |
|---|---|
| All 12 anticipated-Q&A keywords selectable | ✅ verified via `pdftotext` — `switch_strand`, `±1.8`, `MemorySaver`, `PostgresSaver`, `K = 0.4`, `sigmoid`, `Annotation.Root`, `StateGraph`, `narrateNode`, `Rasch`, `streakBoost`, `finalise` all present (88 hits across 12 keywords) |
| Page boundaries clean | ✅ each `<section class="page">` starts on its own page; no h2 orphaned at page-end (Chrome's `break-before: page` enforced) |
| KaTeX-free math rendering | ✅ Unicode + IBM Plex Serif italic + `.math` class — `θ`, `σ`, `√`, `±`, subscripts all render correctly without external font load |
| Code blocks render with syntax highlights | ✅ hand-styled `.k`/`.s`/`.n`/`.f`/`.t`/`.p`/`.c` spans visible in PDF (color-printable; print CSS does not strip backgrounds via `printBackground=true` equivalent flag) |
| Diagrams render at intended size | ✅ all 7 inline SVGs render vector-crisp; b-distribution and trajectory charts had `style="max-height"` constraints added during QA to prevent page overflow |

## Issues fixed during QA

1. **Page 10 orphan** — section 9's trigger-line callout overflowed alone onto page 10. Fixed by merging the trigger sentence into the diagram caption (single line under the b-distribution sparkline). Page 10 now correctly hosts section 10 (Rasch intuition).
2. **Page 12 orphan** — section 11's trigger line overflowed alone after the Rasch update code block. Fixed by converting the trigger callout to a `<p class="caption">` directly under the code block; page 12 now hosts the worked-example arithmetic table.
3. **Page 16 ragged content** — section 13's three termination-rule bullets split across page 15/16 with the recommend code block. Fixed via `style="break-inside: avoid"` wrapper around the h3 + code + bullets so the whole "Three termination rules" subsection moves together to page 16.
4. **Trajectory + b-distribution SVG heights** — both diagrams ran tall enough to push subsequent content. Constrained via inline `max-height: 108px` (b-distribution) and `max-height: 130px` (trajectory) to claw back vertical space.

# MCP versions observed

- Chrome (system) — `Google Chrome.app` headless, `--headless=new` mode (works around the deprecated headless=true allocator warning)
- `pdftotext` (poppler) `/opt/homebrew/bin/pdftotext` — used for content-presence verification
- `mdls` (macOS Spotlight) — used for `kMDItemNumberOfPages` page-count check
- `shasum -a 256` — artifact + anchor pinning
- `context7` and `nanobanana-or` available but unused for this artifact (same as 2026-05-02)

# Licensing row

- All source: original to this conversation. Code excerpts in the PDF are quoted verbatim with file:line citation from the project's own source (`packages/core/src/rasch-engine.ts`, `apps/web/app/api/assessment/_agent/{graph,state,nodes,llm}.ts`, `packages/core/src/items.ts`).
- Diagrams: hand-authored SVG, original.
- Fonts: IBM Plex Sans / Mono / Serif, JetBrains Mono — Open Font License, served via Google Fonts (loaded at print time).

# Anchor status

**Anchored.** The PDF is anchored to `design-system/zero-to-agent-dublin-guide/MASTER.md` (sha256 `111924428d2d79a4654164672ef51356fe8df3539666bd8fc43395ff7f82bee5`). Any future revision must re-verify against that hash and bump if tokens drift. No unanchored generator output present.

Source HTML sha256: `592b7a8482188bc2ef9c6cdfbaed57208bb93bed67c940f410f0a63dd57f7249`
PDF sha256: `af26c33e05855056c84bacd2e9668a6bee864a154ee1f4f4c7f8b445fad22764`

# Presenter handoff notes

Tell the user before the talk:
- Flip to **page 2 (Cheat Sheet)** for the 12-bullet whole-talk summary.
- Flip to **page 16 (Q&A)** when audience questions start.
- The **3-tile thesis on page 1** ("Deterministic core / LangGraph shell / Cosmetic LLM") is the talk in 30 seconds — open with it.
- Pages 11 + 13 (worked-example arithmetic tables) are the only pages where pointing at the page during the talk adds real value; the rest are trigger lines.
