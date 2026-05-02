'use client';

import { type CSSProperties, type ReactNode, useState } from 'react';
import {
  color,
  font,
  fontSize,
  fontWeight,
  motion as motionTokens,
  radius,
  shadow,
  space,
} from '../_engine/tokens';
import type { Mood } from '../_engine/types';

/* ─────────────────────── Card (was SketchBox) ───────────────────────
 * A flat surface with optional border, elevation, and padding. Replaces
 * the hand-drawn SketchBox. The legacy `seed`, `sw`, `color` props are
 * accepted but ignored so existing callsites keep compiling.
 */

interface CardProps {
  children?: ReactNode;
  pad?: number;
  fill?: string;
  radius?: number;
  border?: string | false;
  elevation?: 'none' | 'xs' | 'sm' | 'md' | 'lg';
  onClick?: () => void;
  style?: CSSProperties;
  className?: string;

  // Legacy ignored props (kept for back-compat).
  color?: string;
  sw?: number;
  seed?: number;
}

export function SketchBox({
  children,
  pad = 16,
  fill = color.bg.surface,
  radius: r = radius.lg,
  border = `1px solid ${color.border.default}`,
  elevation = 'xs',
  onClick,
  style,
  className,
}: CardProps) {
  const shadowMap = { none: 'none', xs: shadow.xs, sm: shadow.sm, md: shadow.md, lg: shadow.lg };
  return (
    <div
      onClick={onClick}
      className={className}
      style={{
        background: fill,
        border: border || undefined,
        borderRadius: r,
        padding: pad,
        boxShadow: shadowMap[elevation],
        cursor: onClick ? 'pointer' : style?.cursor,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// Re-export under modern name.
export const Card = SketchBox;

/* ─────────────────────── Underline ─────────────────────── */

export function SketchUnderline({
  width = 80,
  color: c = color.accent.primary,
  sw = 2,
}: {
  width?: number;
  color?: string;
  sw?: number;
  seed?: number;
}) {
  return (
    <div
      style={{
        width,
        height: sw,
        background: c,
        borderRadius: sw,
      }}
    />
  );
}

/* ─────────────────────── Tutor avatar ─────────────────────── */

interface TutorProps {
  size?: number;
  mood?: Mood;
  label?: string;
  talking?: boolean;
}

export function Tutor({ size = 40, mood = 'happy', label, talking }: TutorProps) {
  // Mood drives the dot color; talking pulses opacity.
  const moodColor =
    mood === 'happy' || mood === 'good'
      ? color.feedback.goodInk
      : mood === 'bad' || mood === 'sad'
        ? color.feedback.badInk
        : mood === 'warn' || mood === 'think'
          ? color.feedback.warnInk
          : color.accent.primary;

  return (
    <div
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
      }}
    >
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: color.accent.primarySoft,
          color: color.accent.primary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: font.sans,
          fontSize: size * 0.4,
          fontWeight: fontWeight.semibold,
          letterSpacing: '-0.01em',
          position: 'relative',
          flexShrink: 0,
        }}
      >
        T
        <span
          aria-hidden
          style={{
            position: 'absolute',
            bottom: 1,
            right: 1,
            width: Math.max(8, size * 0.22),
            height: Math.max(8, size * 0.22),
            borderRadius: '50%',
            background: moodColor,
            border: `2px solid ${color.bg.surface}`,
            animation: talking ? 'mn-pulse 1.4s ease-in-out infinite' : undefined,
          }}
        />
      </div>
      {label && (
        <div
          style={{
            fontFamily: font.sans,
            fontSize: fontSize.tiny,
            fontWeight: fontWeight.medium,
            color: color.ink.secondary,
            textAlign: 'center',
            maxWidth: size + 24,
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────── Button (was SketchBtn) ─────────────────────── */

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  active?: boolean;
  small?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
  style?: CSSProperties;
  disabled?: boolean;
  title?: string;
  ariaLabel?: string;
  ariaPressed?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

export function SketchBtn({
  children,
  onClick,
  active,
  small,
  variant = 'secondary',
  style,
  disabled,
  title,
  ariaLabel,
  ariaPressed,
  type = 'button',
}: ButtonProps) {
  const [hover, setHover] = useState(false);

  const palettes = {
    primary: {
      bg: hover && !disabled ? color.accent.primaryHover : color.accent.primary,
      ink: color.ink.onAccent,
      border: 'transparent',
    },
    secondary: {
      bg: active
        ? color.accent.primarySoft
        : hover && !disabled
          ? color.bg.muted
          : color.bg.surface,
      ink: active ? color.accent.primaryInk : color.ink.primary,
      border: active ? color.accent.primaryEdge : color.border.default,
    },
    ghost: {
      bg: hover && !disabled ? color.bg.muted : 'transparent',
      ink: color.ink.secondary,
      border: 'transparent',
    },
  } as const;
  const p = palettes[variant];

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel ?? title}
      aria-pressed={ariaPressed}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: p.bg,
        border: `1px solid ${p.border}`,
        borderRadius: radius.md,
        padding: small ? `${space[3]}px ${space[5]}px` : `${space[4]}px ${space[6]}px`,
        minHeight: small ? 30 : 38,
        fontFamily: font.sans,
        fontSize: small ? fontSize.small : fontSize.body,
        fontWeight: fontWeight.medium,
        color: p.ink,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        whiteSpace: 'nowrap',
        lineHeight: 1.2,
        transition: `background ${motionTokens.fast}, border-color ${motionTokens.fast}, color ${motionTokens.fast}`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export const Button = SketchBtn;

/* ─────────────────────── ChatBubble ─────────────────────── */

interface ChatBubbleProps {
  who: 'tutor' | 'you';
  text: string;
  small?: boolean;
  mood?: Mood;
  showAuthor?: boolean;
}

export function ChatBubble({
  who,
  text,
  small,
  mood,
  showAuthor = true,
}: ChatBubbleProps) {
  const isYou = who === 'you';

  if (isYou) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
        }}
      >
        <div
          style={{
            maxWidth: '78%',
            background: color.accent.primary,
            color: color.ink.onAccent,
            padding: small ? `${space[4]}px ${space[5]}px` : `${space[5]}px ${space[6]}px`,
            borderRadius: 14,
            borderTopRightRadius: 4,
            fontFamily: font.sans,
            fontSize: small ? fontSize.body : fontSize.bodyLg,
            fontWeight: fontWeight.regular,
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            boxShadow: shadow.xs,
          }}
        >
          {text}
        </div>
      </div>
    );
  }

  const moodAccent =
    mood === 'good'
      ? color.feedback.goodInk
      : mood === 'bad'
        ? color.feedback.badInk
        : mood === 'warn'
          ? color.feedback.warnInk
          : color.ink.muted;

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'flex-start',
      }}
    >
      <div style={{ maxWidth: '88%' }}>
        {showAuthor && (
          <div
            style={{
              fontFamily: font.sans,
              fontSize: fontSize.micro,
              fontWeight: fontWeight.semibold,
              color: moodAccent,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: space[2],
            }}
          >
            tutor
          </div>
        )}
        <div
          style={{
            background: color.bg.surface,
            border: `1px solid ${color.border.default}`,
            borderRadius: 14,
            borderTopLeftRadius: 4,
            padding: small ? `${space[4]}px ${space[5]}px` : `${space[5]}px ${space[6]}px`,
            fontFamily: font.sans,
            fontSize: small ? fontSize.body : fontSize.bodyLg,
            lineHeight: 1.55,
            color: color.ink.primary,
            whiteSpace: 'pre-wrap',
            boxShadow: shadow.xs,
          }}
        >
          {text}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────── FeedbackRibbon ─────────────────────── */

interface FeedbackRibbonProps {
  text: string;
  mood?: Mood;
  style?: CSSProperties;
}

export function FeedbackRibbon({
  text,
  mood = 'good',
  style,
}: FeedbackRibbonProps) {
  const palette =
    mood === 'good' || mood === 'happy'
      ? { bg: color.feedback.goodBg, ink: color.feedback.goodInk, edge: color.feedback.goodEdge }
      : mood === 'warn' || mood === 'think'
        ? { bg: color.feedback.warnBg, ink: color.feedback.warnInk, edge: color.feedback.warnEdge }
        : mood === 'bad' || mood === 'sad'
          ? { bg: color.feedback.badBg, ink: color.feedback.badInk, edge: color.feedback.badEdge }
          : { bg: color.bg.muted, ink: color.ink.muted, edge: color.border.default };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: palette.bg,
        border: `1px solid ${palette.edge}`,
        color: palette.ink,
        padding: `${space[2]}px ${space[5]}px`,
        borderRadius: radius.pill,
        fontFamily: font.sans,
        fontSize: fontSize.tiny,
        fontWeight: fontWeight.medium,
        lineHeight: 1.4,
        ...style,
      }}
    >
      {text}
    </span>
  );
}
