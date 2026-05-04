import { describe, expect, it } from 'vitest';
import { RaschEngine, K_FACTOR } from '../src/rasch-engine';
import { ITEMS } from '../src/items';
import type { Item, SessionState, Strand } from '../src/types';

const STRANDS: Strand[] = [
  'number',
  'algebra',
  'geometry_trig',
  'functions',
  'statistics_prob',
  'measures_data',
];

function freshState(overrides: Partial<SessionState> = {}): SessionState {
  const theta = {} as Record<Strand, number>;
  const se = {} as Record<Strand, number>;
  for (const s of STRANDS) {
    theta[s] = 0;
    se[s] = 1.0;
  }
  return {
    sessionId: 'test',
    stageEstimate: null,
    theta,
    se,
    history: [],
    itemsAsked: new Set<string>(),
    finalised: false,
    ...overrides,
  };
}

function makeItem(partial: Partial<Item> & { id: string; b: number; strand: Strand }): Item {
  return {
    id: partial.id,
    stage: partial.stage ?? 'junior_cycle',
    strand: partial.strand,
    learningOutcome: partial.learningOutcome ?? 'TEST.LO',
    b: partial.b,
    text: partial.text ?? 'q?',
    choices: partial.choices ?? ['a', 'b', 'c', 'd'],
    correctIndex: partial.correctIndex ?? 0,
    source: partial.source ?? 'anchor',
  };
}

describe('RaschEngine.update', () => {
  it('increases theta after a correct answer at theta=0, b=0', () => {
    const engine = new RaschEngine();
    const state = freshState();
    const item = makeItem({ id: 'i1', strand: 'algebra', b: 0 });

    const next = engine.update(state, item, true);
    expect(next.theta.algebra).toBeGreaterThan(0);
    // expected = sigmoid(0) = 0.5; delta = K * (1 - 0.5) = 0.2
    expect(next.theta.algebra).toBeCloseTo(K_FACTOR * 0.5, 6);
  });

  it('decreases theta after a wrong answer at theta=0, b=0', () => {
    const engine = new RaschEngine();
    const state = freshState();
    const item = makeItem({ id: 'i1', strand: 'algebra', b: 0 });

    const next = engine.update(state, item, false);
    expect(next.theta.algebra).toBeLessThan(0);
    expect(next.theta.algebra).toBeCloseTo(-K_FACTOR * 0.5, 6);
  });

  it('only affects the answered strand', () => {
    const engine = new RaschEngine();
    const state = freshState();
    const item = makeItem({ id: 'i1', strand: 'algebra', b: 0 });

    const next = engine.update(state, item, true);
    for (const s of STRANDS) {
      if (s === 'algebra') continue;
      expect(next.theta[s]).toBe(0);
      expect(next.se[s]).toBe(1.0);
    }
  });

  it('does not mutate the input state', () => {
    const engine = new RaschEngine();
    const state = freshState();
    const item = makeItem({ id: 'i1', strand: 'algebra', b: 0 });

    const before = state.theta.algebra;
    engine.update(state, item, true);
    expect(state.theta.algebra).toBe(before);
    expect(state.itemsAsked.size).toBe(0);
    expect(state.history.length).toBe(0);
  });

  it('appends to history and itemsAsked', () => {
    const engine = new RaschEngine();
    const state = freshState();
    const item = makeItem({ id: 'i1', strand: 'algebra', b: 0 });

    const next = engine.update(state, item, true, 1234);
    expect(next.history).toHaveLength(1);
    expect(next.history[0]).toEqual({ itemId: 'i1', correct: true, latencyMs: 1234 });
    expect(next.itemsAsked.has('i1')).toBe(true);
  });

  it('shrinks SE monotonically and floors at 0.25', () => {
    const engine = new RaschEngine();
    let state = freshState();
    const seValues: number[] = [state.se.algebra];
    for (let i = 0; i < 20; i++) {
      const item = makeItem({ id: `i${i}`, strand: 'algebra', b: 0 });
      state = engine.update(state, item, i % 2 === 0);
      seValues.push(state.se.algebra);
    }
    // Monotonic non-increasing
    for (let i = 1; i < seValues.length; i++) {
      expect(seValues[i]!).toBeLessThanOrEqual(seValues[i - 1]!);
    }
    // Floor
    expect(state.se.algebra).toBeGreaterThanOrEqual(0.25);
    // After 20 updates we should be at the floor
    expect(state.se.algebra).toBeCloseTo(0.25, 6);
  });
});

