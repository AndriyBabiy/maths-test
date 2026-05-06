'use client';

import type { CSSProperties } from 'react';
import type { AttemptRecord } from '@/app/api/assessment/types';
import {
  color,
  font,
  fontSize,
  fontWeight,
  radius,
  space,
} from '../_engine/tokens';
import type { Stroke } from '../_engine/types';
import { CrossGlyph, TickGlyph } from './glyphs';
import { MathText } from './MathText';

const CHOICE_LETTERS = ['A', 'B', 'C', 'D'] as const;

const STRAND_TITLE: Record<string, string> = {
  number: 'Number',
  algebra: 'Algebra',
  geometry_trig: 'Geometry & Trig',
  functions: 'Functions',
  statistics_prob: 'Statistics & Prob',
  measures_data: 'Measures',
};

/**
 * Compute the bounding box of a set of strokes in canvas-space. Returns null
 * for empty / single-point inputs so the caller can render a placeholder.
 */
function strokesBounds(strokes: Stroke[]): {
  x: number;
  y: number;
  w: number;
  h: number;
} | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let total = 0;
  for (const s of strokes) {
    if (s.tool === 'erase') continue;
    for (const p of s.points) {
      total += 1;
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
  }
  if (total < 2 || !Number.isFinite(minX)) return null;
  const pad = 8;
  return {
    x: minX - pad,
    y: minY - pad,
    w: Math.max(1, maxX - minX + pad * 2),
    h: Math.max(1, maxY - minY + pad * 2),
  };
}

/** Convert a stroke to an SVG `d` path attribute using quadratic smoothing. */
function strokePath(s: Stroke): string {
  const pts = s.points;
  if (pts.length === 0) return '';
  let d = `M ${pts[0]!.x} ${pts[0]!.y}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1]!;
    const cur = pts[i]!;
    const mx = (prev.x + cur.x) / 2;
    const my = (prev.y + cur.y) / 2;
    d += ` Q ${prev.x} ${prev.y} ${mx} ${my}`;
  }
  return d;
}

/**
 * Tiny SVG thumbnail of the learner's strokes for one question. Auto-fits the
 * stroke bounds into the available viewBox. Renders nothing when there are no
 * strokes (the parent decides whether to show "no working").
 */
export function StrokeThumbnail({
  strokes,
  width = 220,
  height = 140,
}: {
  strokes: Stroke[];
  width?: number;
  height?: number;
}) {
  const bounds = strokesBounds(strokes);
  if (!bounds) {
    return (
      <div
        style={{
          width,
          height,
          borderRadius: radius.md,
          background: color.bg.muted,
          border: `1px dashed ${color.border.subtle}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: font.sans,
          fontSize: fontSize.tiny,
          color: color.ink.faint,
        }}
      >
        no working
      </div>
    );
  }
  return (
    <svg
      role="img"
      aria-label="Scratchpad working for this question"
      width={width}
      height={height}
      viewBox={`${bounds.x} ${bounds.y} ${bounds.w} ${bounds.h}`}
      preserveAspectRatio="xMidYMid meet"
      style={{
        background: '#fdfbf3',
        border: `1px solid ${color.border.default}`,
        borderRadius: radius.md,
        display: 'block',
      }}
    >
      {strokes.map((s, i) =>
        s.tool === 'erase' ? null : (
          <path
            key={i}
            d={strokePath(s)}
            stroke={s.color}
            strokeWidth={s.stroke || 1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ),
      )}
    </svg>
  );
}

/**
 * Per-question review card. Shows the question prompt, all four choices with
 * the learner's pick + the correct option highlighted, and a thumbnail of any
 * scratchpad strokes the learner produced while working on this question.
 */
