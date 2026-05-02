/**
 * Tiny LaTeX → readable-text transform for chat UIs that don't render maths.
 *
 * The item bank uses LaTeX (`$\frac{2}{3}$`, `$x^2$`) so it can be rendered
 * by KaTeX in the future. The Lua chat UI (heylua.ai) treats `$…$` as raw
 * Markdown maths blocks but has no KaTeX, so the maths line renders empty.
 * Until the UI learns LaTeX, we degrade to Unicode + ASCII at the tool
 * boundary so the agent always sees readable text.
 *
 * Scope is intentionally narrow — we only handle the patterns the JC item
 * bank actually uses. Anything we don't recognise is passed through
 * unchanged after stripping the `$` delimiters.
 */

const SUPERSCRIPT_DIGITS: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
};

function toSuperscript(s: string): string {
  let out = '';
  for (const ch of s) {
    out += SUPERSCRIPT_DIGITS[ch] ?? ch;
  }
  return out;
}

/**
 * Apply LaTeX → readable transforms. Run repeatedly because some patterns
 * are nested (e.g. `\frac{\sqrt{2}}{3}`).
 */
function rewriteLatex(input: string): string {
  let s = input;

  // \frac{a}{b}  →  a/b   (parenthesise multi-char numerators/denominators)
  s = s.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, (_m, a: string, b: string) => {
    const num = a.length > 1 ? `(${a})` : a;
    const den = b.length > 1 ? `(${b})` : b;
    return `${num}/${den}`;
  });

  // \sqrt{x}  →  √x  (or √(x) for multi-char)
  s = s.replace(/\\sqrt\{([^{}]+)\}/g, (_m, x: string) => {
    return x.length > 1 ? `√(${x})` : `√${x}`;
  });

  // x^{n} or x^n  →  Unicode superscript when the exponent is purely digits.
  s = s.replace(/\^\{([0-9]+)\}/g, (_m, n: string) => toSuperscript(n));
  s = s.replace(/\^([0-9])/g, (_m, n: string) => toSuperscript(n));

  // Common operators
  s = s.replace(/\\cdot/g, '·');
  s = s.replace(/\\times/g, '×');
  s = s.replace(/\\div/g, '÷');
  s = s.replace(/\\pi/g, 'π');
  s = s.replace(/\\theta/g, 'θ');
  s = s.replace(/\\le(q)?\b/g, '≤');
  s = s.replace(/\\ge(q)?\b/g, '≥');
  s = s.replace(/\\neq/g, '≠');
  s = s.replace(/\\pm/g, '±');

  return s;
}

/**
 * Strip `$…$` math delimiters and apply the LaTeX rewrite. Idempotent for
 * input that's already plain text.
 */
export function stripLatex(input: string): string {
  // Apply rewrite globally (LaTeX commands can appear outside `$...$` too).
  let s = rewriteLatex(input);
  // Strip $ delimiters but keep the inner text.
  s = s.replace(/\$([^$]+)\$/g, (_m, inner: string) => rewriteLatex(inner));
  // Backslash-prefixed commands we didn't handle: drop the backslash so the
  // LLM sees a recognisable token (e.g. `\alpha` → `alpha`).
  s = s.replace(/\\([A-Za-z]+)/g, '$1');
  return s;
}
