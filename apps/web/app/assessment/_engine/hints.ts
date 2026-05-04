import type { Question } from './types';

export type HintLevels = Record<string, number>;

interface HintTier {
  nudge: string;
  example: string;
  scaffold: string;
  granular: string;
}

const FACTOR_QUADRATIC: HintTier = {
  nudge:
    "Factoring a quadratic means rewriting it as two brackets that multiply back to the original. What product gives you the constant term, and what sum gives you the middle coefficient?",
  example:
    "Try a simpler one first: x² + 5x + 6. You need two numbers that multiply to 6 and add to 5 — that's 2 and 3, so it factors to (x + 2)(x + 3). Apply the exact same routine to this problem.",
  scaffold:
    "Steps for this problem on the pad: 1) Look at the constant term — list every factor pair, including negatives if the constant is positive but the middle term is negative. 2) Find the pair whose signed sum equals the middle (x) coefficient. 3) Write the answer as (x ± a)(x ± b). Don't pick A/B/C/D yet — first write a and b on the pad.",
  granular:
    "Pin it down: name the two unknowns p and q. They must satisfy p × q = constant AND p + q = middle coefficient. Write that pair down. Then expand each option mentally — three of them will fail one of those two checks. Eliminate those first.",
};

const FRACTION_ARITH: HintTier = {
  nudge:
    "You can only add or subtract fractions when they share a denominator. What's the lowest common denominator here?",
  example:
    "Similar example: 1/2 + 1/3. LCD is 6 → 3/6 + 2/6 → 5/6. Apply the same conversion here.",
  scaffold:
    "Steps: 1) Find the LCD of the two denominators. 2) Rewrite each fraction with that LCD on the bottom. 3) Add or subtract the numerators only — never the denominators. 4) Simplify by dividing top and bottom by any common factor. Write the LCD on the pad before picking.",
  granular:
    "Set up the LCD column on paper. Multiply each original numerator by (LCD ÷ its denominator). Add or subtract those new numerators above the LCD. If two options share the right denominator but differ in numerator, recompute the multiplier mismatch — that's where the wrong option will diverge.",
};

const LINEAR_EQ: HintTier = {
  nudge:
    "To solve for x, isolate it. What operation is currently wrapping x, and what's the inverse of that operation?",
  example:
    "Similar example: 2x + 3 = 11. Subtract 3 from both sides → 2x = 8. Divide both sides by 2 → x = 4. Same routine here.",
  scaffold:
    "Steps: 1) Move every non-x term to the other side using the inverse operation (do it to BOTH sides). 2) Combine like terms. 3) Divide both sides by the coefficient on x. Track each side in two columns on the pad — they must stay balanced.",
  granular:
    "Verification trick: take each option's value and substitute it back into the original equation. Compute LHS and RHS. Only one option makes them equal. If your algebra and the substitution disagree, redo the algebra step that involved a sign or division — those are the most error-prone.",
};

const GEOMETRY: HintTier = {
  nudge:
    "Sketch the figure and label every length, angle, or relationship the question gives you. Which classical rule (Pythagoras, area = ½ × base × height, angles in a triangle = 180°, similar triangles…) connects what you have to what you need?",
  example:
    "Similar example: a right triangle with legs 3 and 4. Pythagoras → hypotenuse² = 3² + 4² = 25 → hypotenuse = 5. Use the rule that fits whatever this problem is asking for.",
  scaffold:
    "Steps: 1) Draw and label the figure on the pad. 2) Identify which rule applies. 3) Write the equation with your numbers substituted in. 4) Solve algebraically for the unknown. Only after you have a numeric answer should you compare to the four options.",
  granular:
    "Sanity-check by units. If the question asks for a length but two options have area-style units, drop those. If it asks for an angle, the answer must be between 0° and 180° in this curriculum. Cross-check by recomputing with a different rule if you know one — answers from two valid methods must agree.",
};

const STATS: HintTier = {
  nudge:
    "Which measure does the question want — mean, median, mode, range, or probability? Identify that first; the formula follows the name.",
  example:
    "Similar example: mean of {2, 4, 6} = (2 + 4 + 6) ÷ 3 = 4. Probability of an event = favourable outcomes ÷ total outcomes. Use the same definition that matches the wording here.",
  scaffold:
    "Steps: 1) Write the formula for the requested measure. 2) Plug in the data exactly as given (don't reorder unless the formula needs it — median does, mean does not). 3) Compute. Write the formula on the pad before picking.",
  granular:
    "Common pitfalls: for median with an even number of items, average the two middle values. For probability, check the sample space size — wrong total is the most common mistake. Recount the data set on the pad before computing.",
};

