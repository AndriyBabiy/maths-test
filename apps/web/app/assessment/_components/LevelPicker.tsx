'use client';

import { useState } from 'react';
import type { EducationLevel } from '@/app/api/assessment/types';
import {
  color,
  font,
  fontSize,
  fontSizeFluid,
  fontWeight,
  motion as motionTokens,
  radius,
  shadow,
  space,
} from '../_engine/tokens';

interface LevelPickerProps {
  onPick: (level: EducationLevel) => void;
  disabled?: boolean;
}

interface LevelOption {
  level: EducationLevel;
  title: string;
  subtitle: string;
}

const LEVEL_OPTIONS: readonly LevelOption[] = [
  {
    level: 'foundations',
    title: 'Foundations',
    subtitle: 'Primary school maths fundamentals',
  },
  {
    level: 'junior_cert',
    title: 'Junior Certificate',
    subtitle: 'First three years of secondary school',
  },
  {
    level: 'leaving_cert',
    title: 'Leaving Certificate',
    subtitle: 'Final two years of secondary school',
  },
  {
    level: 'university',
    title: 'University',
    subtitle: 'Tertiary-level mathematics',
  },
] as const;

export function LevelPicker({ onPick, disabled = false }: LevelPickerProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: space[8],
        fontFamily: font.sans,
        background: color.bg.surface,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: space[7],
          maxWidth: 560,
          width: '100%',
        }}
      >
        <header
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: space[3],
            textAlign: 'center',
          }}
        >
          <span
            style={{
              fontSize: fontSize.micro,
              fontWeight: fontWeight.semibold,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: color.accent.primary,
            }}
          >
            Before we start
          </span>
          <h1
            style={{
              fontSize: fontSizeFluid.h2,
              fontWeight: fontWeight.semibold,
              color: color.ink.primary,
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
              margin: 0,
            }}
          >
            What&apos;s your current level?
          </h1>
          <p
            style={{
              fontSize: fontSize.body,
              color: color.ink.muted,
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            We&apos;ll match your first questions to where you are, so you can
            build confidence before tackling harder material.
          </p>
        </header>

        <div
          className="mn-choice-grid"
          role="radiogroup"
          aria-label="Select your education level"
        >
          {LEVEL_OPTIONS.map((opt) => (
            <LevelCard
              key={opt.level}
              option={opt}
              disabled={disabled}
              onClick={() => onPick(opt.level)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function LevelCard({
  option,
  disabled,
  onClick,
}: {
  option: LevelOption;
  disabled: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);

  const bg = hover && !disabled ? color.accent.primarySoft : color.bg.surface;
  const border =
    hover && !disabled ? color.accent.primaryEdge : color.border.default;

  return (
    <button
      type="button"
      role="radio"
      aria-checked={false}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      style={{
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: radius.lg,
        padding: `${space[6]}px ${space[7]}px`,
        textAlign: 'left',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        display: 'flex',
        flexDirection: 'column',
        gap: space[2],
        minHeight: 76,
        boxShadow: hover && !disabled ? shadow.sm : shadow.xs,
        transition: `background ${motionTokens.fast}, border-color ${motionTokens.fast}, box-shadow ${motionTokens.fast}`,
        fontFamily: font.sans,
      }}
    >
      <span
        style={{
          fontSize: fontSize.bodyLg,
          fontWeight: fontWeight.semibold,
          color: color.ink.primary,
          letterSpacing: '-0.01em',
          lineHeight: 1.3,
        }}
      >
        {option.title}
      </span>
      <span
        style={{
          fontSize: fontSize.small,
          fontWeight: fontWeight.regular,
          color: color.ink.muted,
          lineHeight: 1.4,
        }}
      >
        {option.subtitle}
      </span>
    </button>
  );
}
