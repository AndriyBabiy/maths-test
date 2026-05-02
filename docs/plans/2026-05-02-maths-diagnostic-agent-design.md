# Irish Maths Diagnostic Agent — Design

**Date:** 2026-05-02 (Zero to Agent Dublin hackathon)
**Author:** Andriy Babiy
**Status:** Design validated — ready to implement

## Goal

Build an LLM-orchestrated, Rasch-numeric adaptive testing agent that:
1. Detects which stage of the Irish Project Maths curriculum a learner sits at (Primary / Junior Cycle / Leaving Cert).
2. Estimates per-strand ability and assigns a tier (Foundation / Ordinary / Higher).
3. Returns an outcome-tagged report mapped to NCCA learning outcomes.

Hosted as: **Lua AI agent** (logic) + **v0/Next.js app** (UI), integrated via Lua's REST API.

## Decisions made during brainstorming

| Decision | Choice | Why |
|---|---|---|
| Curriculum scope | All stages, shallow depth ("approach D + breadth A") | Cross-stage routing is the wow factor; 30 anchor items per stage is achievable. |
| Question source | Hybrid — hand-picked KA-style anchors + LLM-generated variations | Real KA scraping is fragile/ToS-risky; pure synthetic is uncredible; hybrid balances both. |
| Delivery surface | v0 custom UI + Lua agent (Track 1 + Track 2 mix) | Chat widget is awkward for testing UX; custom UI lets us render KaTeX, progress bar, radar chart. |
| Adaptivity | Rasch 1PL (math) + LLM (meta-decisions) | Defensible psychometrics; LLM does what it's good at (which strand, when to stop) without doing arithmetic. |
| Demo scope | Stage-detect → adaptive within stage | Shows cross-stage routing; ~30 items per stage is shippable. |

## Architecture — 4 layers

```
┌─────────────────────────────────────────────────────┐
│  LAYER 1 — UI (v0 / Next.js, Vercel-deployed)       │
│  Test screen · KaTeX · A/B/C/D · progress · results │
└─────────────────────────────────────────────────────┘
                       ↕ HTTP
┌─────────────────────────────────────────────────────┐
│  LAYER 2 — Agent (Lua AI, TypeScript)               │
│  LuaAgent + LuaSkill bundling 6 LuaTools            │
│  Decides WHICH strand + WHEN to stop. No math.      │
└─────────────────────────────────────────────────────┘
                       ↕ pure TS
┌─────────────────────────────────────────────────────┐
│  LAYER 3 — Psychometric core (zero LLM)             │
│  RaschEngine · SessionStore · StageRouter           │
│  Deterministic, unit-testable                       │
└─────────────────────────────────────────────────────┘
                       ↕ JSON
┌─────────────────────────────────────────────────────┐
│  LAYER 4 — Question bank                            │
│  items.json (anchors) + generateItem fallback       │
└─────────────────────────────────────────────────────┘
```

**Critical separation: LLM (Layer 2) never does arithmetic. Math (Layer 3) never does reasoning.** The tool contract is the seam.

## Data model

```ts
type Stage   = 'primary' | 'junior_cycle' | 'leaving_cert';
type Strand  =
  | 'number' | 'algebra' | 'geometry_trig'
  | 'functions' | 'statistics_prob' | 'measures_data';
type Tier    = 'foundation' | 'ordinary' | 'higher';

interface Item {
  id: string;
  stage: Stage;
  strand: Strand;
  learningOutcome: string;     // e.g. "JC.AL.U.4: Solve linear equations"
  b: number;                   // Rasch difficulty, hand-calibrated -2..+2
  text: string;                // markdown w/ $latex$
  choices: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  source: 'anchor' | 'generated';
  khanAcademyRef?: string;
}

interface SessionState {
  sessionId: string;
  stageEstimate: Stage | null;
  theta: Record<Strand, number>;   // ability per strand, init 0
  se:    Record<Strand, number>;   // standard error, init 1
  history: Array<{itemId: string; correct: boolean; latencyMs: number}>;
  itemsAsked: Set<string>;
  finalised: boolean;
}

interface AssessmentReport {
  stage: Stage;
  overallTier: Tier;
  strands: Record<Strand, { theta: number; tier: Tier; confidence: number }>;
  strengths: string[];   // learning-outcome codes with theta > +1
  gaps: string[];        // learning-outcome codes with theta < -0.5
  nextSteps: string;     // LLM-written natural-language summary
}
```

**Difficulty calibration:** hand-assigned `b ∈ {-2, -1, 0, 1, 2}` per item.
- `-2` recall (5 × 7)
- `-1` direct application (solve 2x + 3 = 11)
- `0` standard procedure (factor x² − 5x + 6)
- `+1` multi-step (find roots, then sketch parabola)
- `+2` abstraction / proof (prove ∃ no real root for x² + x + 1)

5 buckets is enough for adaptive routing. We don't need 0.01 resolution to pick reasonable next items.

## Agent tools (the Layer 2 ↔ Layer 3 contract)