const FUNCTIONS: HintTier = {
  nudge:
    "Identify the family of the function — linear, quadratic, exponential — by looking at the highest power of x or any shape clues. The strategy depends on the family.",
  example:
    "Similar example: f(x) = 2x + 1 evaluated at x = 3 → f(3) = 2(3) + 1 = 7. Substitute the input into the rule, respect BIDMAS, write down each step.",
  scaffold:
    "Steps: 1) Write f(x) explicitly with the rule given. 2) Substitute the requested input wherever x appears. 3) Compute one operation at a time, in BIDMAS order. Show every line on the pad.",
  granular:
    "Feature shortcuts: y-intercept = f(0); slope of a linear function = coefficient of x; vertex x-coordinate of a quadratic ax² + bx + c is x = −b ÷ (2a). Compute that single number, then match it to the option list.",
};

const NUMBER_GENERIC: HintTier = {
  nudge:
    "Read the question once more and identify the operation it's asking for — add, subtract, multiply, divide, evaluate, simplify. The verb tells you the strategy.",
  example:
    "Walk through a smaller version of the same operation on the pad first — replace any large numbers with small ones (e.g. 24 → 2, 36 → 3) and confirm the pattern. Then apply the exact same steps to the real numbers.",
  scaffold:
    "Steps: 1) Rewrite the question as a clear expression on the pad. 2) Apply BIDMAS — brackets first, then indices, division/multiplication, addition/subtraction. 3) Compute one step at a time. 4) Compare your result to the options.",
  granular:
    "Estimate first to bracket the answer: round each input to the nearest 10 or whole number and compute mentally. Any option far from that estimate can be eliminated immediately. Then redo the exact arithmetic to choose between the survivors.",
};

function pickTier(q: Question): HintTier {
  const text = `${q.prompt ?? ''} ${q.topic ?? ''}`.toLowerCase();
  if (/factori[sz]e|\bfactor\b/.test(text) && /x/.test(text)) {
    return FACTOR_QUADRATIC;
  }
  if (/\b\d+\s*\/\s*\d+\b|fraction|denominator/.test(text)) {
    return FRACTION_ARITH;
  }
  if (/solve.*=|equation/.test(text)) return LINEAR_EQ;
  if (
    /triangle|circle|angle|hypotenuse|\barea\b|perimeter|pythagoras|cosine|sine|tangent/.test(
      text,
    )
  ) {
    return GEOMETRY;
  }
  if (
    /probability|\bmean\b|median|\bmode\b|\brange\b|standard deviation|chance|likelihood/.test(
      text,
    )
  ) {
    return STATS;
  }
  if (/f\s*\(\s*x\s*\)|function|graph|slope|intercept|vertex/.test(text)) {
    return FUNCTIONS;
  }

  const strand = (q.strand ?? '').toLowerCase();
  if (strand.includes('algebra')) return LINEAR_EQ;
  if (strand.includes('geometry') || strand.includes('trig')) return GEOMETRY;
  if (strand.includes('statistics') || strand.includes('prob')) return STATS;
  if (strand.includes('functions')) return FUNCTIONS;
  return NUMBER_GENERIC;
}

const ANTI_REVEAL_GUARDS = [
  "I won't tell you which option is correct — work the steps on the pad and pick the choice that matches what you got.",
  "Show your working first. If your computed result matches one option exactly, that's your pick. If two seem close, recheck the step that involved a sign or a division.",
  "Trust your method, not your gut: the option that survives the steps above is the answer — even if it 'looks' less likely.",
];

/**
 * Returns a hint whose depth grows with `level` (1-based). Level 1 is a strategic
 * nudge; level 2 adds a worked similar example; level 3 lays out step-by-step
 * scaffolding for THIS problem; level 4+ rotates granular setup advice. Never
 * names the correct option.
 *
 * `baseHint` (optional) is the question's static hint from the item bank — used
 * as level 1 when present so curated content takes precedence over the template.
 */
export function getProgressiveHint(
  q: Question,
  level: number,
  baseHint?: string,
): string {
  const tier = pickTier(q);
  const lvl = Math.max(1, Math.floor(level));
  const guard =
    ANTI_REVEAL_GUARDS[(lvl - 1) % ANTI_REVEAL_GUARDS.length] ??
    ANTI_REVEAL_GUARDS[0];

  if (lvl === 1) {
    return baseHint && baseHint.trim().length > 0 ? baseHint : tier.nudge;
  }
  if (lvl === 2) return `${tier.example}\n\n${guard}`;
  if (lvl === 3) return `${tier.scaffold}\n\n${guard}`;
  return `${tier.granular}\n\n${guard}`;
}
