'use client';

/**
 * StudyPlanWizard — HITL form opens after assessment finalises.
 *
 * Steps:
 *   1) Goal (target tier + exam date + weekly hours + focus strands)
 *   2) Loading (POST /api/study-plan)
 *   3) Preview (renders the plan + Download PDF button)
 *
 * The PDF is generated client-side via @react-pdf/renderer's pdf().toBlob()
 * so we don't need a server-side renderer.
 */
import { useEffect, useMemo, useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import posthog from 'posthog-js';
import type {
  AssessmentReport,
  Strand,
  StudyPlan,
  StudyPlanInput,
  Tier,
} from '@maths-diag/core';
import { Button, SketchBox } from '../primitives';
import { color, fontSize, fontWeight, font, radius, space } from '../../_engine/tokens';
import { StudyPlanPDF } from './StudyPlanPDF';

type Step = 'form' | 'loading' | 'preview' | 'error';

const STRANDS: { id: Strand; label: string }[] = [
  { id: 'number', label: 'Number' },
  { id: 'algebra', label: 'Algebra' },
  { id: 'geometry_trig', label: 'Geometry & Trig' },
  { id: 'functions', label: 'Functions' },
  { id: 'statistics_prob', label: 'Stats & Prob' },
];

const TIER_OPTIONS: { id: Tier; label: string; blurb: string }[] = [
  {
    id: 'foundation',
    label: 'Foundation',
    blurb: 'Build core fluency for the foundation paper.',
  },
  {
    id: 'ordinary',
    label: 'Ordinary',
    blurb: 'Reach JC OL / LC OL exam standard.',
  },
  {
    id: 'higher',
    label: 'Higher',
    blurb: 'Stretch toward LC HL — proofs, induction, calculus.',
  },
];

interface Props {
  report: AssessmentReport;
  onClose: () => void;
  /** Assessment sessionId — forwarded for analytics correlation. */
  sessionId?: string;
}

export function StudyPlanWizard({ report, onClose, sessionId }: Props) {
  const [step, setStep] = useState<Step>('form');
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<StudyPlan | null>(null);

  // Form state
  const [learnerName, setLearnerName] = useState('');
  const [goalTier, setGoalTier] = useState<Tier>(report.overallTier);
  const [targetDate, setTargetDate] = useState(() => {
    // Default to 12 weeks from today.
    const d = new Date();
    d.setDate(d.getDate() + 12 * 7);
    return d.toISOString().slice(0, 10);
  });
  const [weeklyHours, setWeeklyHours] = useState(6);
  const [focusStrands, setFocusStrands] = useState<Strand[]>([]);
  const [notes, setNotes] = useState('');

  const minDate = useMemo(() => new Date().toISOString().slice(0, 10), []);

  function toggleFocus(s: Strand): void {
    setFocusStrands((cur) =>
      cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s],
    );
  }

  async function submit(): Promise<void> {
    setStep('loading');
    setError(null);
    try {
      const distinctId =
        typeof window !== 'undefined'
          ? (() => {
              try {
                return posthog.get_distinct_id?.();
              } catch {
                return undefined;
              }
            })()
          : undefined;
      try {
        posthog.capture('study_plan_form_submitted', {
          assessment_session_id: sessionId,
          goal_tier: goalTier,
          weekly_hours: weeklyHours,
          target_date: targetDate,
          focus_strands_count: focusStrands.length,
        });
      } catch {
        // posthog may be ad-blocked / unloaded; never crash the form
      }
      const body: {
        report: AssessmentReport;
        input: StudyPlanInput;
        sessionId?: string;
        distinctId?: string;
      } = {
        report,
        input: {
          learnerName: learnerName.trim() || undefined,
          goalTier,
          targetDate,
          weeklyHours,
          focusStrands,
          notes: notes.trim() || undefined,
        },
        sessionId,
        distinctId,
      };
      const res = await fetch('/api/study-plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({ error: 'unknown' }));
        throw new Error(detail.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { plan: StudyPlan };
      setPlan(data.plan);
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate plan');
      setStep('error');
    }
  }

  async function downloadPdf(): Promise<void> {
    if (!plan) return;
    const blob = await pdf(<StudyPlanPDF plan={plan} report={report} />).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `study-plan-${plan.input.goalTier}-${plan.input.targetDate}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div role="dialog" aria-modal="true" style={overlayStyle}>
      <SketchBox
        fill={color.bg.surface}
        pad={space[10]}
        elevation="lg"
        radius={radius.xl}
        style={{
          width: '100%',
          maxWidth: 760,
          maxHeight: '92vh',
          overflowY: 'auto',
          fontFamily: font.sans,
          color: color.ink.primary,
        }}
      >
        {step === 'form' && (
          <FormStep
            learnerName={learnerName}
            setLearnerName={setLearnerName}
            goalTier={goalTier}
            setGoalTier={setGoalTier}
            targetDate={targetDate}
            setTargetDate={setTargetDate}
            minDate={minDate}
            weeklyHours={weeklyHours}
            setWeeklyHours={setWeeklyHours}
            focusStrands={focusStrands}
            toggleFocus={toggleFocus}
            notes={notes}
            setNotes={setNotes}
            onSubmit={submit}
            onClose={onClose}
          />
        )}
        {step === 'loading' && <LoadingStep />}
        {step === 'error' && (
          <ErrorStep
            error={error ?? 'Unknown error'}
            onRetry={() => setStep('form')}
            onClose={onClose}
          />
        )}
        {step === 'preview' && plan && (
          <PreviewStep plan={plan} onDownload={downloadPdf} onClose={onClose} />
        )}
      </SketchBox>
    </div>
  );
}

// ─── Sub-views ──────────────────────────────────────────────────────────

function FormStep(props: {
  learnerName: string;
  setLearnerName: (v: string) => void;
  goalTier: Tier;
  setGoalTier: (t: Tier) => void;
  targetDate: string;
  setTargetDate: (d: string) => void;
  minDate: string;
  weeklyHours: number;
  setWeeklyHours: (n: number) => void;
  focusStrands: Strand[];
  toggleFocus: (s: Strand) => void;
  notes: string;
  setNotes: (v: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const dateValid = props.targetDate >= props.minDate;
  const hoursValid = props.weeklyHours >= 1 && props.weeklyHours <= 40;
  const valid = dateValid && hoursValid;

  return (
    <>
      <div style={{ marginBottom: space[6] }}>
        <div style={eyebrowStyle}>HITL · Step 1 of 2</div>
        <h2 style={titleStyle}>Create your study plan</h2>
        <p style={{ ...captionStyle, marginTop: 4 }}>
          Tell the agent what you\u2019re aiming for. It will fold your assessment
          results into a week-by-week schedule and produce a downloadable PDF.
        </p>
      </div>

      <Field label="Your name (optional)">
        <input
          type="text"
          value={props.learnerName}
          onChange={(e) => props.setLearnerName(e.target.value)}
          placeholder="Appears on the cover sheet"
          maxLength={80}
          style={inputStyle}
        />
      </Field>

      <Field label="Target tier">
        <div style={{ display: 'grid', gap: space[3] }}>
          {TIER_OPTIONS.map((t) => {
            const selected = props.goalTier === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => props.setGoalTier(t.id)}
                aria-pressed={selected}
                style={tierCardStyle(selected)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: space[3] }}>
                  <span style={radioDotStyle(selected)} aria-hidden />
                  <span style={{ fontWeight: fontWeight.semibold }}>{t.label}</span>
                </div>
                <span style={{ fontSize: fontSize.small, color: color.ink.muted }}>
                  {t.blurb}
                </span>
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="Exam / target date">
        <input
          type="date"
          value={props.targetDate}
          min={props.minDate}
          onChange={(e) => props.setTargetDate(e.target.value)}
          style={{
            ...inputStyle,
            borderColor: dateValid ? color.border.default : color.feedback.badEdge,
          }}
        />
        {!dateValid && (
          <span style={errorTextStyle}>Pick a date in the future.</span>
        )}
      </Field>

      <Field label={`Weekly study budget (${props.weeklyHours} hr${props.weeklyHours === 1 ? '' : 's'})`}>
        <input
          type="range"
          min={1}
          max={20}
          step={1}
          value={props.weeklyHours}
          onChange={(e) => props.setWeeklyHours(Number(e.target.value))}
          style={{ width: '100%' }}
          aria-label="Weekly study hours"
        />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: fontSize.tiny,
            color: color.ink.faint,
          }}
        >
          <span>1 hr</span>
          <span>20 hrs</span>
        </div>
      </Field>

      <Field label="Strands to focus on (optional)">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: space[3] }}>
          {STRANDS.map((s) => {
            const active = props.focusStrands.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => props.toggleFocus(s.id)}
                aria-pressed={active}
                style={chipStyle(active)}
              >
                {s.label}
              </button>
            );
          })}
        </div>
        <span style={hintStyle}>
          Leave blank to let the agent pick from your gap analysis.
        </span>
      </Field>

      <Field label="Anything else the agent should know? (optional)">
        <textarea
          value={props.notes}
          onChange={(e) => props.setNotes(e.target.value)}
          placeholder="e.g. I find proofs hardest, mock paper coming up in 6 weeks…"
          maxLength={500}
          rows={3}
          style={{ ...inputStyle, resize: 'vertical', minHeight: 70 }}
        />
      </Field>

      <div style={{ display: 'flex', gap: space[4], justifyContent: 'flex-end', marginTop: space[6] }}>
        <Button variant="secondary" onClick={props.onClose}>
          Cancel
        </Button>
        <Button variant="primary" onClick={props.onSubmit} disabled={!valid}>
          Generate plan
        </Button>
      </div>
    </>
  );
}

function LoadingStep() {
  return (
    <div style={{ textAlign: 'center', padding: space[10] }}>
      <div style={spinnerStyle} aria-hidden />
      <div style={{ marginTop: space[5], fontSize: fontSize.body, color: color.ink.muted }}>
        Building your plan…
      </div>
      <div style={{ marginTop: space[3], fontSize: fontSize.small, color: color.ink.faint }}>
        The coach is mapping your results to a week-by-week schedule.
      </div>
    </div>
  );
}

function ErrorStep({
  error,
  onRetry,
  onClose,
}: {
  error: string;
  onRetry: () => void;
  onClose: () => void;
}) {
  return (
    <div>
      <div style={eyebrowStyle}>Something went wrong</div>
      <h2 style={titleStyle}>We couldn\u2019t build your plan</h2>
      <p style={{ ...captionStyle, marginTop: space[3] }}>
        {error}
      </p>
      <div style={{ display: 'flex', gap: space[4], justifyContent: 'flex-end', marginTop: space[6] }}>
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
        <Button variant="primary" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </div>
  );
}

function PreviewStep({
  plan,
  onDownload,
  onClose,
}: {
  plan: StudyPlan;
  onDownload: () => void;
  onClose: () => void;
}) {
  return (
    <div>
      <div style={eyebrowStyle}>Plan ready</div>
      <h2 style={titleStyle}>
        {plan.totalWeeks}-week plan to {plan.input.goalTier}
      </h2>
      <p style={{ ...captionStyle, marginTop: space[2] }}>
        {plan.summary}
      </p>

      <h3 style={subheadingStyle}>Strand priorities</h3>
      <div style={{ display: 'grid', gap: space[2] }}>
        {plan.priorities.map((p) => (
          <div key={p.strand} style={priorityRowStyle}>
            <span style={priorityChipStyle(p.gap)}>
              {p.gap === 0 ? 'On track' : `Gap ${p.gap}`}
            </span>
            <span style={{ fontWeight: fontWeight.medium }}>
              {labelFor(p.strand)}
            </span>
            <span style={{ color: color.ink.muted, fontSize: fontSize.small, flex: 1 }}>
              {p.currentTier} → {p.goalTier}
            </span>
          </div>
        ))}
      </div>

      <h3 style={subheadingStyle}>Schedule preview</h3>
      <div style={{ display: 'grid', gap: space[3] }}>
        {plan.weeks.slice(0, 4).map((w) => (
          <div key={w.weekNumber} style={weekPreviewStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: space[2] }}>
              <strong style={{ fontSize: fontSize.body }}>
                Week {w.weekNumber} · {w.theme}
              </strong>
              <span style={{ fontSize: fontSize.tiny, color: color.ink.muted }}>
                {w.startDate} – {w.endDate}
              </span>
            </div>
            <ul style={{ margin: 0, paddingLeft: space[5], color: color.ink.secondary, fontSize: fontSize.small }}>
              {w.topics.slice(0, 3).map((t, i) => (
                <li key={i}>
                  <strong>{labelFor(t.strand)}</strong> · {t.title} ({t.hours}h)
                </li>
              ))}
              {w.topics.length > 3 && (
                <li style={{ color: color.ink.faint }}>
                  +{w.topics.length - 3} more topic{w.topics.length - 3 === 1 ? '' : 's'}
                </li>
              )}
            </ul>
          </div>
        ))}
        {plan.weeks.length > 4 && (
          <div style={{ fontSize: fontSize.small, color: color.ink.faint, textAlign: 'center' }}>
            …and {plan.weeks.length - 4} more weeks in the PDF.
          </div>
        )}
      </div>

      {plan.caveats.length > 0 && (
        <div style={caveatBoxStyle}>
          <strong style={{ color: color.feedback.warnInk, fontSize: fontSize.small }}>
            Heads-up
          </strong>
          <ul style={{ margin: 0, paddingLeft: space[5], color: color.feedback.warnInk, fontSize: fontSize.small }}>
            {plan.caveats.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ display: 'flex', gap: space[4], justifyContent: 'flex-end', marginTop: space[7] }}>
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
        <Button variant="primary" onClick={onDownload}>
          Download PDF
        </Button>
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: space[5] }}>
      <label style={fieldLabelStyle}>{label}</label>
      <div style={{ marginTop: space[2] }}>{children}</div>
    </div>
  );
}

function labelFor(s: Strand): string {
  switch (s) {
    case 'number':
      return 'Number';
    case 'algebra':
      return 'Algebra';
    case 'geometry_trig':
      return 'Geometry & Trig';
    case 'functions':
      return 'Functions';
    case 'statistics_prob':
      return 'Stats & Prob';
    case 'measures_data':
      return 'Measures & Data';
  }
}

// ─── Inline style objects (CSS-in-JS, matches existing components) ──────

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 23, 42, 0.5)',
  backdropFilter: 'blur(4px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 50,
  padding: space[5],
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: fontSize.tiny,
  color: color.accent.primary,
  textTransform: 'uppercase',
  letterSpacing: 1.4,
  fontWeight: fontWeight.semibold,
};

const titleStyle: React.CSSProperties = {
  fontSize: fontSize.h2,
  fontWeight: fontWeight.semibold,
  letterSpacing: '-0.02em',
  margin: 0,
};

const captionStyle: React.CSSProperties = {
  fontSize: fontSize.body,
  color: color.ink.muted,
  margin: 0,
};

const subheadingStyle: React.CSSProperties = {
  fontSize: fontSize.h4,
  fontWeight: fontWeight.semibold,
  marginTop: space[6],
  marginBottom: space[3],
};

const fieldLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: fontSize.small,
  fontWeight: fontWeight.medium,
  color: color.ink.secondary,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: `${space[3]}px ${space[4]}px`,
  border: `1px solid ${color.border.default}`,
  borderRadius: 8,
  fontSize: fontSize.body,
  fontFamily: font.sans,
  color: color.ink.primary,
  background: color.bg.surface,
  outline: 'none',
};

const hintStyle: React.CSSProperties = {
  display: 'block',
  marginTop: space[2],
  fontSize: fontSize.tiny,
  color: color.ink.faint,
};

const errorTextStyle: React.CSSProperties = {
  display: 'block',
  marginTop: space[2],
  fontSize: fontSize.tiny,
  color: color.feedback.badInk,
};

function tierCardStyle(selected: boolean): React.CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: space[1],
    padding: `${space[4]}px ${space[5]}px`,
    border: `1.5px solid ${selected ? color.accent.primary : color.border.default}`,
    borderRadius: 10,
    background: selected ? color.accent.primarySoft : color.bg.surface,
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: font.sans,
    fontSize: fontSize.body,
    color: color.ink.primary,
  };
}

function radioDotStyle(selected: boolean): React.CSSProperties {
  return {
    display: 'inline-block',
    width: 14,
    height: 14,
    borderRadius: '50%',
    border: `2px solid ${selected ? color.accent.primary : color.border.strong}`,
    background: selected ? color.accent.primary : color.bg.surface,
    boxShadow: selected ? `inset 0 0 0 2px ${color.bg.surface}` : 'none',
    transition: 'all 120ms ease',
  };
}

function chipStyle(active: boolean): React.CSSProperties {
  return {
    padding: `${space[2]}px ${space[4]}px`,
    border: `1px solid ${active ? color.accent.primary : color.border.default}`,
    borderRadius: 999,
    fontSize: fontSize.small,
    fontWeight: fontWeight.medium,
    color: active ? color.accent.primaryInk : color.ink.secondary,
    background: active ? color.accent.primarySoft : color.bg.surface,
    cursor: 'pointer',
    fontFamily: font.sans,
  };
}

function priorityChipStyle(gap: 0 | 1 | 2): React.CSSProperties {
  const palette =
    gap === 2
      ? { bg: color.feedback.badBg, ink: color.feedback.badInk }
      : gap === 1
        ? { bg: color.feedback.warnBg, ink: color.feedback.warnInk }
        : { bg: color.feedback.goodBg, ink: color.feedback.goodInk };
  return {
    padding: `${space[1]}px ${space[3]}px`,
    borderRadius: 6,
    fontSize: fontSize.tiny,
    fontWeight: fontWeight.semibold,
    background: palette.bg,
    color: palette.ink,
    minWidth: 64,
    textAlign: 'center',
  };
}

const priorityRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: space[3],
  padding: `${space[2]}px 0`,
  borderBottom: `1px solid ${color.border.subtle}`,
};

const weekPreviewStyle: React.CSSProperties = {
  border: `1px solid ${color.border.default}`,
  borderRadius: 10,
  padding: space[4],
  background: color.bg.subtle,
};

const caveatBoxStyle: React.CSSProperties = {
  marginTop: space[5],
  padding: space[4],
  background: color.feedback.warnBg,
  border: `1px solid ${color.feedback.warnEdge}`,
  borderRadius: 8,
};

const spinnerStyle: React.CSSProperties = {
  display: 'inline-block',
  width: 36,
  height: 36,
  border: `3px solid ${color.border.default}`,
  borderTopColor: color.accent.primary,
  borderRadius: '50%',
  animation: 'mn-spin 700ms linear infinite',
};
