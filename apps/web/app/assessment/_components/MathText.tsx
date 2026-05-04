'use client';

import { Fragment, type ReactNode } from 'react';
import { InlineMath } from 'react-katex';

/**
 * Renders a string that may contain inline LaTeX delimited by `$...$`.
 * Prose segments render as plain text; math segments render via KaTeX.
 *
 * Example: `Solve $2x + 3 = 11$.` → "Solve " · KaTeX(2x+3=11) · "."
 *
 * Malformed input (e.g. an odd number of `$`) falls back to the original
 * string verbatim so dollar amounts in prose never accidentally vanish.
 */
interface MathTextProps {
  source: string;
}

const SEGMENT = /\$([^$]+)\$/g;

export function MathText({ source }: MathTextProps): ReactNode {
  if (!source.includes('$')) return source;

  const dollarCount = (source.match(/\$/g) ?? []).length;
  if (dollarCount % 2 !== 0) return source;

  const out: ReactNode[] = [];
  let lastIdx = 0;
  let key = 0;
  for (const m of source.matchAll(SEGMENT)) {
    const idx = m.index ?? 0;
    if (idx > lastIdx) {
      out.push(
        <Fragment key={`p${key++}`}>{source.slice(lastIdx, idx)}</Fragment>,
      );
    }
    out.push(<InlineMath key={`m${key++}`} math={m[1] ?? ''} />);
    lastIdx = idx + m[0].length;
  }
  if (lastIdx < source.length) {
    out.push(<Fragment key={`p${key++}`}>{source.slice(lastIdx)}</Fragment>);
  }
  return <>{out}</>;
}
