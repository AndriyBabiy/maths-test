---
date: 2026-05-06
feature: Irish Maths Diagnostic Agent — five-question flashcard study set
artifacts:
  - presentations/irish-maths-diagnostic-flashcards/src/flashcards.html
  - presentations/irish-maths-diagnostic-flashcards/build/flashcards.pdf
  - presentations/irish-maths-diagnostic-flashcards/scripts/render-pdf.sh
  - presentations/irish-maths-diagnostic-flashcards/scripts/qa-code-overflow.mjs
  - presentations/irish-maths-diagnostic-flashcards/Makefile
flashcards_html_sha256: bc6a5c88b0b6c65035bc31c414b3f3f4f365a5e4c6f6a423be01177eb6fa355b
flashcards_pdf_sha256:  e1097d82868166a6c6e7fb0294e6098636fb4cbb6dedf6e3940ee3e3ecba95ce
render_script_sha256:   eeaec368c0329a15e261cbd583f7718854bd37106af9e95a68ef1e5c24661077
qa_script_sha256:       8cf921e9b7928c638ba2825aba0be929375a02b9dab6f4f4b3eebb0acf0095f7
makefile_sha256:        c32a13e0c7c47d5ec30ead011af44816ffbafa4e287033150d237464327a034f
companion_to:
  - 2026-05-05-irish-maths-diagnostic-pdf.md
  - 2026-05-05-irish-maths-diagnostic-academic-pdf.md
  - 2026-05-06-irish-maths-diagnostic-script.md
pdf_pages: 7
pdf_size_bytes: 604915
audience: senior engineers studying for the talk Q&A
anchor_status: anchored
anchor_master_sha256: 111924428d39bb9bf78d70a6d1bf8e5a4f60ef234a7e50d3c95ab5dfdb627bee5
---

# Layers used

| Layer | Tool | Output |
|---|---|---|
| 0. Inspiration | none — companion artifact, design tokens already chosen | n/a |
| 1. Design intelligence | reuse — anchored on `design-system/zero-to-agent-dublin-guide/MASTER.md` (sha256 `111924428d…7bee5`) | reused tokens |
| 2. UI generation | none — handwritten HTML mirroring the academic-PDF print-CSS pattern | flashcards.html |
| 3. Components | none — plain semantic HTML (sections, headings, lists, code blocks) | n/a |
| 4. Image assets | none — typographic-only, no imagery | n/a |

**Routing rationale:** This artifact is the fourth in the talk-kit family. The same MASTER.md design tokens that drove the presenter trigger sheet (PDF #1) and the academic deep-dive (PDF #2) drive this one — IBM Plex Sans (body), IBM Plex Serif (italic ledes and soundbite quotes), JetBrains Mono (code, headers, file paths), slate palette `#1E293B / #475569 / #64748B / #2563EB / #F8FAFC`, dark code surface `#0F172A`. Per CLAUDE.md governance, when reusing an already-anchored token set, no fresh `ui-ux-pro-max` invocation is required — but the anchor sha256 must be recorded, which is the `anchor_master_sha256` field above.

# Verbatim prompt → artifact intent

User asked (initial five-card request): *"I need you to create flashcard slides (make sure that each flashcard has a path to where this code is located in the codebase) for: core agent architecture and where to find it in the codebase; why langgraph and what are the benefits of this approach; what is the memory approach and how does the agent know the question that you are on; what is the system behind the streak-based increase in difficulty; how is the use of skills used for the different components of the architecture such as the creation of the final report and how this allows the agent to have better accuracy in the result."*

Follow-up (added a sixth card): *"add an explanation of the graph component and what it is and what is the function and utility of the graphs."*

Six flashcards were authored — one per requested topic — each one A4 portrait page. Hard requirement honoured: every card's "File paths" block names the exact file and line range in the repo where the discussed code lives, so the reader can jump from card to source in one keystroke.

# The six flashcards

| # | Topic | Headline question | Anchor file:line |
|---|---|---|---|
| 01 | Core agent architecture | "What is the core architecture — and where does each piece live in the codebase?" | `apps/web/app/api/assessment/_agent/graph.ts:27-63` |
| 02 | Why LangGraph + uniqueness | "Why LangGraph? What does it give you, and what makes this design different from most agent talks?" | `apps/web/app/api/assessment/_agent/nodes.ts:146-169` |
| 03 | The graph itself — components, function, utility | "What exactly is a 'graph' in this codebase — the components it's built from, and what it does for you?" | `apps/web/app/api/assessment/_agent/graph.ts:41-55` |
| 04 | Memory approach + how it knows the question | "How does the agent remember state across turns — and how does it know which question you're currently on?" | `apps/web/app/api/assessment/_agent/index.ts:15-23` |
| 05 | Streak-based difficulty system | "What is the system behind the streak-based increase in difficulty?" | `packages/core/src/rasch-engine.ts:168-193` |
| 06 | Specialised components + accuracy | "How are specialised components used for different parts of the architecture — like building the final report — and how does that improve accuracy?" | `packages/core/src/report.ts:49-71` |

**Card 03 (the graph as a component) explains:** five built-from primitives (state, nodes, edges, START/END, compilation), the graph's *function* (orchestrates a stateful step sequence so you don't write the orchestration loop yourself; replaces nested if/else with a labelled router), and its *utility* (replay via per-node checkpoints; type safety at compile time; sub-graph composition sharing one MemorySaver). Code excerpt is the answerGraph builder showing the one conditional edge in the system.