export function QuestionReviewCard({
  attempt,
  strokes,
  index,
}: {
  attempt: AttemptRecord;
  strokes: Stroke[];
  index: number;
}) {
  return (
    <div
      style={{
        border: `1px solid ${
          attempt.correct ? color.feedback.goodEdge : color.feedback.badEdge
        }`,
        borderRadius: radius.lg,
        background: color.bg.surface,
        padding: space[6],
        display: 'flex',
        flexDirection: 'column',
        gap: space[5],
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: space[4],
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: space[3] }}>
          <span
            style={{
              fontFamily: font.sans,
              fontSize: fontSize.tiny,
              fontWeight: fontWeight.semibold,
              color: color.ink.muted,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Q{index + 1}
          </span>
          <span
            style={{
              fontFamily: font.sans,
              fontSize: fontSize.tiny,
              color: color.ink.faint,
            }}
          >
            {STRAND_TITLE[attempt.strand] ?? attempt.strand} ·{' '}
            {attempt.learningOutcome} · b={attempt.b.toFixed(1)}
          </span>
        </div>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: space[2],
            fontFamily: font.sans,
            fontSize: fontSize.tiny,
            fontWeight: fontWeight.semibold,
            color: attempt.correct
              ? color.feedback.goodInk
              : color.feedback.badInk,
          }}
        >
          {attempt.correct ? (
            <TickGlyph size={14} ink={color.feedback.goodInk} />
          ) : (
            <CrossGlyph size={14} ink={color.feedback.badInk} />
          )}
          {attempt.correct ? 'Correct' : 'Incorrect'}
        </span>
      </div>

      <div
        style={{
          fontFamily: font.sans,
          fontSize: fontSize.body,
          color: color.ink.primary,
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
        }}
      >
        <MathText source={attempt.text} />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: space[2],
        }}
      >
        {attempt.choices.map((text, i) => {
          const isChosen = attempt.chosenIndex === i;
          const isCorrect = attempt.correctIndex === i;

          let bg: string = color.bg.surface;
          let border: string = color.border.subtle;
          let ink: string = color.ink.secondary;
          if (isCorrect) {
            bg = color.feedback.goodBg;
            border = color.feedback.goodEdge;
            ink = color.feedback.goodInk;
          } else if (isChosen) {
            bg = color.feedback.badBg;
            border = color.feedback.badEdge;
            ink = color.feedback.badInk;
          }

          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: space[3],
                padding: `${space[3]}px ${space[4]}px`,
                background: bg,
                border: `1px solid ${border}`,
                borderRadius: radius.md,
                fontFamily: font.sans,
                fontSize: fontSize.small,
                color: ink,
              }}
            >
              <span
                style={{
                  fontWeight: fontWeight.semibold,
                  minWidth: 18,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {CHOICE_LETTERS[i]}
              </span>
              <span style={{ flex: 1, whiteSpace: 'pre-wrap' }}>
                <MathText source={text} />
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  gap: space[2],
                  alignItems: 'center',
                  fontSize: fontSize.tiny,
                  fontWeight: fontWeight.medium,
                }}
              >
                {isChosen && (
                  <span
                    style={{
                      padding: `2px ${space[2]}px`,
                      borderRadius: radius.pill,
                      background: isCorrect
                        ? color.feedback.goodBg
                        : color.feedback.badBg,
                      border: `1px solid ${
                        isCorrect ? color.feedback.goodEdge : color.feedback.badEdge
                      }`,
                    }}
                  >
                    your answer
                  </span>
                )}
                {isCorrect && !isChosen && (
                  <span
                    style={{
                      padding: `2px ${space[2]}px`,
                      borderRadius: radius.pill,
                      background: color.feedback.goodBg,
                      border: `1px solid ${color.feedback.goodEdge}`,
                    }}
                  >
                    correct
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: space[4],
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flexShrink: 0 }}>
          <StrokeThumbnail strokes={strokes} />
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <span
            style={summaryLabelStyle}
          >
            Working notes
          </span>
          <p
            style={{
              fontFamily: font.sans,
              fontSize: fontSize.small,
              color: color.ink.muted,
              lineHeight: 1.5,
              marginTop: space[2],
            }}
          >
            {strokes.length === 0
              ? 'No scratchpad notes recorded for this question.'
              : `${strokes.length} stroke${strokes.length === 1 ? '' : 's'} captured · time ${(attempt.latencyMs / 1000).toFixed(1)}s`}
          </p>
        </div>
      </div>
    </div>
  );
}

const summaryLabelStyle: CSSProperties = {
  fontFamily: font.sans,
  fontSize: fontSize.tiny,
  fontWeight: fontWeight.semibold,
  color: color.ink.soft,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
};
