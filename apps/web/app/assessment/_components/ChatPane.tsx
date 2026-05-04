'use client';

import { type CSSProperties, useEffect, useRef, useState } from 'react';
import {
  color,
  font,
  fontSize,
  fontWeight,
  motion,
  radius,
  shadow,
  space,
} from '../_engine/tokens';
import type { ChatMessage, Mood } from '../_engine/types';
import { SendGlyph } from './glyphs';
import { MathText } from './MathText';
import { ChatBubble, SketchBtn, Tutor } from './primitives';

interface ChatPaneProps {
  chat: ChatMessage[];
  qIndex: number;
  total: number;
  tutorMood: Mood;
  onSend: (text: string) => void;
}

const QUICK_REPLIES = ['Hint', 'Explain step', "I'm stuck"] as const;

export function ChatPane({
  chat,
  qIndex,
  total,
  tutorMood,
  onSend,
}: ChatPaneProps) {
  const [draft, setDraft] = useState('');
  const [composerFocus, setComposerFocus] = useState(false);
  const [hoverChip, setHoverChip] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [chat]);

  function send() {
    if (!draft.trim()) return;
    onSend(draft.trim());
    setDraft('');
  }

  const composerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: space[3],
    width: '100%',
    boxSizing: 'border-box',
    background: color.bg.surface,
    border: `1px solid ${composerFocus ? color.accent.primaryEdge : color.border.default}`,
    borderRadius: radius.xl,
    padding: space[3],
    boxShadow: composerFocus ? shadow.focus : shadow.xs,
    transition: `border-color ${motion.fast}, box-shadow ${motion.fast}`,
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        padding: `${space[7]}px ${space[8]}px`,
        fontFamily: font.sans,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: space[5],
          paddingBottom: space[5],
          marginBottom: space[5],
          borderBottom: `1px solid ${color.border.subtle}`,
        }}
      >
        <Tutor size={36} mood={tutorMood} talking />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: font.sans,
              fontSize: fontSize.body,
              fontWeight: fontWeight.semibold,
              color: color.ink.primary,
              lineHeight: 1.2,
              letterSpacing: '-0.01em',
            }}
          >
            Math tutor
          </div>
          <div
            style={{
              fontFamily: font.sans,
              fontSize: fontSize.tiny,
              fontWeight: fontWeight.regular,
              color: color.ink.soft,
              lineHeight: 1.4,
              marginTop: 2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            Adaptive · ready
          </div>
        </div>
        {total > 0 && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: color.bg.muted,
              border: `1px solid ${color.border.default}`,
              color: color.ink.secondary,
              padding: `${space[2]}px ${space[5]}px`,
              borderRadius: radius.pill,
              fontFamily: font.sans,
              fontSize: fontSize.tiny,
              fontWeight: fontWeight.medium,
              lineHeight: 1.4,
              whiteSpace: 'nowrap',
            }}
          >
            Q {qIndex + 1} / {total}
          </span>
        )}
      </div>

      {/* Chat scroll */}
      <div
        ref={ref}
        style={{
          flex: 1,
          overflowY: 'auto',
          minHeight: 0,
          paddingRight: space[3],
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: space[5],
            paddingTop: space[5],
          }}
        >
          {chat.map((m, i) => {
            const prev = i > 0 ? chat[i - 1] : undefined;
            const sameAuthorAsPrev = prev?.who === m.who;
            const showAuthor =
              m.who === 'tutor' && (i === 0 || !sameAuthorAsPrev);
            return (
              <ChatBubble
                key={i}
                who={m.who}
                text={<MathText source={m.text} />}
                mood={m.mood}
                small
                showAuthor={showAuthor}
              />
            );
          })}
        </div>
      </div>

      {/* Composer */}
      <div style={{ marginTop: space[5] }}>
        <div style={composerStyle}>
          <label
            htmlFor="mn-chat-input"
            style={{ position: 'absolute', left: -9999 }}
          >
            Message tutor
          </label>
          <input
            id="mn-chat-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            onFocus={() => setComposerFocus(true)}
            onBlur={() => setComposerFocus(false)}
            placeholder="Message tutor…"
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontFamily: font.sans,
              fontSize: 14,
              fontWeight: fontWeight.regular,
              padding: `${space[3]}px ${space[4]}px`,
              color: color.ink.primary,
              minWidth: 0,
              lineHeight: 1.5,
            }}
          />
          <SketchBtn
            small
            variant="primary"
            onClick={send}
            ariaLabel="Send message"
          >
            <SendGlyph size={14} ink="currentColor" />
          </SketchBtn>
        </div>

        {/* Quick replies */}
        <div
          style={{
            display: 'flex',
            gap: space[3],
            marginTop: space[4],
            flexWrap: 'wrap',
          }}
        >
          {QUICK_REPLIES.map((s) => {
            const isHover = hoverChip === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => onSend(s)}
                onMouseEnter={() => setHoverChip(s)}
                onMouseLeave={() => setHoverChip(null)}
                style={{
                  background: isHover ? color.bg.muted : 'transparent',
                  border: `1px solid ${color.border.default}`,
                  borderRadius: radius.pill,
                  padding: '4px 12px',
                  fontFamily: font.sans,
                  fontSize: fontSize.tiny,
                  fontWeight: fontWeight.medium,
                  color: isHover ? color.ink.secondary : color.ink.muted,
                  cursor: 'pointer',
                  lineHeight: 1.4,
                  transition: `background ${motion.fast}, color ${motion.fast}, border-color ${motion.fast}`,
                }}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