describe('RaschEngine.pickItem', () => {
  it('returns the item with closest difficulty', () => {
    const engine = new RaschEngine();
    const state = freshState({ theta: { ...freshState().theta, algebra: 1.2 } });
    const items: Item[] = [-2, 0, 1, 2].map((b, i) =>
      makeItem({ id: `i${i}`, strand: 'algebra', b }),
    );
    const picked = engine.pickItem(items, state, 'algebra');
    expect(picked).not.toBeNull();
    expect(picked!.b).toBe(1);
  });

  it('returns closest item even outside the legacy ±0.5 tolerance', () => {
    const engine = new RaschEngine();
    // theta=2.0; candidates at b=0 and b=-3 — the closest (b=0) is still
    // 1.0 away from theta, well outside the legacy ±0.5 window.
    const state = freshState({ theta: { ...freshState().theta, algebra: 2.0 } });
    const items: Item[] = [
      makeItem({ id: 'far-low', strand: 'algebra', b: -3 }),
      makeItem({ id: 'closest', strand: 'algebra', b: 0 }),
    ];
    const picked = engine.pickItem(items, state, 'algebra');
    expect(picked).not.toBeNull();
    expect(picked!.id).toBe('closest');
    expect(Math.abs(picked!.b - state.theta.algebra)).toBeGreaterThan(0.5);
  });

  it('returns null only when no in-strand candidate exists at all', () => {
    const engine = new RaschEngine();
    // All candidates are either in another strand or already asked, so no
    // in-strand+stage+unasked candidate exists for 'algebra'.
    const itemsAsked = new Set<string>(['asked-algebra']);
    const state = freshState({ itemsAsked });
    const items: Item[] = [
      makeItem({ id: 'asked-algebra', strand: 'algebra', b: 0 }),
      makeItem({ id: 'other-1', strand: 'number', b: 0 }),
      makeItem({ id: 'other-2', strand: 'geometry_trig', b: 0 }),
    ];
    const picked = engine.pickItem(items, state, 'algebra');
    expect(picked).toBeNull();
  });

  it('excludes items already in itemsAsked', () => {
    const engine = new RaschEngine();
    const itemsAsked = new Set<string>(['i0']);
    const state = freshState({ itemsAsked });
    // theta=0; both candidates are within 0.5; the asked one is closer (b=0)
    // so without exclusion it would be picked. With exclusion, b=0.3 wins.
    const items: Item[] = [
      makeItem({ id: 'i0', strand: 'algebra', b: 0 }),
      makeItem({ id: 'i1', strand: 'algebra', b: 0.3 }),
    ];
    const picked = engine.pickItem(items, state, 'algebra');
    expect(picked).not.toBeNull();
    expect(picked!.id).toBe('i1');
  });

  it('respects stage filter when stageEstimate is set', () => {
    const engine = new RaschEngine();
    const state = freshState({ stageEstimate: 'junior_cycle' });
    const items: Item[] = [
      makeItem({ id: 'p', stage: 'primary', strand: 'algebra', b: 0 }),
      makeItem({ id: 'jc', stage: 'junior_cycle', strand: 'algebra', b: 0.4 }),
    ];
    const picked = engine.pickItem(items, state, 'algebra');
    expect(picked).not.toBeNull();
    expect(picked!.id).toBe('jc');
  });

  it('tie-breaks toward lower b', () => {
    const engine = new RaschEngine();
    const state = freshState();
    // theta=0; both 0.3 distant
    const items: Item[] = [
      makeItem({ id: 'high', strand: 'algebra', b: 0.3 }),
      makeItem({ id: 'low', strand: 'algebra', b: -0.3 }),
    ];
    const picked = engine.pickItem(items, state, 'algebra');
    expect(picked).not.toBeNull();
    expect(picked!.id).toBe('low');
  });
});

