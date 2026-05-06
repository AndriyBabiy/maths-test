'use client';

import type { CSSProperties } from 'react';
import {
  color,
  font,
  fontSize,
  fontWeight,
  motion as motionTokens,
  space,
  tap,
} from '../_engine/tokens';
import { ChatBubbleGlyph, PageGlyph, PencilGlyph } from './glyphs';

export type AssessmentTab = 'question' | 'tutor' | 'pad';

interface MobileTabsProps {
  active: AssessmentTab;
  onChange: (next: AssessmentTab) => void;
  tutorUnread?: boolean;
  padHasWork?: boolean;
}

interface TabSpec {
  id: AssessmentTab;
  label: string;
  Icon: typeof PageGlyph;
}

const TABS: readonly TabSpec[] = [
  { id: 'question', label: 'Question', Icon: PageGlyph },
  { id: 'tutor', label: 'Tutor', Icon: ChatBubbleGlyph },
  { id: 'pad', label: 'Pad', Icon: PencilGlyph },
] as const;

export function MobileTabs({
  active,
  onChange,
  tutorUnread = false,
  padHasWork = false,
}: MobileTabsProps) {
  return (
    <nav
      className="mn-tabbar"
      role="tablist"
      aria-label="Assessment view"
    >
      {TABS.map(({ id, label, Icon }) => {
        const isActive = active === id;
        const showBadge =
          (id === 'tutor' && tutorUnread && !isActive) ||
          (id === 'pad' && padHasWork && !isActive);
        return (
          <button
            key={id}
            role="tab"
            aria-selected={isActive}
            aria-label={label}
            onClick={() => onChange(id)}
            style={tabBtnStyle(isActive)}
          >
            <span style={{ position: 'relative', display: 'inline-flex' }}>
              <Icon
                size={22}
                ink={isActive ? color.accent.primary : color.ink.muted}
              />
              {showBadge && (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    top: -2,
                    right: -4,
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: color.accent.primary,
                    border: `2px solid ${color.bg.surface}`,
                  }}
                />
              )}
            </span>
            <span style={tabLabelStyle(isActive)}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function tabBtnStyle(active: boolean): CSSProperties {
  return {
    flex: 1,
    minHeight: tap.touch,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[1],
    padding: `${space[3]}px ${space[2]}px`,
    background: active ? color.accent.primarySoft : 'transparent',
    border: 'none',
    borderTop: `2px solid ${active ? color.accent.primary : 'transparent'}`,
    color: active ? color.accent.primary : color.ink.muted,
    cursor: 'pointer',
    transition: `background ${motionTokens.fast}, color ${motionTokens.fast}`,
    fontFamily: font.sans,
  };
}

function tabLabelStyle(active: boolean): CSSProperties {
  return {
    fontSize: fontSize.tiny,
    fontWeight: active ? fontWeight.semibold : fontWeight.medium,
    letterSpacing: '0.01em',
    color: active ? color.accent.primary : color.ink.muted,
  };
}
