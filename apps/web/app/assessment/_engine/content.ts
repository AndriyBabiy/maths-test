import type { Question, SectionMeta } from './types';

/**
 * Sections == JC strands from `@maths-diag/core`. Order is the canonical
 * NCCA Project Maths order. `groupBySection` iterates this and skips strands
 * that have no questions yet — so it's safe to keep all six listed even
 * before the API has revealed an item in that strand.
 */
export const SECTION_META: SectionMeta[] = [
  { id: 'number',          title: 'Number',           summary: 'arithmetic & estimation' },
  { id: 'algebra',         title: 'Algebra',          summary: 'expressions & equations' },
  { id: 'geometry_trig',   title: 'Geometry & Trig',  summary: 'shapes, angles, ratios' },
  { id: 'functions',       title: 'Functions',        summary: 'evaluate, inverse, graphs' },
  { id: 'statistics_prob', title: 'Statistics & Prob', summary: 'data, chance' },
  { id: 'measures_data',   title: 'Measures',         summary: 'units & data' },
];

/**
 * Initial state is empty — the first Question is fetched from `/api/assessment`
 * via `apiStart` on mount. The previous synthetic mid-session bake-in
 * (q1/a1/a2/a3 marked done) is dropped because the backend owns adaptive
 * progression now.
 */
export function buildInitialState(): Question[] {
  return [];
}