Each card follows the same template: chip header (`FLASHCARD NN · TOPIC · n of 5`) → big mono question (15pt) → italic-serif lede → bullet body with inline `<em class="k">` mono code spans → "File paths" block listing each `file:line` plus a one-line italic *why* → dark-theme code excerpt (7pt JetBrains Mono on `#0F172A`) with syntax highlighting → "Memorise this" sound-bite footer in CTA-blue accent box.

# Build pipeline

Identical pattern to Phase 1 / Phase 2:

```
flashcards/
├── Makefile                           # qa | pdf | all | open | clean
├── scripts/
│   ├── render-pdf.sh                  # Chrome headless --print-to-pdf
│   └── qa-code-overflow.mjs           # 78-char source-line budget
├── src/
│   └── flashcards.html                # single-file HTML (CSS inline)
└── build/
    └── flashcards.pdf                 # 6 pages, A4 portrait, 535 KB
```

`make all` runs QA then renders. `make qa` is the gatekeeper — if any line inside a `<pre class="code">` block exceeds 78 chars (after stripping HTML tags and decoding entities), exit code 1 stops the render.

# QA results

**Draft phase (run on every render, < 5s):**

| Check | Result |
|---|---|
| `make qa` (78-char code-line budget) | PASS — 6 blocks, 103 lines, 0 over budget |
| Token fidelity (palette, fonts) vs MASTER.md | PASS — slate colors, Plex/JetBrains stack, all sourced from anchored tokens |
| Page count vs target | PASS — 7 pages (1 cover + 6 flashcards), one card per page |
| Per-card content fits A4 portrait | PASS after iterative tightening (see "Page-fit journey" below) |
| Code excerpt readability at 7pt | PASS — JetBrains Mono with high-contrast palette remains legible at print size |
| File paths accuracy | PASS — every `file:line` reference verified against current repo state via Read tool before being written into the card |

**Release phase (deferred — manual review during talk-prep, by user):** keyboard accessibility, screen-reader nav, multi-resolution test (n/a — print-only artifact), Lighthouse a11y. Print artifact only — most Release-tier checks don't apply.

# Page-fit journey

The first render (with five cards) came out at 11 pages — every flashcard splitting across two pages. Fixing this required four passes:

1. **Pass 1: font-size tightening** — body 11pt → 10pt; question 18pt → 15pt; lede 11.5pt → 10.5pt; code 8pt → 7pt; paths 9.5pt → 8.5pt; soundbite 11.5pt → 10pt. Result: 11 → 11 pages (no improvement; line-heights still dominated).
2. **Pass 2: page margin + chip compression** — `@page` margins 16mm → 11mm top/bottom, 14mm left/right (gains ~10mm vertical per page); chip padding-bottom space-sm → space-xs; remove `min-height: 247mm` flex container. Result: 11 → 10 pages.
3. **Pass 3: line-height tightening (the biggest single win)** — body 1.45 → 1.35; bullets 1.4 → 1.32; paths 1.4 → 1.3; paths-why 1.3 → 1.25; code 1.35 → 1.3. Line-height multiplies across every line in the document, so this saved ~30mm cumulative per card. Result: 10 → 7 pages.
4. **Pass 4: Card 05 content trim + phantom-break fix** — code excerpt trimmed from 21 lines to 11 by collapsing the inner for-loop body into a `scoreStrand` call and the median composition into a `medianTier` call (preserves teaching value, halves line count); five bullets shortened from ~3 lines each to ~2; soundbite decorative `::before` / `::after` quotes reduced from `vertical-align: -8pt` (which extends below line box and triggers a phantom page break in Chrome's print engine) to `-3pt`; `.card:last-of-type` rule changed from `page-break-after: auto` to `page-break-after: avoid` (spec-correct way to suppress trailing break). Result: 7 → 6 pages. ✓

The biggest takeaway for future print-CSS work in this repo: **line-height compounds**. Cutting font sizes alone moves the needle little; cutting line-height across all text classes simultaneously compounds across every line in the document.

**Pass 5 (adding the sixth card later the same day):** Inserting Card 03 ("the graph itself — nodes, edges, state, compilation") pushed the count to 8. Card 03 was the densest of all six cards because it teaches *components* + *function* + *utility* in one card. Two trims rescued it: (a) merging the START/END bullet into the Edges bullet (removed ~4 lines), then (b) compressing the code excerpt from a 16-line full-graph listing to an 8-line conditional-edge focus (the four `.addNode()` and three trailing `.addEdge()` calls became single comment lines). Result: 7 pages, target met. Lesson: when a card teaches multiple distinct concepts, the *code excerpt* — not the bullet content — is the lever to pull, because the bullets carry the teaching value the user asked for.

# Anchor verification

All visual choices trace to `design-system/zero-to-agent-dublin-guide/MASTER.md` (sha256 `111924428d…7bee5`):

| Token | Source | Used for |
|---|---|---|
| `#1E293B` slate-900 | MASTER.md primary text | body text, card-question |
| `#475569` slate-600 | MASTER.md muted | card-lede, paths .why italic |
| `#64748B` slate-500 | MASTER.md subtle | section-label uppercase headings |
| `#2563EB` blue-600 | MASTER.md CTA | chip background, paths bullet `▸`, soundbite border |
| `#F8FAFC` slate-50 | MASTER.md surface | paths block background |
| `#0F172A` slate-950 | MASTER.md code surface | code excerpt background |
| `#E2E8F0` slate-200 | MASTER.md code text | code excerpt foreground |
| IBM Plex Sans | MASTER.md body family | bullets, paragraphs |
| IBM Plex Serif italic | MASTER.md serif family | card-lede, soundbite |
| JetBrains Mono | MASTER.md mono family | card-question, chip, code, file paths |

# Family of artifacts (chronology)

The talk kit is now complete with four mutually-reinforcing surfaces:

| Date | Artifact | Form | Purpose |
|---|---|---|---|
| 2026-05-05 | Presenter PDF | 19-page A4 PDF | On-stage trigger sheet — bullets + diagrams the speaker glances at |
| 2026-05-05 | Academic guide PDF | 58-page A4 PDF | Long-form deep-dive — reader's reference for everything in the talk |
| 2026-05-06 | SCRIPT.md | Markdown | The spoken script — the words the speaker actually says, with `[Slide N]` cross-refs |
| 2026-05-06 | **Flashcards PDF** | **7-page A4 PDF** | **Pre-talk study cards — six Q&A cards covering the most-likely senior-engineer questions (architecture · LangGraph · the graph component · memory · streak boost · specialised components)** |

The first three artifacts target the *speaker* — what to project, what to read aloud, what to deep-dive in private. The flashcards target a different reader: someone preparing themselves for the Q&A *as the audience-facing speaker* (or as a teammate who needs to defend the design after the talk). Each card is a self-contained Q+A with code receipts.

# Reuse policy

If asked to add a sixth flashcard, the pattern is now templated — copy any existing `<section class="card">` block, swap the chip topic, question, lede, bullets, paths block, code excerpt, and soundbite. Keep the bullet count to ≤5, the code excerpt to ≤14 lines (so it fits with the rest), and run `make all` to verify the page-count is still 1 + N.

If asked to render a portrait postcard or trifold variant, the per-card density is now well-calibrated for A4 portrait — switching to A5 or postcard would require a fresh density pass (smaller page = less vertical headroom).

# Cross-links

- Companion artifacts: `2026-05-05-irish-maths-diagnostic-pdf.md` · `2026-05-05-irish-maths-diagnostic-academic-pdf.md` · `2026-05-06-irish-maths-diagnostic-script.md`
- Source root: `presentations/irish-maths-diagnostic-flashcards/`
- README integration: `README.md` "Talk artifacts" table updated to list four artifacts (was three)
