---
date: 2026-05-06
feature: Irish Maths Diagnostic Agent — spoken-delivery presentation script
artifacts:
  - presentations/irish-maths-diagnostic-script/SCRIPT.md
  - presentations/irish-maths-diagnostic-script/notes/cue-card.md
  - presentations/irish-maths-diagnostic-script/notes/qa-prep.md
script_sha256: c6b5bbaf393b680412520d9a47544e615670c85d1548f7993729288f0cd399a7
cue_card_sha256: ac161d36b1857cae7d476efe5e84e4e20c6aae199ab3fa1a8da0fee7dba34ed9
qa_prep_sha256: d33a4057cb1d15b8387f455931038be5ae43ac242e94d61765881a018e900f86
companion_to:
  - 2026-05-05-irish-maths-diagnostic-pdf.md
  - 2026-05-05-irish-maths-diagnostic-academic-pdf.md
word_counts:
  script: 2371
  cue_card: 546
  qa_prep: 933
  total: 3850
target_minutes: 20
audience: AI engineers, CTOs, software engineers
---

# Layers used

| Layer | Tool | Output |
|---|---|---|
| 0. Inspiration | none — text deliverable, no visual reference needed | n/a |
| 1. Design intelligence | none — markdown deliverable, no design tokens required | n/a |
| 2. UI generation | none — handwritten markdown | n/a |
| 3. Components | none | n/a |
| 4. Image assets | none | n/a |

**Routing rationale:** This artifact is a spoken-delivery script — a working document edited up to talk-day and read on a confidence monitor / phone, not a printed reference. Markdown is the final form; no styling pipeline applies. The two prior artifacts in this family (`2026-05-05-irish-maths-diagnostic-pdf.md` presenter trigger sheet, `2026-05-05-irish-maths-diagnostic-academic-pdf.md` 58-page academic guide) cover the *visual* / *printed* surface; this completes the family with the *spoken* surface. Per CLAUDE.md UI/UX governance, no anchor required when no styling is produced.

# Verbatim prompt → artifact intent

User asked: "I need you to create the presentation script regarding the project focusing on the development of the agent system and other synergies for an audience of ai engineers, ctos and software engineers."

Three non-negotiable constraints honoured:

1. **Audience pivot from IRT-zero to AI engineers / CTOs / software engineers.** The original presenter PDF (Phase 1) was scoped for an audience that did not know what Item Response Theory was. This audience inverts that profile — they almost certainly know what an agent is, may use LangGraph or its peers in production, and care more about *engineering tradeoffs* than IRT pedagogy. Script de-emphasises Rasch derivation, elevates memory substrates, blast radius, framework comparison, and cost/scaling numbers.
2. **Hybrid delivery format.** Word-for-word for high-stakes moments (opening 60s, key transitions, closing 60s); speaker-notes bullets for body. Industry standard for technical talks — locks the moments that need to land verbatim while keeping body delivery conversational and on-time. Pure-prose scripts read robotic; pure-bullet scripts ramble.
3. **20-minute target with 2-min Q&A buffer.** Word count target ~2500 (20 min × 140 wpm − 3 min for code-pointing, pauses, and Q&A interrupts). Final: 2371 — comfortable lower band; under-running is safer than over-running per the plan's risk table.

# Script structure

Seven sections, each with target word count and minute budget:

| § | Section | Words | Min | Style |
|---|---|---|---|---|
| 1 | Hook + thesis | 150 | 1 | word-for-word |
| 2 | The problem | 250 | 2 | notes |
| 3 | Architecture | 400 | 3 | hybrid |
| 4 | **Memory & state** | 600 | 5 | notes (the meat) |
| 5 | Determinism vs LLM | 450 | 3.5 | hybrid |
| 6 | Production lessons | 350 | 2.5 | notes |
| 7 | Close | 150 | 1 | word-for-word |
| 8 | Q&A appendix | — | — | speaker reference |

Three sentences must land word-for-word:

1. *"Most agent talks tell you to put a language model in charge. Today, I'm going to argue the exact opposite."* (opening)
2. *"Every decision the assessment makes is deterministic. The LLM is decoration, not destiny."* (§3 land sentence)
3. *"Pick your memory substrate first; everything else follows from it."* (§4 land sentence)

Closing take-home: *"If you cannot replay your agent's decisions without the LLM, you have built a black box. If you can — you have built a system."*

# Cross-reference integrity

All `[Slide N]` references in `SCRIPT.md` resolve to actual pages in `presentations/irish-maths-diagnostic-pdf/build/presentation.pdf` (19 pages, A4). Verified via `pdftotext -layout` and `pdfinfo`. Final mapping:

| Slide | PDF page header | Used in script § |
|---|---|---|
| 4 | "What is being measured" (UI screenshot) | §1 close cue + §2 |
| 5 | "One picture: where the math lives" (architecture split) | §3 open |
| 6 | "One checkpointer, three entry points" (three sub-graphs) | §3 |
| 7 | "Annotation.Root with last-write-wins reducers" (typed state) | §4 open |
| 8 | "The LLM is the outermost ring" (blast-radius rings) | §3 land |
| 11 | "The update rule, end to end" (Rasch + code) | §4 close → §5 open |
| 15 | streak boost trajectory (continuation of §14 H2) | §5 |
| 17 | "Four features used. Six skipped" (LangGraph honesty) | §6 open |
| 18 | "One line is the scaling ceiling" (substrates) | §4 |
| 19 | "The questions you're most likely to get" (Q&A) | §6 close → §7 |

Note on PDF-page vs HTML-section drift: the presenter PDF has 19 rendered pages but only 17 numbered HTML sections after the cover. HTML section 11 (Rasch update with code) and section 14 (streak boost + termination with code) each span two PDF pages, accounting for the +2 page delta. The script references PDF pages, not HTML sections.

**Bug caught in QA:** initial draft had `[Slide 5 — three sub-graphs SVG]` in §3 — three sub-graphs is on Slide 6, not 5. The original Phase 3 plan also had this off-by-one (a copy of an earlier inconsistency in the presenter-PDF source plan). Fixed before completion. Cue card's slide-chain string updated correspondingly: `§3 Slide 5 + 8` → `§3 Slide 5 (split) + 6 (sub-graphs) + 8 (blast radius)`. Also corrected the §1→§2 transition cue from "advance — Slide 5" to "advance — Slide 4" so the speaker doesn't visit Slide 5 then back-up to Slide 4 awkwardly.

# Audience adaptation rationale

Inverted from the IRT-zero presenter PDF (Phase 1) on three axes:

| Axis | IRT-zero audience (Phase 1 PDF) | AI-engineer audience (this script) |
|---|---|---|
| Rasch pedagogy | core teaching subject; ~5 min of derivation | worked example; ~3 min, no derivation |
| Memory deep-dive | one slide on substrates | **5 minutes** — the meat of the talk |
| Framework comparison | not addressed | LangGraph vs Vercel AI SDK vs CrewAI vs raw LCEL — when each wins |
| Cost / scaling numbers | implied | quantified ($0.0008/session, <100 lines to scale) |
| Q&A bank | "what is theta?", "what is logit?" | "why not Vercel AI SDK?", "$/session?", "scale to 10k?", "MemorySaver vs Redis?", "how is this not CrewAI?" |
| LangGraph honesty | mentioned | foregrounded — 4 features used, 6+ deliberately skipped |
| Blast radius | one diagram | named principle; the cosmetic / judge / orchestrator spectrum |

# Notes/ subdirectory

Two companion documents, both single-page:

- **`notes/cue-card.md`** (546 words) — last-minute glance card. Section sequence with timing table, three word-for-word sentences, key numbers (0.08¢/session, 8 lines for PostgresSaver, <100 lines to scale, K=0.4, SE 0.3 vs 0.5), three rules of thumb, memory substrate spectrum, slide-chain string, contingency plans (long / junior audience / senior audience / Q&A overrun / demo fail), final-breath checklist.
- **`notes/qa-prep.md`** (933 words) — over-prepared Q&A bank. Five anticipated (Vercel AI SDK swap, $/session cost, scale-to-10k strategy, MemorySaver-vs-Redis-from-day-one, CrewAI multi-agent comparison) plus five stretch (Rasch 1PL vs 2PL/3PL choice, miscalibrated-item handling, hallucination resilience in commentary, TypeScript-vs-Python language choice, free-text-question extension). Each answer 30–60 seconds spoken. Format note for live delivery: restate the question (5s thinking time), land in 30–45s, end with invitation when shaky, honest "I don't know" when truly stuck.

# QA results

## Draft

