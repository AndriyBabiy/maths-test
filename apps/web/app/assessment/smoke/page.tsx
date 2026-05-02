'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  color,
  font,
  fontSize,
  fontWeight,
  radius,
  shadow,
  space,
} from '../_engine/tokens';
import type {
  AssessmentRequest,
  AssessmentResponse,
  PublicItem,
} from '../../api/assessment/types';

/**
 * Smoke-harness for the `/api/assessment` route.
 *
 * Deliberately scrappy: this exists to prove end-to-end wiring against the
 * deployed Lua agent. The polished UI lives at `/assessment`. Modern clean
 * shell with monospace data, dashed-edge debug callouts.
 */
export default function AssessmentSmokePage() {
  const [sessionId] = useState<string>(() =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `sess_${Date.now()}`,
  );
  const [response, setResponse] = useState<AssessmentResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [askedAt, setAskedAt] = useState<number | null>(null);

  const post = useCallback(
    async (body: AssessmentRequest): Promise<void> => {
      setLoading(true);
      try {
        const res = await fetch('/api/assessment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = (await res.json()) as AssessmentResponse;
        setResponse(data);
        if (data.kind === 'next_item') {
          setAskedAt(Date.now());
        }
      } catch (err) {
        setResponse({
          kind: 'error',
          message: err instanceof Error ? err.message : 'unknown error',
        });
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const onStart = useCallback(() => {
    void post({ kind: 'start', sessionId });
  }, [post, sessionId]);

  const onAnswer = useCallback(
    (item: PublicItem, idx: 0 | 1 | 2 | 3) => {
      const latencyMs = askedAt ? Date.now() - askedAt : 0;
      void post({
        kind: 'answer',
        sessionId,
        itemId: item.id,
        chosenIndex: idx,
        latencyMs,
      });
    },
    [askedAt, post, sessionId],
  );

  const onFinalise = useCallback(() => {
    void post({ kind: 'finalise', sessionId });
  }, [post, sessionId]);

  const currentItem = useMemo<PublicItem | null>(() => {
    return response?.kind === 'next_item' ? response.item : null;
  }, [response]);

  const primaryBtn = {
    fontFamily: font.sans,
    fontSize: fontSize.body,
    fontWeight: fontWeight.medium,
    background: color.accent.primary,
    color: color.ink.onAccent,
    border: 'none',
    borderRadius: radius.md,
    padding: `${space[4]}px ${space[7]}px`,
    cursor: 'pointer',
    minHeight: 36,
    transition: 'background 200ms cubic-bezier(0.4, 0, 0.2, 1)',
  } as const;

  const secondaryBtn = {
    fontFamily: font.sans,
    fontSize: fontSize.body,
    fontWeight: fontWeight.medium,
    background: color.bg.surface,
    color: color.ink.primary,
    border: `1px solid ${color.border.default}`,
    borderRadius: radius.md,
    padding: `${space[4]}px ${space[7]}px`,
    cursor: 'pointer',
    minHeight: 36,
    transition: 'background 200ms cubic-bezier(0.4, 0, 0.2, 1)',
  } as const;

  const choiceBtn = {
    ...secondaryBtn,
    textAlign: 'left' as const,
    width: '100%',
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        background: color.bg.canvas,
        padding: space[10],
        fontFamily: font.sans,
        color: color.ink.primary,
      }}
    >
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: space[5],
            paddingBottom: space[6],
            borderBottom: `1px solid ${color.border.default}`,
            marginBottom: space[8],
          }}
        >
          <h1
            style={{
              fontFamily: font.sans,
              fontSize: fontSize.h2,
              fontWeight: fontWeight.semibold,
              letterSpacing: '-0.02em',
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            Assessment · smoke harness
          </h1>
          <span
            style={{
              fontFamily: font.mono,
              fontSize: fontSize.micro,
              fontWeight: fontWeight.semibold,
              padding: `${space[1]}px ${space[4]}px`,
              border: `1px solid ${color.feedback.warnEdge}`,
              background: color.feedback.warnBg,
              color: color.feedback.warnInk,
              borderRadius: radius.pill,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Debug
          </span>
        </div>

        <p
          style={{
            fontFamily: font.mono,
            fontSize: fontSize.tiny,
            color: color.ink.muted,
            margin: `0 0 ${space[7]}px 0`,
          }}
        >
          sessionId: {sessionId}
        </p>

        <section
          style={{
            display: 'flex',
            gap: space[5],
            marginBottom: space[8],
          }}
        >
          <button
            type="button"
            onClick={onStart}
            disabled={loading}
            style={{ ...primaryBtn, opacity: loading ? 0.5 : 1 }}
          >
            {response ? 'Restart' : 'Start assessment'}
          </button>
          <button
            type="button"
            onClick={onFinalise}
            disabled={loading || !response}
            style={{
              ...secondaryBtn,
              opacity: loading || !response ? 0.5 : 1,
            }}
          >
            Force finalise
          </button>
        </section>

        {loading && (
          <p
            style={{
              fontFamily: font.sans,
              color: color.ink.muted,
              fontSize: fontSize.body,
            }}
          >
            Calling Lua agent…
          </p>
        )}

        {currentItem && (
          <section
            style={{
              marginBottom: space[8],
              padding: space[8],
              background: color.bg.surface,
              border: `1px solid ${color.border.default}`,
              borderRadius: radius.lg,
              boxShadow: shadow.xs,
            }}
          >
            <h2
              style={{
                fontFamily: font.sans,
                fontSize: fontSize.h3,
                fontWeight: fontWeight.semibold,
                margin: 0,
                marginBottom: space[5],
                display: 'flex',
                alignItems: 'baseline',
                gap: space[5],
              }}
            >
              {currentItem.strand}
              <span
                style={{
                  fontFamily: font.mono,
                  fontSize: fontSize.tiny,
                  color: color.ink.soft,
                  fontWeight: fontWeight.regular,
                }}
              >
                b={currentItem.b}
              </span>
            </h2>
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                background: color.bg.muted,
                padding: space[6],
                fontFamily: font.mono,
                fontSize: fontSize.body,
                border: `1px solid ${color.border.default}`,
                borderRadius: radius.md,
                margin: 0,
                color: color.ink.primary,
                lineHeight: 1.6,
              }}
            >
              {currentItem.text}
            </pre>
            <div
              style={{
                display: 'grid',
                gap: space[4],
                marginTop: space[6],
              }}
            >
              {currentItem.choices.map((choice, idx) => (
                <button
                  type="button"
                  key={idx}
                  disabled={loading}
                  onClick={() => onAnswer(currentItem, idx as 0 | 1 | 2 | 3)}
                  style={choiceBtn}
                >
                  <strong style={{ marginRight: space[4] }}>
                    {String.fromCharCode(65 + idx)}.
                  </strong>
                  {choice}
                </button>
              ))}
            </div>
            {response?.kind === 'next_item' && (
              <p
                style={{
                  marginTop: space[6],
                  fontFamily: font.sans,
                  fontSize: fontSize.body,
                  color: color.ink.secondary,
                  lineHeight: 1.5,
                }}
              >
                <em>{response.progress.commentary}</em>
                <br />
                <small
                  style={{ fontFamily: font.mono, color: color.ink.soft }}
                >
                  asked {response.progress.asked} / {response.progress.cap}
                </small>
              </p>
            )}
          </section>
        )}

        {response?.kind === 'report' && (
          <section
            style={{
              marginBottom: space[8],
              padding: space[8],
              background: color.feedback.goodBg,
              border: `1px solid ${color.feedback.goodEdge}`,
              borderRadius: radius.lg,
            }}
          >
            <h2
              style={{
                fontFamily: font.sans,
                fontSize: fontSize.h3,
                fontWeight: fontWeight.semibold,
                margin: 0,
                marginBottom: space[5],
                color: color.feedback.goodInk,
              }}
            >
              Report
            </h2>
            <p
              style={{
                margin: 0,
                color: color.feedback.goodInk,
                lineHeight: 1.5,
              }}
            >
              <em>{response.commentary}</em>
            </p>
          </section>
        )}

        {response?.kind === 'error' && (
          <section
            style={{
              marginBottom: space[8],
              padding: space[8],
              background: color.feedback.badBg,
              border: `1px solid ${color.feedback.badEdge}`,
              color: color.feedback.badInk,
              borderRadius: radius.lg,
            }}
          >
            <h2
              style={{
                fontFamily: font.sans,
                fontSize: fontSize.h3,
                fontWeight: fontWeight.semibold,
                margin: 0,
                marginBottom: space[5],
              }}
            >
              Error
            </h2>
            <p
              style={{
                margin: 0,
                fontFamily: font.mono,
                fontSize: fontSize.body,
              }}
            >
              {response.message}
            </p>
          </section>
        )}

        <details style={{ marginTop: space[10] }}>
          <summary
            style={{
              cursor: 'pointer',
              fontFamily: font.sans,
              fontSize: fontSize.body,
              fontWeight: fontWeight.medium,
              color: color.ink.muted,
            }}
          >
            Raw response (debug)
          </summary>
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              background: color.bg.muted,
              padding: space[6],
              fontFamily: font.mono,
              fontSize: fontSize.tiny,
              border: `1px solid ${color.border.default}`,
              borderRadius: radius.md,
              marginTop: space[5],
              color: color.ink.secondary,
              lineHeight: 1.5,
            }}
          >
            {response ? JSON.stringify(response, null, 2) : '(no response yet)'}
          </pre>
        </details>
      </div>
    </main>
  );
}
