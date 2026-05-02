import { describe, expect, it } from 'vitest';
import { RaschEngine, K_FACTOR } from '../src/rasch-engine';
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

  it('returns null when no anchor is within ±0.5', () => {
    const engine = new RaschEngine();
    const state = freshState();
    const items: Item[] = [-2, 2].map((b, i) =>
      makeItem({ id: `i${i}`, strand: 'algebra', b }),
    );
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
  it('finalises at 15 items regardless of SE', () => {
    const engine = new RaschEngine();
    const itemsAsked = new Set<string>();
    const history: SessionState['history'] = [];
    for (let i = 0; i < 15; i++) {
      itemsAsked.add(`i${i}`);
      history.push({ itemId: `i${i}`, correct: true, latencyMs: 0 });
    }
    // Keep all SEs high so the SE rule wouldn't fire on its own.
    const state = freshState({ itemsAsked, history });
    expect(engine.recommend(state, 'algebra')).toBe('finalise');
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
