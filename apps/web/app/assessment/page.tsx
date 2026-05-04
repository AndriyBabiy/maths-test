'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AssessmentReport } from '@/app/api/assessment/types';
import { ChatPane } from './_components/ChatPane';
import { ContentsSidebar } from './_components/ContentsSidebar';
import { StudyPlanWizard } from './_components/study-plan/StudyPlanWizard';
import {
  ChartGlyph,
  ClockGlyph,
  FlameGlyph,
  ResetGlyph,
} from './_components/glyphs';
import type { PaperKind } from './_components/PenCanvas';
import { Button, SketchBox } from './_components/primitives';
import { WorkingsPane } from './_components/WorkingsPane';
import { assessAndAdapt } from './_engine/adapt';
import { apiStart, publicItemToQuestion } from './_engine/api-client';
import { buildInitialState } from './_engine/content';
import { getProgressiveHint, type HintLevels } from './_engine/hints';
import {
  color,
  font,
  fontSize,
  fontWeight,
  radius,
  shadow,
  space,
} from './_engine/tokens';
import type {
  ChatMessage,
  Mood,
  Question,
  Stroke,
} from './_engine/types';

const INTRO_CHAT: ChatMessage[] = [
  {
    who: 'tutor',
    text: "Welcome! I'm going to figure out where you sit in the Project Maths curriculum.",
  },
  {
    who: 'tutor',
    text: "I'll pick each question based on how the last one went — work it out on the right pad, then tap A/B/C/D when you're ready.",
  },
];

function isHintRequest(text: string): boolean {
  const t = text.toLowerCase();
  return t.includes('hint') || t.includes('stuck') || t.includes('help');
}

function stockReply(userText: string, activeQ: Question | null): string {
  const t = userText.toLowerCase();
  if (t.includes('explain') && activeQ) {
    return `For "${activeQ.prompt}" — read each option carefully and rule out the obviously wrong ones first.`;
  }
  return "Got it. Take your time on the scratchpad and pick a choice when you're ready.";
}

function newSessionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Returns true when the viewport is below the given breakpoint (px). SSR-safe. */
function useBelowBreakpoint(px: number): boolean {
  const [below, setBelow] = useState(false);
  useEffect(() => {
    function update() {
      setBelow(window.innerWidth < px);
    }
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [px]);
  return below;
}

function useRouteAttr(route: string) {
  useEffect(() => {
    document.body.dataset.route = route;
    return () => {
      delete document.body.dataset.route;
    };
  }, [route]);
}

/** mm:ss elapsed since the assessment started. */
function useSessionTimer(startMs: number | null): string {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (startMs === null) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [startMs]);
  if (startMs === null) return '0:00';
  const elapsed = Math.floor((Date.now() - startMs) / 1000);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function AssessmentPage() {
  useRouteAttr('assessment');
  const isMobile = useBelowBreakpoint(1024);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [sessionId, setSessionId] = useState<string>(() => newSessionId());
  const [items, setItems] = useState<Question[]>(() => buildInitialState());
  const [activeId, setActiveId] = useState<string>('');
  const [chat, setChat] = useState<ChatMessage[]>(INTRO_CHAT);
  const [ribbon, setRibbon] = useState<{ text: string; mood: Mood } | null>({
    text: 'starting up…',
    mood: 'warn',
  });
  const [tutorMood, setTutorMood] = useState<Mood>('think');
  const [paper, setPaper] = useState<PaperKind>('grid');
  const [penColor, setPenColor] = useState<string>(color.pen.black);
  const [showCelebration, setShowCelebration] = useState<{
    text: string;
    mood: Mood;
  } | null>(null);
  const [streak, setStreak] = useState(0);
  const [pending, setPending] = useState(true);
  const [report, setReport] = useState<AssessmentReport | null>(null);
  const [studyPlanOpen, setStudyPlanOpen] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [hintLevels, setHintLevels] = useState<HintLevels>({});

  /** When the active question was last shown — used to compute latency on submit. */
  const questionShownAt = useRef<number>(0);

  const timer = useSessionTimer(startedAt);

  const activeQ = useMemo<Question | null>(
    () => items.find((q) => q.id === activeId) ?? null,
    [items, activeId],
  );
  const visibleItems = useMemo(
    () => items.filter((q) => q.state !== 'locked'),
    [items],
  );
  const qIndex = activeQ
    ? Math.max(0, visibleItems.findIndex((q) => q.id === activeQ.id))
    : 0;

  const sessionStats = useMemo(
    () => ({
      done: items.filter((q) => q.state === 'done').length,
      total: items.filter((q) => q.state !== 'locked').length,
      correct: items.filter((q) => q.correct === true).length,
    }),
    [items],
  );

  const setStrokes = useCallback(
    (next: Stroke[]) => {
      if (!activeQ) return;
      setItems((prev) =>
        prev.map((q) => (q.id === activeQ.id ? { ...q, strokes: next } : q)),
      );
    },
    [activeQ],
  );

  /** Reset latency stopwatch whenever the active question changes. */
  useEffect(() => {
    if (activeId) questionShownAt.current = Date.now();
  }, [activeId]);

  const startAssessment = useCallback(async (sid: string) => {
    setPending(true);
    setRibbon({ text: 'starting up…', mood: 'warn' });
    setTutorMood('think');
    const response = await apiStart(sid);
    if (response.kind === 'error') {
      setChat((c) => [
        ...c,
        {
          who: 'tutor',
          text: "I can't reach the tutor right now. Please try Reset in a moment.",
          mood: 'bad',
        },
      ]);
      setRibbon({ text: 'agent unavailable', mood: 'bad' });
      setTutorMood('sad');
      setPending(false);
      return;
    }
    if (response.kind !== 'next_item') {
      setChat((c) => [
        ...c,
        {
          who: 'tutor',
          text: "Got an unexpected response from the agent — expected a question, didn't get one.",
          mood: 'warn',
        },
      ]);
      setPending(false);
      return;
    }
    const firstQ = publicItemToQuestion(response.item, 'now');
    setItems([firstQ]);
    setActiveId(firstQ.id);
    setStartedAt(Date.now());
    setChat((c) => [
      ...c,
      {
        who: 'tutor',
        text: response.progress.commentary || "Let's start with this one.",
      },
    ]);
    setRibbon({ text: 'pick A/B/C/D when ready', mood: 'warn' });
    setTutorMood('think');
    setPending(false);
  }, []);

  // Boot the session once on mount.
  useEffect(() => {
    void startAssessment(sessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function pickQuestion(id: string) {
    setActiveId(id);
    const q = items.find((x) => x.id === id);
    if (q && q.state !== 'done') {
      setRibbon({ text: 'pick A/B/C/D when ready', mood: 'warn' });
    } else {
      setRibbon({ text: 'reviewing previous question', mood: 'warn' });
    }
    setTutorMood('think');
  }

  async function handleSubmit(chosenIndex: 0 | 1 | 2 | 3) {
    if (!activeQ || pending) return;
    setPending(true);
    const latencyMs = Math.max(0, Date.now() - questionShownAt.current);
    const result = await assessAndAdapt(items, activeQ.id, chosenIndex, {
      sessionId,
      latencyMs,
    });

    setItems(result.items);
    setRibbon({ text: result.ribbon, mood: result.mood });
    setTutorMood(
      result.correct === true
        ? 'happy'
        : result.correct === false
          ? 'sad'
          : 'think',
    );
    if (result.correct === true) setStreak((s) => s + 1);
    else if (result.correct === false) setStreak(0);

    const chosenText =
      activeQ.choices?.[chosenIndex] ?? `(choice ${chosenIndex + 1})`;
    setChat((c) => [
      ...c,
      { who: 'you', text: chosenText },
      { who: 'tutor', text: result.message, mood: result.mood },
    ]);

    if (result.correct !== null) {
      setShowCelebration(
        result.correct
          ? { text: 'Correct', mood: 'good' }
          : { text: 'Not quite', mood: 'bad' },
      );
      window.setTimeout(() => setShowCelebration(null), 1100);
    }

    if (result.report) {
      setReport(result.report);
      setRibbon({ text: 'assessment complete', mood: 'good' });
      setTutorMood('happy');
    } else if (result.advanceTo && result.advanceTo !== activeQ.id) {
      setActiveId(result.advanceTo);
    }

    setPending(false);
  }

  function handleChatSend(text: string) {
    let reply: string;
    if (activeQ && isHintRequest(text)) {
      const nextLevel = (hintLevels[activeQ.id] ?? 0) + 1;
      setHintLevels((prev) => ({ ...prev, [activeQ.id]: nextLevel }));
      reply = getProgressiveHint(activeQ, nextLevel, activeQ.hint);
    } else {
      reply = stockReply(text, activeQ);
    }
    setChat((c) => [
      ...c,
      { who: 'you', text },
      { who: 'tutor', text: reply },
    ]);
  }

  function reset() {
    const sid = newSessionId();
    setSessionId(sid);
    setItems(buildInitialState());
    setActiveId('');
    setChat(INTRO_CHAT);
    setRibbon({ text: 'starting up…', mood: 'warn' });
    setTutorMood('think');
    setStreak(0);
    setReport(null);
    setStartedAt(null);
    setHintLevels({});
    void startAssessment(sid);
  }

  return (
    <div className="mn-stage-shell">
      <div
        className="mn-stage"
        style={{
          fontFamily: font.sans,
          color: color.ink.primary,
        }}
      >
        {/* Top bar */}
        <div className="mn-topbar">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: space[5],
              minWidth: 0,
              flex: '0 1 auto',
              overflow: 'hidden',
            }}
          >
            {isMobile && (
              <button
                type="button"
                onClick={() => setSidebarOpen((s) => !s)}
                aria-label="Toggle contents drawer"
                aria-expanded={sidebarOpen}
                className="mn-drawer-toggle"
                style={{ padding: `${space[3]}px ${space[5]}px` }}
              >
                <span aria-hidden style={{ fontSize: 16, lineHeight: 1 }}>
                  ☰
                </span>
                <span>Contents</span>
              </button>
            )}
            <div
              aria-hidden
              style={{
                width: 28,
                height: 28,
                borderRadius: radius.md,
                background: color.accent.primary,
                color: color.ink.onAccent,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: font.sans,
                fontSize: fontSize.body,
                fontWeight: fontWeight.bold,
                letterSpacing: '-0.02em',
                flexShrink: 0,
              }}
            >
              M
            </div>
            <span
              style={{
                fontFamily: font.sans,
                fontSize: fontSize.h4,
                fontWeight: fontWeight.semibold,
                letterSpacing: '-0.01em',
                whiteSpace: 'nowrap',
                lineHeight: 1.2,
              }}
            >
              Math Notebook
            </span>
            <span className="mn-topbar-tagline">
              <span
                aria-hidden
                style={{
                  width: 1,
                  height: 16,
                  background: color.border.default,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontFamily: font.sans,
                  fontSize: fontSize.tiny,
                  color: color.ink.muted,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                Adaptive diagnostic · powered by an in-process LangGraph agent
              </span>
            </span>
          </div>
          <div className="mn-topbar-stats">
            <Stat
              icon={<ClockGlyph size={14} ink={color.ink.soft} />}
              label="time"
              value={timer}
            />
            <Stat
              icon={<ChartGlyph size={14} ink={color.ink.soft} />}
              label="correct"
              value={String(sessionStats.correct)}
            />
            <Stat
              icon={<FlameGlyph size={14} ink={color.ink.soft} />}
              label="streak"
              value={String(streak)}
            />
            <Button
              small
              variant="secondary"
              onClick={reset}
              ariaLabel="Reset assessment"
            >
              <ResetGlyph size={13} ink="currentColor" /> Reset
            </Button>
          </div>
        </div>

        {/* Main spread — responsive grid (1 / 2 / 3 column based on viewport) */}
        <div className="mn-stage-grid">
          {/* Sidebar — toggleable drawer below lg, always visible at lg+ */}
          <div
            className="mn-pane-sidebar"
            data-hidden-mobile={isMobile && !sidebarOpen ? 'true' : 'false'}
          >
            <ContentsSidebar
              items={items}
              activeId={activeQ?.id ?? ''}
              onPick={(id) => {
                pickQuestion(id);
                if (isMobile) setSidebarOpen(false);
              }}
              sessionStats={sessionStats}
            />
          </div>

          {/* Chat pane */}
          <div className="mn-pane-chat">
            <ChatPane
              chat={chat}
              qIndex={qIndex}
              total={visibleItems.length}
              tutorMood={tutorMood}
              onSend={handleChatSend}
            />
          </div>

          {/* Workings pane */}
          <div className="mn-pane-workings">
            {activeQ ? (
              <WorkingsPane
                activeQ={activeQ}
                qIndex={qIndex}
                strokes={activeQ.strokes ?? []}
                setStrokes={setStrokes}
                ribbon={ribbon}
                tutorMood={tutorMood}
                onSubmit={handleSubmit}
                paper={paper}
                setPaper={setPaper}
                penColor={penColor}
                setPenColor={setPenColor}
                pending={pending}
              />
            ) : (
              <WorkingsPlaceholder pending={pending} ribbon={ribbon} />
            )}
          </div>

          {/* Celebration overlay */}
          {showCelebration && (
            <div
              role="status"
              aria-live="polite"
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
                zIndex: 10,
              }}
            >
              <div
                style={{
                  fontFamily: font.sans,
                  fontSize: fontSize.h1,
                  fontWeight: fontWeight.bold,
                  letterSpacing: '-0.02em',
                  padding: `${space[5]}px ${space[8]}px`,
                  borderRadius: radius.pill,
                  background:
                    showCelebration.mood === 'good'
                      ? color.feedback.goodBg
                      : color.feedback.badBg,
                  color:
                    showCelebration.mood === 'good'
                      ? color.feedback.goodInk
                      : color.feedback.badInk,
                  border: `1px solid ${
                    showCelebration.mood === 'good'
                      ? color.feedback.goodEdge
                      : color.feedback.badEdge
                  }`,
                  boxShadow: shadow.lg,
                  animation: 'mn-pop 1.1s cubic-bezier(0.4, 0, 0.2, 1) forwards',
                }}
              >
                {showCelebration.text}
              </div>
            </div>
          )}

          {/* Report overlay */}
          {report && !studyPlanOpen && (
            <ReportOverlay
              report={report}
              onClose={() => setReport(null)}
              onReset={reset}
              onCreatePlan={() => setStudyPlanOpen(true)}
            />
          )}
          {report && studyPlanOpen && (
            <StudyPlanWizard
              report={report}
              onClose={() => setStudyPlanOpen(false)}
            />
          )}
        </div>

        {/* Footer */}
        <div className="mn-footer">
          <span>
            session {sessionId.slice(0, 8)} · {sessionStats.done} answered ·{' '}
            {pending ? 'agent thinking…' : 'your turn'}
          </span>
          <span>Stylus + mouse · pressure-aware canvas</span>
        </div>
      </div>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <span
      title={label}
      aria-label={`${label} ${value}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: space[3],
        whiteSpace: 'nowrap',
        fontFamily: font.sans,
        fontSize: fontSize.body,
      }}
    >
      {icon}
      <span style={{ fontWeight: fontWeight.semibold, color: color.ink.primary }}>
        {value}
      </span>
      <span
        style={{
          color: color.ink.faint,
          fontSize: fontSize.tiny,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          fontWeight: fontWeight.medium,
        }}
      >
        {label}
      </span>
    </span>
  );
}

function WorkingsPlaceholder({
  pending,
  ribbon,
}: {
  pending: boolean;
  ribbon: { text: string; mood: Mood } | null;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: space[10],
        fontFamily: font.sans,
        background: color.bg.surface,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: space[5],
          textAlign: 'center',
          padding: `${space[10]}px ${space[12]}px`,
          background: color.bg.surface,
          border: `1px solid ${color.border.default}`,
          borderRadius: radius.xl,
          boxShadow: shadow.xs,
          maxWidth: 440,
        }}
      >
        {pending && (
          <div
            aria-hidden
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              border: `2px solid ${color.accent.primarySoft}`,
              borderTopColor: color.accent.primary,
              animation: 'mn-spin 0.9s linear infinite',
            }}
          />
        )}
        <div
          style={{
            fontSize: fontSize.h3,
            fontWeight: fontWeight.semibold,
            color: color.ink.primary,
            letterSpacing: '-0.01em',
          }}
        >
          {pending ? 'Starting your assessment' : 'No question loaded'}
        </div>
        <div
          style={{
            fontSize: fontSize.body,
            color: color.ink.muted,
            lineHeight: 1.5,
          }}
        >
          {ribbon?.text === 'starting up…'
            ? 'The tutor agent is picking your first question — this usually takes a couple of seconds.'
            : (ribbon?.text ?? 'The agent is preparing your first question.')}
        </div>
      </div>
    </div>
  );
}

function ReportOverlay({
  report,
  onClose,
  onReset,
  onCreatePlan,
}: {
  report: AssessmentReport;
  onClose: () => void;
  onReset: () => void;
  onCreatePlan: () => void;
}) {
  const strands = Object.entries(report.strands);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mn-report-title"
      style={{
        position: 'absolute',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 20,
        padding: space[8],
      }}
    >
      <SketchBox
        fill={color.bg.surface}
        pad={space[10]}
        elevation="lg"
        radius={radius.xl}
        style={{
          maxWidth: 720,
          width: '100%',
          maxHeight: '90%',
          overflowY: 'auto',
          fontFamily: font.sans,
          color: color.ink.primary,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: space[6],
            marginBottom: space[7],
            flexWrap: 'wrap',
          }}
        >
          <span
            id="mn-report-title"
            style={{
              fontSize: fontSize.h2,
              fontWeight: fontWeight.semibold,
              letterSpacing: '-0.02em',
            }}
          >
            Your report
          </span>
          <span
            style={{
              fontSize: fontSize.small,
              color: color.ink.muted,
              fontWeight: fontWeight.medium,
            }}
          >
            Stage{' '}
            <strong style={{ color: color.ink.primary }}>
              {report.stage.replace('_', ' ')}
            </strong>{' '}
            · Tier{' '}
            <strong style={{ color: color.accent.primary }}>
              {report.overallTier}
            </strong>
          </span>
        </div>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: fontSize.body,
          }}
        >
          <thead>
            <tr
              style={{
                borderBottom: `1px solid ${color.border.default}`,
                textAlign: 'left',
              }}
            >
              <th style={headCell}>Strand</th>
              <th style={headCell}>Tier</th>
              <th style={headCell}>θ</th>
              <th style={headCell}>Confidence</th>
            </tr>
          </thead>
          <tbody>
            {strands.map(([name, s]) => (
              <tr
                key={name}
                style={{
                  borderBottom: `1px solid ${color.border.subtle}`,
                }}
              >
                <td style={cell}>{name.replace('_', ' ')}</td>
                <td style={cell}>{s.tier}</td>
                <td style={cell}>{s.theta.toFixed(2)}</td>
                <td style={cell}>{(s.confidence * 100).toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        {report.strengths.length > 0 && (
          <div style={summaryRow}>
            <span style={summaryLabel}>Strengths</span>
            <span>{report.strengths.join(', ')}</span>
          </div>
        )}
        {report.gaps.length > 0 && (
          <div style={summaryRow}>
            <span style={summaryLabel}>Gaps</span>
            <span>{report.gaps.join(', ')}</span>
          </div>
        )}
        {report.nextSteps && (
          <div style={summaryRow}>
            <span style={summaryLabel}>Next steps</span>
            <span>{report.nextSteps}</span>
          </div>
        )}
        <div
          style={{
            display: 'flex',
            gap: space[4],
            marginTop: space[8],
            justifyContent: 'flex-end',
          }}
        >
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button variant="secondary" onClick={onReset}>
            <ResetGlyph size={14} ink="currentColor" /> New session
          </Button>
          <Button variant="primary" onClick={onCreatePlan}>
            Create a study plan
          </Button>
        </div>
      </SketchBox>
    </div>
  );
}

const headCell: React.CSSProperties = {
  padding: `${space[4]}px ${space[5]}px`,
  fontSize: fontSize.tiny,
  fontWeight: fontWeight.semibold,
  color: color.ink.soft,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
};

const cell: React.CSSProperties = {
  padding: `${space[5]}px ${space[5]}px`,
  fontSize: fontSize.body,
  color: color.ink.primary,
};

const summaryRow: React.CSSProperties = {
  marginTop: space[6],
  display: 'flex',
  gap: space[5],
  fontSize: fontSize.body,
  color: color.ink.secondary,
  lineHeight: 1.5,
};

const summaryLabel: React.CSSProperties = {
  fontSize: fontSize.tiny,
  fontWeight: fontWeight.semibold,
  color: color.ink.soft,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  flexShrink: 0,
  minWidth: 100,
};