describe('RaschEngine.streakBoost', () => {
  it('returns 0 with no history', () => {
    const engine = new RaschEngine();
    expect(engine.streakBoost([], 'algebra', [])).toBe(0);
  });

  it('returns +1.5 for a 3-correct streak in the same strand', () => {
    const engine = new RaschEngine();
    const items = [
      makeItem({ id: 'a1', strand: 'algebra', b: 0 }),
      makeItem({ id: 'a2', strand: 'algebra', b: 0 }),
      makeItem({ id: 'a3', strand: 'algebra', b: 0 }),
    ];
    const history: SessionState['history'] = [
      { itemId: 'a1', correct: true, latencyMs: 0 },
      { itemId: 'a2', correct: true, latencyMs: 0 },
      { itemId: 'a3', correct: true, latencyMs: 0 },
    ];
    expect(engine.streakBoost(history, 'algebra', items)).toBeCloseTo(1.5);
  });

  it('returns -1.0 for a 2-incorrect streak', () => {
    const engine = new RaschEngine();
    const items = [
      makeItem({ id: 'a1', strand: 'algebra', b: 0 }),
      makeItem({ id: 'a2', strand: 'algebra', b: 0 }),
    ];
    const history: SessionState['history'] = [
      { itemId: 'a1', correct: false, latencyMs: 0 },
      { itemId: 'a2', correct: false, latencyMs: 0 },
    ];
    expect(engine.streakBoost(history, 'algebra', items)).toBeCloseTo(-1.0);
  });

  it('caps the boost at ±1.8 even with longer streaks', () => {
    const engine = new RaschEngine();
    const items = Array.from({ length: 10 }, (_, i) =>
      makeItem({ id: `a${i}`, strand: 'algebra', b: 0 }),
    );
    const history: SessionState['history'] = items.map((it) => ({
      itemId: it.id,
      correct: true,
      latencyMs: 0,
    }));
    expect(engine.streakBoost(history, 'algebra', items)).toBe(1.8);
  });

  it('persists across strand boundaries (global momentum)', () => {
    const engine = new RaschEngine();
    const items = [
      makeItem({ id: 'a1', strand: 'algebra', b: 0 }),
      makeItem({ id: 'n1', strand: 'number', b: 0 }),
    ];
    const history: SessionState['history'] = [
      { itemId: 'a1', correct: true, latencyMs: 0 },
      { itemId: 'n1', correct: true, latencyMs: 0 },
    ];
    // Two correct in a row (mixed strands) → +1.0 in any strand. The
    // strand-rotation picker breaks per-strand streaks by design, so the
    // boost is intentionally strand-agnostic — see streakBoost docstring.
    expect(engine.streakBoost(history, 'algebra', items)).toBeCloseTo(1.0);
    expect(engine.streakBoost(history, 'number', items)).toBeCloseTo(1.0);
  });

  it('resets only when the result direction flips, not when strand changes', () => {
    const engine = new RaschEngine();
    const items = [
      makeItem({ id: 'a1', strand: 'algebra', b: 0 }),
      makeItem({ id: 'n1', strand: 'number', b: 0 }),
      makeItem({ id: 'g1', strand: 'geometry_trig', b: 0 }),
    ];
    const history: SessionState['history'] = [
      { itemId: 'a1', correct: true, latencyMs: 0 },
      { itemId: 'n1', correct: false, latencyMs: 0 },
      { itemId: 'g1', correct: false, latencyMs: 0 },
    ];
    // Trailing run is 2 incorrect → -1.0 (the leading 'correct' fences it off).
    expect(engine.streakBoost(history, 'algebra', items)).toBeCloseTo(-1.0);
  });

  it('streakBoost shifts pickItem target toward harder items', () => {
    const engine = new RaschEngine();
    const items = [
      makeItem({ id: 'easy', strand: 'algebra', b: -0.5 }),
      makeItem({ id: 'mid', strand: 'algebra', b: 0.0 }),
      makeItem({ id: 'hard', strand: 'algebra', b: 1.4 }),
    ];
    const state = freshState();
    // Without boost, theta=0 picks 'mid'.
    expect(engine.pickItem(items, state, 'algebra')!.id).toBe('mid');
    // With +1.5 boost, target = 1.5 → picks 'hard'.
    const boosted = engine.pickItem(items, state, 'algebra', { streakBoost: 1.5 });
    expect(boosted!.id).toBe('hard');
  });
});

describe('RaschEngine.tierFromTheta', () => {
  it('boundaries map correctly', () => {
    const engine = new RaschEngine();
    expect(engine.tierFromTheta(-0.6)).toBe('foundation');
    expect(engine.tierFromTheta(-0.5)).toBe('ordinary');
    expect(engine.tierFromTheta(0)).toBe('ordinary');
    expect(engine.tierFromTheta(1.0)).toBe('ordinary');
    expect(engine.tierFromTheta(1.01)).toBe('higher');
  });
});