| Check | Result |
|---|---|
| Word count target (2300 ≤ N ≤ 2700) | PASS — SCRIPT.md = 2371 |
| Section timing sums ≤ 20 min (with 2-min Q&A buffer) | PASS — 1+2+3+5+3.5+2.5+1 = 18 min |
| Audience-fit spot check: no sentence assumes "you have never heard of LangGraph" | PASS |
| All `[Slide N]` references resolve to real PDF pages 1–19 | PASS — 11 distinct refs, all in range |
| Three required word-for-word sentences present and exact | PASS — opening + §3 land + §4 land |
| Cue card slide-chain matches script slide cues | PASS — both updated together |
| Q&A bank tailored for AI-engineer audience (not IRT-zero) | PASS — 5/5 anticipated questions are engineering, not psychometrics |
| All file paths in cross-references exist | PASS — both PDFs verified via `ls` |

## Release (pre-talk verification — manual, by speaker)

| Check | Status |
|---|---|
| Read SCRIPT.md aloud at conversational pace; stopwatch 18–20 min | DEFERRED — speaker action |
| Walk through every `[Slide N]` reference in order with presenter PDF open beside script | DEFERRED — speaker action |
| Cold-reader check: show script to someone who hasn't read either PDF; did they understand the architecture? | DEFERRED — speaker action |
| Q&A dry-run: have a colleague ask the 5 anticipated questions; grade 30–45s answers for completeness | DEFERRED — speaker action |
| Substitute placeholder GitHub URL in footer with real repo URL on talk-day | TODO — speaker action (line 197 of SCRIPT.md) |

# Anchor status

**Not applicable.** Markdown deliverable — no styling, no design tokens. If a printable PDF render of this script is later requested, it would anchor on `design-system/zero-to-agent-dublin-guide/MASTER.md` sha256 `111924428d2d79a4654164672ef51356fe8df3539666bd8fc43395ff7f82bee5` per the precedent set by the Phase 1 / Phase 2 PDFs in this family.

# MCP versions observed

None. Pure markdown authoring; zero MCP tool calls.

# Files

```
presentations/irish-maths-diagnostic-script/
  SCRIPT.md                                  # 2371 words, sha256 c6b5bbaf…cd399a7
  notes/
    cue-card.md                              # 546 words,  sha256 ac161d36…ba34ed9
    qa-prep.md                               # 933 words,  sha256 d33a4057…900f86
ui-history/
  2026-05-06-irish-maths-diagnostic-script.md  # this entry
README.md                                    # +18 lines: "## Talk artifacts" section
                                             #   linking all three artifacts in this family
```

No build pipeline, no scripts/, no Makefile — markdown is the final form.

# README integration

The project README at `/README.md` previously had no pointer to any of the
three talk artifacts. Added a "Talk artifacts" section between
"Session Persistence" and "Local Development" — three rows in a table, one
per artifact (presenter PDF, academic guide, this script), each with a
relative link and a one-line description. Closes the discoverability gap
identified by the SCRIPT.md footer line ("The presenter PDF and the deep-dive
are linked from the README"), which previously pointed nowhere. The README's
structure (architecture → data → talk artifacts → install → deploy → license)
now reads cleanly: project description first, dev instructions after.

# Family of artifacts (chronological)

| Date | Artifact | Form | Purpose |
|---|---|---|---|
| 2026-05-05 | `presentations/irish-maths-diagnostic-pdf/build/presentation.pdf` (19 pp) | Printed | On-stage trigger sheet — bullets, code excerpts, diagrams |
| 2026-05-05 | `presentations/irish-maths-diagnostic-academic-pdf/build/academic-guide.pdf` (58 pp) | Printed | Long-form academic deep-dive — full code listings, exercises, bibliography |
| 2026-05-06 | `presentations/irish-maths-diagnostic-script/SCRIPT.md` (this) | Spoken | The actual words to say on stage; cross-references the trigger PDF for visuals |

The script depends on the presenter PDF for slides; the academic guide is the take-home reading. All three are designed to ship together — repo README references all three.

# Reuse policy

For any future spoken-delivery script in this codebase:

1. Markdown at `presentations/<feature>-script/SCRIPT.md` — single source of truth, edited up to talk-day.
2. Hybrid format — word-for-word for opening, key transitions, closing; speaker-notes bullets for body.
3. `[Slide N]` cross-references map to a separate visual artifact (presenter PDF or deck).
4. `[CUE: <action>]` markers for stage directions (advance, pause, gesture).
5. `notes/cue-card.md` (one page, last-minute glance) and `notes/qa-prep.md` (extended Q&A bank) as companions.
6. No styling pipeline; no anchor required.
7. QA: word count target, section-timing sum check, slide-ref integrity check, audience-fit spot check.

This stack is now the project's reference recipe for any future spoken-delivery script artifact, complementing the printed-PDF recipe established in `2026-05-02-agent-builder-guide.md` and refined in the two `2026-05-05-irish-maths-diagnostic-*` entries.
