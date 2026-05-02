# Lua agent cleanup — 2026-05-02

End-to-end production verified after fixing two sandbox blockers (items inlined as TS module, `chosenIndex` schema switched to integer-range). This doc records the overengineering audit and the cleanup applied.

## Audit findings

| Severity | Item | Location | Decision |
|---|---|---|---|
| 🔴 cut | `GenerateItem` is a stubbed LLM fallback returning placeholder text + `correctIndex: 0`. Bank (30 items × 5 difficulties × 6 strands) covers an 8–15 question assessment, so the fallback is never reached. Tool slot wasted in Gemini schema. | `src/tools/GenerateItem.ts` (73 LOC) | DELETE |
| 🔴 cut | `runtime.ts` ceremony for generated-items support: `getAllItems` (dead), `appendGeneratedItem`, `generatedItemCount`, `getAllItemsForSession`. Only used by `GenerateItem`. | `src/runtime.ts:38-76` | DELETE the generated-item plumbing once `GenerateItem` is gone |
| 🔴 cut | `void TIER_BY_ORDER` to suppress unused-locals warning, plus the unused `TIER_BY_ORDER` constant. | `src/tools/FinaliseAssessment.ts:33,134-136` | DELETE |
| 🟡 keep | `index.ts` persona constraint "Always call get_session_state at the start of every turn" wastes round-trips, but keeps agent state-reset deterministic for demo. | `src/index.ts:18` | KEEP for demo, revisit post-hackathon |
| 🟢 keep | Rasch logic in `@maths-diag/core` (not in tools) — architectural backbone | core package | KEEP |
| 🟢 keep | `<lua-out>{...}</lua-out>` JSON envelope — only way to extract structured data from text response | route + persona | KEEP |
| 🟢 keep | `items.ts` 409-line inlined item bank — required by Lua's `vm.Script(eval)` sandbox (no fs / `import.meta.url`) | `src/items.ts` | KEEP |
| 🟢 keep | 6 small tools instead of 1 mega-tool — Gemini routes well to single-purpose tools, persona constraints match tool boundaries | `src/tools/*` | KEEP |

## Net effect of cleanup
- ~150 LOC removed
- One fewer Gemini function declaration → smaller cold-start surface
- Zero behavioural change for the demo path (8–15 questions on a 30-item bank)
- `pick_next_item` simplified — drops the `no_anchor_within_tolerance` branch since there's no fallback to recommend

## Order of operations
1. Delete `src/tools/GenerateItem.ts`
2. Remove `GenerateItem` from `src/skill.ts` (import + array entry)
3. Trim `src/runtime.ts`: delete `generatedItems`, `appendGeneratedItem`, `generatedItemCount`, `getAllItemsForSession`, `getAllItems`. Simplify `getItemById` to a single-pass over `ALL_ITEMS`.
4. Update `src/tools/PickNextItem.ts`: import `getItemById`-adjacent helper renamed; replace `getAllItemsForSession(sessionId)` with `ALL_ITEMS` (or rename helper). Drop the `hint` return path.
5. Trim `src/tools/FinaliseAssessment.ts`: delete `TIER_BY_ORDER` constant and the `void` reference.
6. Update persona in `src/index.ts` if it mentions `generate_item` (it doesn't currently — verify).
7. `pnpm typecheck` → `lua compile` → `lua test skill --name pick_next_item` smoke → `lua chat -e sandbox` smoke → `lua push all --force --auto-deploy`.
