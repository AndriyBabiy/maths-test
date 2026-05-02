import { describe, expect, it } from 'vitest';
import { SessionStore } from '../src/session-store';
import type { Strand } from '../src/types';

const STRANDS: Strand[] = [
  'number',
  'algebra',
  'geometry_trig',
  'functions',
  'statistics_prob',
  'measures_data',
];

describe('SessionStore', () => {
  it('create + get round-trips with all 6 strands seeded', () => {
    const store = new SessionStore();
    const s = store.create('abc');
    expect(s.sessionId).toBe('abc');
    expect(s.stageEstimate).toBeNull();
    expect(s.finalised).toBe(false);
    expect(s.history).toEqual([]);
    expect(s.itemsAsked.size).toBe(0);
    for (const strand of STRANDS) {
      expect(s.theta[strand]).toBe(0);
      expect(s.se[strand]).toBe(1.0);
    }
    expect(store.get('abc')).toBe(s);
  });

  it('get returns null for unknown session', () => {
    const store = new SessionStore();
    expect(store.get('nope')).toBeNull();
  });

  it('create throws on duplicate session id', () => {
    const store = new SessionStore();
    store.create('dup');
    expect(() => store.create('dup')).toThrow();
  });

  it('update replaces state with the updater result', () => {
    const store = new SessionStore();
    store.create('s1');
    const next = store.update('s1', (s) => ({ ...s, finalised: true }));
    expect(next.finalised).toBe(true);
    expect(store.get('s1')!.finalised).toBe(true);
  });

  it('update throws when session does not exist', () => {
    const store = new SessionStore();
    expect(() => store.update('missing', (s) => s)).toThrow();
  });
});
