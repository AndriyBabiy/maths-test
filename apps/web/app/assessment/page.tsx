'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AssessmentReport } from '@/app/api/assessment/types';
import { ChatPane } from './_components/ChatPane';
import { ContentsSidebar } from './_components/ContentsSidebar';
import { MobileTabs, type AssessmentTab } from './_components/MobileTabs';
import { StudyPlanWizard } from './_components/study-plan/StudyPlanWizard';
import {
  ChartGlyph,
  ClockGlyph,
  FlameGlyph,
  MenuGlyph,
  ResetGlyph,
} from './_components/glyphs';
import type { PaperKind, PenCanvasHandle } from './_components/PenCanvas';
import { Button, SketchBox } from './_components/primitives';
import { QuestionReviewCard } from './_components/QuestionReview';
import { WorkingsPane } from './_components/WorkingsPane';
import { assessAndAdapt } from './_engine/adapt';
import {
  apiStart,
  apiTutor,
  publicItemToQuestion,
} from './_engine/api-client';
import { buildInitialState } from './_engine/content';
import { getProgressiveHint, type HintLevels } from './_engine/hints';
import {
  color,
  font,
  fontSize,
  fontSizeFluid,
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
  // Two breakpoints drive the responsive shape:
  //   <768  → bottom tab bar takes over, only one pane visible at a time
  //   <1280 → sidebar lives in an off-canvas drawer behind the hamburger
  const isPhone = useBelowBreakpoint(768);
  const isBelowDesktop = useBelowBreakpoint(1280);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<AssessmentTab>('question');

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
  // Mirrors `progress.cap` from the assessment route. Default to the engine's
  // hard cap (20) so the chat header reads "Q 1 / 20" on first paint, before
  // the API has responded.
  const [totalCap, setTotalCap] = useState(20);
  // Length of `chat` last time the student opened the Tutor tab. Anything
  // beyond this is "new" and lights the badge dot on the inactive tab.
  const [tutorSeenAt, setTutorSeenAt] = useState<number>(INTRO_CHAT.length);

  /** When the active question was last shown — used to compute latency on submit. */
  const questionShownAt = useRef<number>(0);
  /**
   * Imperative handle to the scratchpad canvas. Lives on the page so chat
   * sends can grab a PNG snapshot of the current working before posting to
   * /api/tutor (the route then runs it through a lite vision interpreter).
   */
  const canvasRef = useRef<PenCanvasHandle | null>(null);

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

  // Badge-dot signals on the bottom tab bar. Only shown on the *inactive*
  // tab — once the student opens that tab, the dot clears.
  const tutorUnread =
    activeTab !== 'tutor' && chat.length > tutorSeenAt;
  const padHasWork =
    activeTab !== 'pad' && (activeQ?.strokes?.length ?? 0) > 0;

  // On phones we render only one of {question, pad} inside the workings pane
  // at a time. On larger viewports the pane shows the full layout regardless.
  const mobileFocus: 'question' | 'pad' | undefined = isPhone
    ? activeTab === 'pad'
      ? 'pad'
      : 'question'
    : undefined;

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

  // Drawer dismissal: Escape key + auto-close when the viewport grows past
  // the desktop threshold (the drawer is `display: none` at ≥1280, so leaving
  // its state as `open` would re-pop on the next shrink).
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);
  useEffect(() => {
    if (!isBelowDesktop) setDrawerOpen(false);
  }, [isBelowDesktop]);

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
    setTotalCap(response.progress.cap);
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

  function changeTab(next: AssessmentTab) {
    setActiveTab(next);
    if (next === 'tutor') setTutorSeenAt(chat.length);
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
    if (result.cap !== undefined) setTotalCap(result.cap);
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

  async function handleChatSend(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;

    // Optimistic write: append the student message + a thinking placeholder.
    // We'll replace the placeholder once the LLM responds (or fall back).
    const PLACEHOLDER = '…';
    const historyForPrompt = chat
      .slice(-10)
      .map((m) => ({ who: m.who, text: m.text }));
    const optimistic: ChatMessage[] = [
      ...chat,
      { who: 'you', text: trimmed },
      { who: 'tutor', text: PLACEHOLDER },
    ];
    const placeholderIndex = optimistic.length - 1;
    setChat(optimistic);

    // Strip internal fields; the tutor must never see correctIndex or raw
    // strokes. The PNG capture below is sent to a separate, cheap vision
    // interpreter on the server (not the main tutor), which produces a short
    // textual description that gets inlined into the main tutor's prompt.
    const question =
      activeQ && activeQ.choices
        ? {
            text: activeQ.prompt,
            choices: activeQ.choices,
            strand: activeQ.strand ?? activeQ.section,
            learningOutcome: activeQ.learningOutcome ?? '',
          }
        : null;

    const hasStrokes = (activeQ?.strokes?.length ?? 0) > 0;
    const strokesPng = hasStrokes
      ? canvasRef.current?.snapshotPng() ?? undefined
      : undefined;

    const response = await apiTutor({
      sessionId,
      question,
      history: historyForPrompt,
      message: trimmed,
      strokesPng,
    });

    let replyText: string;
    if (response.kind === 'reply') {
      replyText = response.text;
    } else if (activeQ) {
      // LLM unreachable but a question is on screen — degrade to the
      // hand-authored progressive hint library so chat keeps moving for
      // any kind of student message, not just hint-shaped ones.
      const nextLevel = (hintLevels[activeQ.id] ?? 0) + 1;
      setHintLevels((prev) => ({ ...prev, [activeQ.id]: nextLevel }));
      replyText = getProgressiveHint(activeQ, nextLevel, activeQ.hint);
    } else {
      replyText = response.message;
    }

    setChat((c) => {
      // Guard against the slot being shifted by another update (e.g. reset).
      if (c[placeholderIndex]?.text !== PLACEHOLDER) {
        return [...c, { who: 'tutor', text: replyText }];
      }
      const next = c.slice();
      next[placeholderIndex] = { who: 'tutor', text: replyText };
      return next;
    });
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
            {isBelowDesktop && (
              <button
                type="button"
                onClick={() => setDrawerOpen((o) => !o)}
                aria-label="Open contents drawer"
                aria-expanded={drawerOpen}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 44,
                  minHeight: 44,
                  borderRadius: radius.md,
                  background: 'transparent',
                  border: `1px solid ${color.border.default}`,
                  color: color.ink.primary,
                  cursor: 'pointer',
                  flexShrink: 0,
                  padding: 0,
                }}
              >
                <MenuGlyph size={20} ink={color.ink.primary} />
              </button>
            )}
            <div
              aria-hidden
              className="mn-topbar-brand"
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
              className="mn-topbar-brand"
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
          {/* Sidebar — only renders in the grid at ≥1024 (rail at lg, full at xl).
              At <1024 the same component is rendered inside the off-canvas drawer
              below. The data-tab-active stays 'false' because the sidebar is
              never one of the mobile bottom tabs. */}
          <div className="mn-pane-sidebar" data-tab-active="false">
            <ContentsSidebar
              items={items}
              activeId={activeQ?.id ?? ''}
              onPick={pickQuestion}
              sessionStats={sessionStats}
              mode={isBelowDesktop ? 'rail' : 'full'}
              onOpenDrawer={() => setDrawerOpen(true)}
            />
          </div>

          {/* Chat pane */}
          <div
            className="mn-pane-chat"
            data-tab-active={activeTab === 'tutor' ? 'true' : 'false'}
          >
            <ChatPane
              chat={chat}
              qIndex={qIndex}
              total={totalCap}
              tutorMood={tutorMood}
              onSend={handleChatSend}
            />
          </div>

          {/* Workings pane — handles BOTH the Question and Pad tabs on mobile,
              since both live inside this pane. The `mobileFocus` prop tells
              WorkingsPane whether to render only the question card + choices
              (Question tab) or only the canvas + toolbar (Pad tab). */}
          <div
            className="mn-pane-workings"
            data-tab-active={
              activeTab === 'question' || activeTab === 'pad'
                ? 'true'
                : 'false'
            }
          >
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
                canvasRef={canvasRef}
                mobileFocus={mobileFocus}
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
              items={items}
              onClose={() => setReport(null)}
              onReset={reset}
              onCreatePlan={() => setStudyPlanOpen(true)}
            />
          )}
          {report && studyPlanOpen && (
            <StudyPlanWizard
              report={report}
              sessionId={sessionId}
              onClose={() => setStudyPlanOpen(false)}
            />
          )}
        </div>

        {/* Mobile bottom tab bar — hidden ≥768 via CSS. Lives inside .mn-stage
            so it sits below the grid and above the footer, but the footer is
            also hidden at <768, so on phones the tab bar is the bottom-most
            chrome (with iOS safe-area padding from the .mn-tabbar rule). */}
        <MobileTabs
          active={activeTab}
          onChange={changeTab}
          tutorUnread={tutorUnread}
          padHasWork={padHasWork}
        />

        {/* Footer */}
        <div className="mn-footer">
          <span suppressHydrationWarning>
            session {sessionId.slice(0, 8)} · {sessionStats.done} answered ·{' '}
            {pending ? 'agent thinking…' : 'your turn'}
          </span>
          <span>Stylus + mouse · pressure-aware canvas</span>
        </div>
      </div>

      {/* Off-canvas contents drawer — visible <1280 only (CSS hides at xl).
          Renders the same ContentsSidebar as the in-grid pane, but `onPick`
          closes the drawer once a question is chosen. */}
      <div
        className="mn-drawer-backdrop"
        data-open={drawerOpen}
        onClick={() => setDrawerOpen(false)}
        aria-hidden
      />
      <aside
        className="mn-drawer"
        data-open={drawerOpen}
        aria-label="Contents drawer"
        aria-hidden={!drawerOpen}
      >
        <ContentsSidebar
          items={items}
          activeId={activeQ?.id ?? ''}
          onPick={(id) => {
            pickQuestion(id);
            setDrawerOpen(false);
          }}
          sessionStats={sessionStats}
          mode="drawer"
        />
      </aside>
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
        fontSize: fontSizeFluid.body,
      }}
    >
      {icon}
      <span style={{ fontWeight: fontWeight.semibold, color: color.ink.primary }}>
        {value}
      </span>
      <span
        className="mn-stat-label"
        style={{
          color: color.ink.faint,
          fontSize: fontSizeFluid.tiny,
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
  items,
  onClose,
  onReset,
  onCreatePlan,
}: {
  report: AssessmentReport;
  items: Question[];
  onClose: () => void;
  onReset: () => void;
  onCreatePlan: () => void;
}) {
  const strands = Object.entries(report.strands);
  // Strokes live only on the client (the report payload doesn't carry them),
  // so we look them up by attempt id. Either Question.itemId (when the item
  // came from the API) or Question.id (the canonical id) can match — items
  // built by `publicItemToQuestion` keep the two in sync.
  const strokesFor = (attemptItemId: string): Stroke[] => {
    const q = items.find(
      (it) => it.itemId === attemptItemId || it.id === attemptItemId,
    );
    return q?.strokes ?? [];
  };
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
        {report.attempts.length > 0 && (
          <div style={{ marginTop: space[8] }}>
            <div
              style={{
                fontSize: fontSize.h4,
                fontWeight: fontWeight.semibold,
                letterSpacing: '-0.01em',
                marginBottom: space[2],
              }}
            >
              Your answers
            </div>
            <div
              style={{
                fontSize: fontSize.small,
                color: color.ink.muted,
                marginBottom: space[5],
              }}
            >
              Each question, your pick, the correct option, and a sketch of the
              working you did on the right pad.
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: space[5],
              }}
            >
              {report.attempts.map((attempt, i) => (
                <QuestionReviewCard
                  key={attempt.itemId}
                  attempt={attempt}
                  strokes={strokesFor(attempt.itemId)}
                  index={i}
                />
              ))}
            </div>
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