describe('RaschEngine.recommend', () => {
  it('finalises at 20 items regardless of SE', () => {
    const engine = new RaschEngine();
    const itemsAsked = new Set<string>();
    const history: SessionState['history'] = [];
    for (let i = 0; i < 20; i++) {
      itemsAsked.add(`i${i}`);
      history.push({ itemId: `i${i}`, correct: true, latencyMs: 0 });
    }
    // Keep all SEs high so the SE rule wouldn't fire on its own.
    const state = freshState({ itemsAsked, history });
    expect(engine.recommend(state, 'algebra')).toBe('finalise');
  });

  it('does not finalise at 19 items when SE is still high', () => {
    const engine = new RaschEngine();
    const itemsAsked = new Set<string>();
    const history: SessionState['history'] = [];
    for (let i = 0; i < 19; i++) {
      itemsAsked.add(`i${i}`);
      history.push({ itemId: `i${i}`, correct: true, latencyMs: 0 });
    }
    // All SEs at 1.0 (fresh state), so neither the count rule nor the SE
    // rules should trip — just below the 20-item hard cap.
    const state = freshState({ itemsAsked, history });
    expect(engine.recommend(state, 'algebra')).toBe('continue');
  });

  it("returns 'switch_strand' at 19 items when the just-updated strand SE<0.4", () => {
    const engine = new RaschEngine();
    const itemsAsked = new Set<string>();
    const history: SessionState['history'] = [];
    for (let i = 0; i < 19; i++) {
      itemsAsked.add(`i${i}`);
      history.push({ itemId: `i${i}`, correct: true, latencyMs: 0 });
    }
    const state = freshState({ itemsAsked, history });
    state.se.algebra = 0.3;
    expect(engine.recommend(state, 'algebra')).toBe('switch_strand');
  });

  it("returns 'switch_strand' when only the just-updated strand has SE<0.4", () => {
    const engine = new RaschEngine();
    const state = freshState();
    state.se.algebra = 0.3;
    expect(engine.recommend(state, 'algebra')).toBe('switch_strand');
  });

  it("returns 'finalise' when 4 of 5 active JC strands have SE<0.4", () => {
    const engine = new RaschEngine();
    const state = freshState({ stageEstimate: 'junior_cycle' });
    state.se.number = 0.3;
    state.se.algebra = 0.3;
    state.se.geometry_trig = 0.3;
    state.se.functions = 0.3;
    expect(engine.recommend(state, 'algebra')).toBe('finalise');
  });

  it("returns 'continue' when SE is still high everywhere", () => {
    const engine = new RaschEngine();
    const state = freshState();
    expect(engine.recommend(state, 'algebra')).toBe('continue');
  });
});

// End-to-end integration against the real ITEMS bank — proves the streak
// machinery actually surfaces fundamentals + LC items, which is the user-
// facing success criterion ("range from fundamentals to advanced LC").
describe('streak progression — real ITEMS bank trajectory', () => {
  const realItems = ITEMS as unknown as Item[];

  function simulate(
    correctness: boolean[],
    strand: Strand,
  ): { picked: Item; targetB: number }[] {
    const engine = new RaschEngine();
    let state = freshState();
    const trajectory: { picked: Item; targetB: number }[] = [];
    for (const isCorrect of correctness) {
      const boost = engine.streakBoost(state.history, strand, realItems);
      const picked = engine.pickItem(realItems, state, strand, { streakBoost: boost });
      if (!picked) break;
      trajectory.push({ picked, targetB: state.theta[strand] + boost });
      state = engine.update(state, picked, isCorrect, 0);
    }
    return trajectory;
  }

  it('a hot streak in algebra reaches LC items (b ≥ 1.5) within 4 picks', () => {
    const trajectory = simulate([true, true, true, true], 'algebra');
    const maxB = Math.max(...trajectory.map((t) => t.picked.b));
    expect(maxB).toBeGreaterThanOrEqual(1.5);
  });

  it('a cold streak in number reaches primary fundamentals (b ≤ -1) within 4 picks', () => {
    const trajectory = simulate([false, false, false, false], 'number');
    const minB = Math.min(...trajectory.map((t) => t.picked.b));
    expect(minB).toBeLessThanOrEqual(-1);
  });

  it('no streak: theta=0 picks JC-range items (|b| ≤ 1)', () => {
    const engine = new RaschEngine();
    const state = freshState();
    const picked = engine.pickItem(realItems, state, 'algebra');
    expect(picked).not.toBeNull();
    expect(Math.abs(picked!.b)).toBeLessThanOrEqual(1);
  });

  it('mixed run: 2 correct then 1 incorrect resets the boost', () => {
    const engine = new RaschEngine();
    let state = freshState();
    // 2 correct → boost should be +1.0 on the 3rd pick.
    state = engine.update(state, realItems.find((i) => i.strand === 'algebra' && i.b === 0)!, true, 0);
    state = engine.update(state, realItems.find((i) => i.strand === 'algebra' && i.b > 0 && !state.itemsAsked.has(i.id))!, true, 0);
    expect(engine.streakBoost(state.history, 'algebra', realItems)).toBeCloseTo(1.0);
    // Now an incorrect → trailing streak becomes 1-incorrect, boost = -0.5.
    const wrongPick = realItems.find(
      (i) => i.strand === 'algebra' && !state.itemsAsked.has(i.id),
    )!;
    state = engine.update(state, wrongPick, false, 0);
    expect(engine.streakBoost(state.history, 'algebra', realItems)).toBeCloseTo(-0.5);
  });
});
