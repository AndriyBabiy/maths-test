'use client';

import { useState } from 'react';
import { groupBySection } from '../_engine/adapt';
import {
  color,
  font,
  fontSize,
  fontWeight,
  radius,
  space,
} from '../_engine/tokens';
import type { Question, SessionStats } from '../_engine/types';
import {
  ChevronDownGlyph,
  ChevronRightGlyph,
  CircleDotGlyph,
  CircleGlyph,
  CrossGlyph,
  LockGlyph,
  NotebookGlyph,
  TickGlyph,
} from './glyphs';

interface ContentsSidebarProps {
  items: Question[];
  activeId: string;
  onPick: (id: string) => void;
  sessionStats: SessionStats;
  /**
   * Rendering mode controlled by the parent based on viewport:
   *   'full'   — desktop ≥1280: full panel (default)
   *   'drawer' — off-canvas drawer at <1280: same content as full
   *   'rail'   — 1024–1279: 48px icon rail showing per-strand status dots.
   *              Each icon click calls `onOpenDrawer` to expand into the drawer.
   */
  mode?: 'rail' | 'drawer' | 'full';
  /** Only used when `mode === 'rail'`. Opens the off-canvas drawer. */
  onOpenDrawer?: () => void;
}

type PillTone = 'done' | 'now' | 'next' | 'locked';

function pillStyle(tone: PillTone) {
  switch (tone) {
    case 'done':
      return {
        background: color.feedback.goodBg,
        color: color.feedback.goodInk,
        border: `1px solid ${color.feedback.goodEdge}`,
      };
    case 'now':
      return {
        background: color.accent.primarySoft,
        color: color.accent.primary,
        border: `1px solid ${color.accent.primaryEdge}`,
      };
    case 'next':
      return {
        background: 'transparent',
        color: color.ink.muted,
        border: `1px solid ${color.border.default}`,
      };
    case 'locked':
      return {
        background: 'transparent',
        color: color.ink.faint,
        border: `1px dashed ${color.border.default}`,
      };
  }
}

function previewText(s: string): string {
  return s
    .replace(/\$([^$]+)\$/g, '$1')
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1/$2')
    .replace(/\\sqrt\{([^}]+)\}/g, '√$1')
    .replace(/\\,/g, ' ')
    .replace(/\\text\{([^}]+)\}/g, '$1')
    .replace(/\^\\circ/g, '°')
    .replace(/\\times/g, '×');
}