| Tool | Purpose | When called |
|---|---|---|
| `get_session_state` | Return θ, SE, history | Every turn, first |
| `detect_stage` | Score a stage-router probe | First 1–2 turns only |
| `pick_next_item` | Math layer chooses item with b ≈ θ_strand | After every answer |
| `score_answer` | Rasch update; returns recommendation | After every answer |
| `finalise_assessment` | Produce final report | When SE < 0.4 on ≥4 strands OR 15 items |
| `generate_item` | LLM fallback when bank is sparse | Sparingly |

**Asymmetry:** `score_answer` returns `recommendation: 'continue' | 'switch_strand' | 'finalise'`. The agent can override — the math layer suggests defaults, the LLM applies judgement (e.g. learner seems confused → probe easier item even if SE says move on).

## State machine

```
Warmup (1 turn)
  ↓
Stage detection (1-2 items)
  Q1 b=-1 Number  ✗ → primary
  Q1 ✓ → Q2 b=+1 Algebra  ✓ → leaving_cert · ✗ → junior_cycle
  ↓
Adaptive loop (≤ 12 items)
  while !finalised && itemsAsked < 15:
    state = get_session_state()
    strand = LLM picks (rule: highest SE, or balance coverage)
    item = pick_next_item(stage, strand)        // b ≈ θ_strand ± 0.5
    answer = await UI
    update = score_answer(item, answer)         // Rasch 1PL
    if update.recommendation == 'finalise': break
  ↓
Finalisation
  finalise_assessment() → AssessmentReport
  UI renders radar + outcome-tagged commentary
```

**Stop conditions** (whichever first):
- All 5 strands have `SE < 0.4`
- 15 items asked (`stopWhen: stepCountIs(15)` — mirrors AI SDK guard from the guide)
- Learner quits

## System prompt

```
ROLE
You are an Irish maths diagnostic agent. You assess where a learner sits
in the Project Maths curriculum (Primary, Junior Cycle, or Leaving Cert),
and at what tier (Foundation/Ordinary/Higher).

GOAL
Determine the learner's stage and per-strand ability with the FEWEST
questions possible — ideally 8-12, never more than 15. Produce a final
report mapped to NCCA learning outcomes.

BEHAVIOUR
- Call get_session_state at the start of every turn.
- Pick the strand with highest SE (least known) unless coverage demands
  otherwise.
- Be encouraging. Never reveal correct answers mid-test.
- Use plain English; render maths inline (e.g. "x squared plus 3x").

CONSTRAINTS
- Never do arithmetic yourself — always use score_answer.
- Never reveal theta or SE to the learner.
- Never ask the same item twice (deduplicate via itemsAsked).
- Never claim a tier without SE < 0.4 for that strand.
```

## Implementation plan (3h 40m + 30m buffer)

| # | Block | Time | Track | Output |
|---|---|---|---|---|
| 0 | Setup | 15 m | Both | `lua auth`, `lua init`, `pnpm create next-app`. Credits claimed. |
| 1 | Question bank | 45 m | L4 | 30 anchor items committed to `items.json`. Batch-prompt Claude to draft, hand spot-check correctIndex. |
| 2 | Rasch engine | 30 m | L3 | `RaschEngine.ts` with `update`, `pickItem`, `tierFromTheta`. 3 unit tests. |
| 3 | Lua tools | 45 m | L2 | 6 `LuaTool` classes. Validated via `lua test`. |
| 4 | Lua agent | 15 m | L2 | `LuaAgent` with system prompt. Smoke-tested via `lua chat`. |
| 5 | v0 UI | 45 m | L1 | Test screen + radar results. One v0 prompt. |
| 6 | API glue | 20 m | L1↔L2 | `/api/assessment/route.ts` proxies to Lua REST API. |
| 7 | Polish + deploy | 15 m | Both | `lua deploy` + `vercel deploy`. Single shareable URL. |
| — | Buffer | 30 m | — | Demo prep, recording, fallback. |

**Build-order rationale:** L3+L4 are deterministic — build first to validate math before tangling with model behaviour. L2 testable via `lua chat` alone. L1 last (most forgiving deadline; chat fallback works).

## Cut list (if behind)

1. Drop primary stage (architecture stays; items.json just lacks them).
2. Drop `generate_item` (pure-anchor flow).
3. Drop radar chart → list of `strand: tier` pairs.
4. Drop v0 UI → demo with `lua chat` in terminal.

## Defensibility notes

What makes this defensible as an "intelligent assessment system" rather than a chatbot quiz:

1. **Outcome-tagged classification.** Every answer affects θ for a specific NCCA learning outcome. Final report says "weak on JC.GT.O.3", not just "you got 6/10".
2. **Standard error gating.** No tier is reported until `SE < 0.4`. The agent knows when it doesn't know.
3. **Trajectory transparency.** The θ vector is computable at every turn — you can show how confidence shifted, item by item.
4. **Math/LLM separation.** Classification is deterministic (Rasch + tier mapping). The LLM only orchestrates flow; you can replay any session and get the same final tier.