export function ContentsSidebar({
  items,
  activeId,
  onPick,
  sessionStats,
  mode = 'full',
  onOpenDrawer,
}: ContentsSidebarProps) {
  const sections = groupBySection(items);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [hoverHeader, setHoverHeader] = useState<string | null>(null);

  const progress =
    sessionStats.total > 0
      ? Math.min(100, (100 * sessionStats.done) / sessionStats.total)
      : 0;

  // Rail mode: 48px-wide icon column. Each icon click opens the drawer
  // (the full sidebar). The rail's job is "see strand status at a glance".
  if (mode === 'rail') {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: space[3],
          padding: `${space[4]}px ${space[2]}px`,
          height: '100%',
          background: color.bg.sidebar,
        }}
      >
        <button
          type="button"
          onClick={onOpenDrawer}
          aria-label="Open contents drawer"
          title="Contents"
          style={railIconStyle(false)}
        >
          <NotebookGlyph size={18} ink={color.ink.secondary} />
        </button>
        <div
          aria-hidden
          style={{
            width: 24,
            height: 1,
            background: color.border.subtle,
            margin: `${space[1]}px 0`,
          }}
        />
        {sections.map((sec) => {
          let StatusIcon: React.ReactNode;
          if (sec.state === 'done') {
            StatusIcon = (
              <TickGlyph size={14} ink={color.feedback.goodInk} />
            );
          } else if (sec.state === 'now') {
            StatusIcon = (
              <CircleDotGlyph size={14} ink={color.accent.primary} />
            );
          } else if (sec.state === 'locked') {
            StatusIcon = <LockGlyph size={14} ink={color.ink.faint} />;
          } else {
            StatusIcon = <CircleGlyph size={14} ink={color.ink.soft} />;
          }
          return (
            <button
              key={sec.id}
              type="button"
              onClick={onOpenDrawer}
              aria-label={`${sec.title} — ${sec.state}. Open drawer.`}
              title={sec.title}
              style={railIconStyle(sec.state === 'now')}
            >
              {StatusIcon}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        background: color.bg.sidebar,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: `${space[6]}px ${space[6]}px ${space[5]}px ${space[6]}px`,
          borderBottom: `1px solid ${color.border.subtle}`,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: space[3],
          }}
        >
          <NotebookGlyph size={18} ink={color.ink.secondary} />
          <span
            style={{
              fontFamily: font.sans,
              fontSize: fontSize.h4,
              fontWeight: fontWeight.semibold,
              color: color.ink.primary,
              letterSpacing: '-0.01em',
            }}
          >
            Contents
          </span>
        </div>
        <div
          style={{
            fontFamily: font.sans,
            fontSize: fontSize.tiny,
            fontWeight: fontWeight.regular,
            color: color.ink.muted,
            marginTop: space[2],
          }}
        >
          {sessionStats.done} of {sessionStats.total} answered
        </div>
        <div
          style={{
            marginTop: space[4],
            height: 4,
            width: '100%',
            background: color.border.subtle,
            borderRadius: radius.pill,
            overflow: 'hidden',
            position: 'relative',
          }}
          role="progressbar"
          aria-valuenow={sessionStats.done}
          aria-valuemin={0}
          aria-valuemax={sessionStats.total}
        >
          <div
            style={{
              height: '100%',
              width: `${progress}%`,
              background: color.accent.primary,
              borderRadius: radius.pill,
              transition: 'width 320ms cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        </div>
      </div>

      {/* Topic-pill row */}
      <div
        style={{
          padding: `${space[4]}px ${space[6]}px`,
          borderBottom: `1px solid ${color.border.subtle}`,
          display: 'flex',
          flexWrap: 'wrap',
          gap: space[2],
        }}
      >
        {sections.map((s) => {
          const tone: PillTone = s.state as PillTone;
          const styles = pillStyle(tone);
          return (
            <span
              key={s.id}
              title={s.summary}
              style={{
                fontFamily: font.sans,
                fontSize: fontSize.tiny,
                fontWeight: fontWeight.medium,
                padding: '2px 10px',
                borderRadius: radius.pill,
                whiteSpace: 'nowrap',
                lineHeight: 1.4,
                ...styles,
              }}
            >
              {s.title}
            </span>
          );
        })}
      </div>

      {/* Question list */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          minHeight: 0,
          padding: `${space[4]}px ${space[3]}px ${space[6]}px ${space[3]}px`,
        }}
      >
        {sections.length === 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: space[3],
              padding: space[5],
            }}
          >
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                aria-hidden
                style={{
                  height: 28,
                  borderRadius: radius.md,
                  background: color.bg.muted,
                  opacity: 0.6 - i * 0.1,
                }}
              />
            ))}
            <div
              style={{
                marginTop: space[3],
                fontSize: fontSize.tiny,
                color: color.ink.faint,
                textAlign: 'center',
                lineHeight: 1.5,
              }}
            >
              Questions appear here as
              <br />
              the agent picks them.
            </div>
          </div>
        )}
        {sections.map((sec) => {
          const isCollapsed = !!collapsed[sec.id];
          const doneCount = sec.questions.filter(
            (q) => q.state === 'done',
          ).length;

          let SectionStatus: React.ReactNode;
          if (sec.state === 'done') {
            SectionStatus = (
              <TickGlyph size={14} ink={color.feedback.goodInk} />
            );
          } else if (sec.state === 'now') {
            SectionStatus = (
              <CircleDotGlyph size={14} ink={color.accent.primary} />
            );
          } else if (sec.state === 'locked') {
            SectionStatus = <LockGlyph size={14} ink={color.ink.faint} />;
          } else {
            SectionStatus = <CircleGlyph size={14} ink={color.ink.soft} />;
          }

          const headerHovered = hoverHeader === sec.id;

          return (
            <div key={sec.id} style={{ marginBottom: space[3] }}>
              <button
                type="button"
                onClick={() =>
                  setCollapsed((c) => ({ ...c, [sec.id]: !isCollapsed }))
                }
                onMouseEnter={() => setHoverHeader(sec.id)}
                onMouseLeave={() => setHoverHeader(null)}
                aria-expanded={!isCollapsed}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: space[3],
                  width: '100%',
                  background: headerHovered ? color.bg.muted : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: `${space[3]}px ${space[4]}px`,
                  textAlign: 'left',
                  borderRadius: radius.md,
                  color: color.ink.primary,
                  transition: 'background 160ms cubic-bezier(0.4, 0, 0.2, 1)',
                  fontFamily: font.sans,
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 14,
                    color: color.ink.soft,
                    flexShrink: 0,
                  }}
                >
                  {isCollapsed ? (
                    <ChevronRightGlyph size={14} ink={color.ink.soft} />
                  ) : (
                    <ChevronDownGlyph size={14} ink={color.ink.soft} />
                  )}
                </span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 14,
                    flexShrink: 0,
                  }}
                >
                  {SectionStatus}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: font.sans,
                      fontSize: fontSize.body,
                      fontWeight: fontWeight.semibold,
                      color: color.ink.primary,
                      lineHeight: 1.25,
                      letterSpacing: '-0.005em',
                    }}
                  >
                    {sec.title}
                  </div>
                  <div
                    style={{
                      fontFamily: font.sans,
                      fontSize: fontSize.tiny,
                      fontWeight: fontWeight.regular,
                      color: color.ink.muted,
                      marginTop: 1,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {sec.summary}
                  </div>
                </div>
                <span
                  style={{
                    fontFamily: font.sans,
                    fontSize: fontSize.tiny,
                    fontWeight: fontWeight.medium,
                    color: color.ink.muted,
                    flexShrink: 0,
                  }}
                >
                  {doneCount}/{sec.questions.length}
                </span>
              </button>

              {!isCollapsed && (
                <div
                  style={{
                    paddingLeft: space[8],
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                    marginTop: space[1],
                  }}
                >
                  {sec.questions.map((q) => {
                    const active = q.id === activeId;
                    const locked = q.state === 'locked';
                    const clickable = !locked;
                    const hovered = hoverId === q.id;

                    let QuestionIcon: React.ReactNode;
                    if (q.state === 'done') {
                      QuestionIcon = q.correct ? (
                        <TickGlyph size={14} ink={color.feedback.goodInk} />
                      ) : (
                        <CrossGlyph size={14} ink={color.feedback.badInk} />
                      );
                    } else if (q.state === 'now') {
                      QuestionIcon = (
                        <CircleDotGlyph
                          size={14}
                          ink={color.accent.primary}
                        />
                      );
                    } else if (q.state === 'locked') {
                      QuestionIcon = (
                        <LockGlyph size={14} ink={color.ink.faint} />
                      );
                    } else {
                      QuestionIcon = (
                        <CircleGlyph size={14} ink={color.ink.soft} />
                      );
                    }

                    const cleanPrompt = previewText(q.prompt);
                    const promptText =
                      cleanPrompt.length > 40
                        ? `${cleanPrompt.slice(0, 40)}…`
                        : cleanPrompt;

                    let buttonBg: string = 'transparent';
                    let buttonColor: string = color.ink.secondary;
                    let buttonWeight: number = fontWeight.regular;
                    if (active) {
                      buttonBg = color.accent.primarySoft;
                      buttonColor = color.accent.primary;
                      buttonWeight = fontWeight.semibold;
                    } else if (hovered && clickable) {
                      buttonBg = color.bg.muted;
                    }

                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => clickable && onPick(q.id)}
                        onMouseEnter={() => setHoverId(q.id)}
                        onMouseLeave={() =>
                          setHoverId((cur) => (cur === q.id ? null : cur))
                        }
                        disabled={!clickable}
                        aria-current={active ? 'step' : undefined}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: space[3],
                          width: '100%',
                          textAlign: 'left',
                          background: buttonBg,
                          border: 'none',
                          padding: `${space[3]}px ${space[4]}px`,
                          borderRadius: radius.md,
                          cursor: clickable ? 'pointer' : 'not-allowed',
                          opacity: locked ? 0.5 : 1,
                          fontFamily: font.sans,
                          fontSize: fontSize.body,
                          fontWeight: buttonWeight,
                          color: buttonColor,
                          transition:
                            'background 160ms cubic-bezier(0.4, 0, 0.2, 1), color 160ms cubic-bezier(0.4, 0, 0.2, 1)',
                        }}
                      >
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 14,
                            flexShrink: 0,
                          }}
                        >
                          {QuestionIcon}
                        </span>
                        <span
                          style={{
                            flex: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {promptText}
                        </span>
                        {q.recap && (
                          <span
                            style={{
                              fontFamily: font.sans,
                              fontSize: fontSize.micro,
                              fontWeight: fontWeight.medium,
                              padding: '1px 8px',
                              borderRadius: radius.pill,
                              background: color.feedback.warnBg,
                              color: color.feedback.warnInk,
                              border: `1px solid ${color.feedback.warnEdge}`,
                              flexShrink: 0,
                            }}
                          >
                            Recap
                          </span>
                        )}
                        {q.topic && q.topic.includes('stretch') && (
                          <span
                            style={{
                              fontFamily: font.sans,
                              fontSize: fontSize.micro,
                              fontWeight: fontWeight.medium,
                              padding: '1px 8px',
                              borderRadius: radius.pill,
                              background: color.feedback.infoBg,
                              color: color.feedback.infoInk,
                              border: `1px solid ${color.feedback.infoEdge}`,
                              flexShrink: 0,
                            }}
                          >
                            Stretch
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div
        style={{
          padding: `${space[4]}px ${space[6]}px`,
          borderTop: `1px solid ${color.border.subtle}`,
          display: 'inline-flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: space[5],
        }}
      >
        <LegendItem
          glyph={<TickGlyph size={12} ink={color.feedback.goodInk} />}
          label="Correct"
        />
        <LegendItem
          glyph={<CrossGlyph size={12} ink={color.feedback.badInk} />}
          label="Incorrect"
        />
        <LegendItem
          glyph={<CircleDotGlyph size={12} ink={color.accent.primary} />}
          label="Current"
        />
        <LegendItem
          glyph={<LockGlyph size={12} ink={color.ink.faint} />}
          label="Locked"
        />
      </div>
    </div>
  );
}

function railIconStyle(active: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    minWidth: 32,
    minHeight: 32,
    borderRadius: radius.md,
    background: active ? color.accent.primarySoft : 'transparent',
    border: 'none',
    color: color.ink.primary,
    cursor: 'pointer',
    padding: 0,
    flexShrink: 0,
  };
}

function LegendItem({
  glyph,
  label,
}: {
  glyph: React.ReactNode;
  label: string;
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: space[2],
        fontFamily: font.sans,
        fontSize: fontSize.tiny,
        fontWeight: fontWeight.medium,
        color: color.ink.muted,
      }}
    >
      {glyph}
      <span>{label}</span>
    </span>
  );
}
