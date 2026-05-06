/**
 * Study-plan PDF document.
 *
 * Color + typography mirror design-system/math-notebook/tokens.json:
 *   bg.surface     #ffffff       canvas
 *   bg.muted       #f4f4f5       table zebra
 *   ink.primary    #18181b       headings + body
 *   ink.muted      #52525b       captions
 *   accent.primary #4f46e5       hero accent
 *   accent.softBg  #eef2ff       gap chip background
 *   border.default #e4e4e7       table grid
 *   feedback.goodInk  #047857    "on track" indicator
 *   feedback.warnInk  #b45309    "stretch" indicator
 *
 * Inter is unavailable to react-pdf out of the box without registration —
 * we ship Helvetica (built-in) and keep visual rhythm via weight/size.
 */
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import type { AssessmentReport, StudyPlan, Strand, Tier } from '@maths-diag/core';

const tok = {
  surface: '#ffffff',
  muted: '#f4f4f5',
  subtle: '#f9fafb',
  inkPrimary: '#18181b',
  inkSecondary: '#3f3f46',
  inkMuted: '#52525b',
  inkFaint: '#a1a1aa',
  border: '#e4e4e7',
  borderStrong: '#d4d4d8',
  accent: '#4f46e5',
  accentSoft: '#eef2ff',
  accentInk: '#3730a3',
  good: '#047857',
  warn: '#b45309',
  bad: '#b91c1c',
};

const STRAND_LABEL: Record<Strand, string> = {
  number: 'Number',
  algebra: 'Algebra',
  geometry_trig: 'Geometry & Trig',
  functions: 'Functions',
  statistics_prob: 'Stats & Prob',
  measures_data: 'Measures & Data',
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: tok.surface,
    color: tok.inkPrimary,
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    lineHeight: 1.4,
  },
  // Cover
  coverHeader: {
    borderBottomWidth: 1,
    borderBottomColor: tok.border,
    paddingBottom: 12,
    marginBottom: 16,
  },
  eyebrow: {
    fontSize: 9,
    color: tok.accent,
    letterSpacing: 1.5,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 24,
    color: tok.inkPrimary,
    fontFamily: 'Helvetica-Bold',
    marginTop: 4,
    marginBottom: 6,
    letterSpacing: -0.4,
    lineHeight: 1.15,
  },
  subtitle: {
    fontSize: 11,
    color: tok.inkMuted,
    marginTop: 2,
    lineHeight: 1.4,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    marginBottom: 16,
  },
  metaCard: {
    backgroundColor: tok.subtle,
    borderWidth: 1,
    borderColor: tok.border,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 110,
  },
  metaLabel: {
    fontSize: 8,
    color: tok.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  metaValue: {
    fontSize: 14,
    color: tok.inkPrimary,
    fontFamily: 'Helvetica-Bold',
    marginTop: 2,
  },
  sectionHeading: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: tok.inkPrimary,
    marginTop: 12,
    marginBottom: 8,
    letterSpacing: -0.1,
  },
  paragraph: {
    fontSize: 10,
    color: tok.inkSecondary,
    marginBottom: 10,
  },
  // Priority list
  priorityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: tok.border,
  },
  priorityChip: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: tok.surface,
    minWidth: 50,
    textAlign: 'center',
  },
  priorityStrand: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: tok.inkPrimary,
    width: 110,
  },
  priorityFocus: {
    fontSize: 9,
    color: tok.inkMuted,
    flex: 1,
  },
  // Week block
  weekBlock: {
    marginBottom: 14,
    borderWidth: 1,
    borderColor: tok.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  weekHeader: {
    backgroundColor: tok.accentSoft,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  weekTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: tok.accentInk,
  },
  weekDates: {
    fontSize: 9,
    color: tok.accentInk,
  },
  weekTheme: {
    fontSize: 10,
    color: tok.inkSecondary,
    paddingHorizontal: 12,
    paddingTop: 8,
    fontFamily: 'Helvetica-Oblique',
  },
  topicTable: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 8,
  },
  topicRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: tok.border,
  },
  topicRowLast: {
    borderBottomWidth: 0,
  },
  topicHead: {
    fontSize: 8,
    color: tok.inkFaint,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontFamily: 'Helvetica-Bold',
  },
  colStrand: { width: 70, fontSize: 9, color: tok.inkSecondary },
  colTitle: { flex: 1, fontSize: 9, color: tok.inkPrimary },
  colHours: { width: 38, fontSize: 9, color: tok.inkSecondary, textAlign: 'right' },
  topicCell: { flex: 1, paddingRight: 8 },
  topicTitle: {
    fontSize: 9,
    color: tok.inkPrimary,
    fontFamily: 'Helvetica-Bold',
    lineHeight: 1.3,
  },
  topicSub: {
    fontSize: 8,
    color: tok.inkMuted,
    marginTop: 2,
    lineHeight: 1.35,
  },
  // "Where you slipped" callout — surfaces specific diagnostic mistakes the
  // LLM has tied to this topic. Sits inside the topic cell so it visually
  // belongs to the topic, not the milestone.
  slipBlock: {
    marginTop: 4,
    paddingTop: 4,
    paddingHorizontal: 6,
    paddingBottom: 4,
    backgroundColor: '#fef2f2',
    borderLeftWidth: 2,
    borderLeftColor: tok.bad,
    borderRadius: 3,
  },
  slipHeading: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: tok.bad,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  slipItem: {
    fontSize: 8,
    color: tok.inkSecondary,
    marginTop: 2,
    lineHeight: 1.35,
  },
  slipQuestion: {
    fontFamily: 'Helvetica-Bold',
    color: tok.inkPrimary,
  },
  milestone: {
    backgroundColor: tok.subtle,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderTopWidth: 0.5,
    borderTopColor: tok.border,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  milestoneLabel: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: tok.inkPrimary,
    width: 56,
  },
  milestoneText: {
    fontSize: 9,
    color: tok.inkSecondary,
    flex: 1,
  },
  caveatList: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fcd34d',
    borderRadius: 6,
    padding: 10,
    marginTop: 8,
  },
  caveatHeading: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: tok.warn,
    marginBottom: 4,
  },
  caveatItem: {
    fontSize: 9,
    color: '#78350f',
    marginBottom: 2,
  },
  footer: {
    position: 'absolute',
    bottom: 16,
    left: 40,
    right: 40,
    fontSize: 8,
    color: tok.inkMuted,
    textAlign: 'center',
    borderTopWidth: 1,
    borderTopColor: tok.border,
    paddingTop: 6,
  },
  // Diagnostic snapshot grid
  diagnosticGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  diagnosticCard: {
    width: 158,
    borderWidth: 1,
    borderColor: tok.border,
    borderRadius: 6,
    padding: 8,
    backgroundColor: tok.subtle,
  },
  diagnosticStrand: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: tok.inkPrimary,
    marginBottom: 2,
  },
  diagnosticTier: {
    fontSize: 8,
    color: tok.inkMuted,
    marginBottom: 4,
  },
  confidenceTrack: {
    height: 4,
    backgroundColor: tok.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: 4,
    backgroundColor: tok.accent,
    borderRadius: 2,
  },
  diagnosticConfidenceLabel: {
    fontSize: 7,
    color: tok.inkFaint,
    marginTop: 2,
  },
  // Strengths / gaps lists
  insightBlock: {
    borderWidth: 1,
    borderColor: tok.border,
    borderRadius: 6,
    padding: 10,
    marginBottom: 10,
  },
  insightBlockGap: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  insightBlockStrength: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  insightTitle: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  insightTitleGap: { color: tok.bad },
  insightTitleStrength: { color: tok.good },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 3,
  },
  insightCode: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: tok.inkSecondary,
    width: 80,
  },
  insightLabel: {
    fontSize: 9,
    color: tok.inkSecondary,
    flex: 1,
  },
  insightEmpty: {
    fontSize: 9,
    color: tok.inkMuted,
    fontFamily: 'Helvetica-Oblique',
  },
  nextSteps: {
    fontSize: 9,
    color: tok.inkSecondary,
    backgroundColor: tok.accentSoft,
    padding: 10,
    borderRadius: 6,
    marginBottom: 10,
  },
});

function gapChipColor(gap: 0 | 1 | 2): string {
  if (gap === 2) return tok.bad;
  if (gap === 1) return tok.warn;
  return tok.good;
}

function gapChipLabel(gap: 0 | 1 | 2): string {
  if (gap === 2) return 'GAP 2';
  if (gap === 1) return 'GAP 1';
  return 'ON TRACK';
}

function tierLabel(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Helvetica (the only font we ship without registration) lacks glyphs for
 * common math/typography Unicode chars. Substitute them with ASCII so the
 * LLM-generated content (milestones, focus blurbs, practice hints) doesn't
 * render as missing-glyph boxes. The dot operator `·` (U+00B7) and em-dash
 * `—` (U+2014) ARE in WinAnsi so we leave them.
 */
function glyphSafe(s: string): string {
  return s
    .replace(/theta=([-\d.]+)/g, 'score=$1')
    .replace(/θ/g, 'score ')
    .replace(/→/g, ' to ')
    .replace(/←/g, ' from ')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/✓/g, 'OK')
    .replace(/✗/g, 'X')
    .replace(/×/g, 'x');
}

/**
 * Items in `packages/core/src/items.ts` carry `learningOutcome` strings shaped
 * like "LC.FN.O.2: Evaluate a derivative at a point". Split on the first colon
 * so we can render the curriculum code beside its plain-English label.
 */
function splitLO(lo: string): { code: string; label: string } {
  const idx = lo.indexOf(':');
  if (idx === -1) return { code: lo.trim(), label: '' };
  return {
    code: lo.slice(0, idx).trim(),
    label: lo.slice(idx + 1).trim(),
  };
}

const TIER_LABEL: Record<Tier, string> = {
  foundation: 'Foundation',
  ordinary: 'Ordinary',
  higher: 'Higher',
};

interface StudyPlanPDFProps {
  plan: StudyPlan;
  /**
   * The diagnostic report. Optional so older callers don't break, but the
   * cover page renders much richer context when supplied.
   */
  report?: AssessmentReport;
}

export function StudyPlanPDF({ plan, report }: StudyPlanPDFProps) {
  const total = plan.weeks.reduce(
    (acc, w) => acc + w.topics.reduce((a, t) => a + t.hours, 0),
    0,
  );
  return (
    <Document
      title={`Study Plan — ${plan.input.learnerName ?? 'Learner'} → ${tierLabel(plan.input.goalTier)}`}
      author="Math Notebook"
      subject="Personalised Irish maths study plan"
    >
      <Page size="A4" style={styles.page}>
        {/* Cover */}
        <View style={styles.coverHeader}>
          <Text style={styles.eyebrow}>Personalised Study Plan</Text>
          <Text style={styles.title}>
            {plan.input.learnerName ?? 'Learner'} — toward {tierLabel(plan.input.goalTier)} tier
          </Text>
          <Text style={styles.subtitle}>
            Generated {fmtDate(plan.generatedAt)} · {plan.totalWeeks}-week schedule ·{' '}
            {Math.round(total)} total study hours
          </Text>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Goal tier</Text>
            <Text style={styles.metaValue}>{tierLabel(plan.input.goalTier)}</Text>
          </View>
          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Target date</Text>
            <Text style={styles.metaValue}>{fmtDate(plan.input.targetDate)}</Text>
          </View>
          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Weekly budget</Text>
            <Text style={styles.metaValue}>{plan.input.weeklyHours} hrs</Text>
          </View>
          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Total weeks</Text>
            <Text style={styles.metaValue}>{plan.totalWeeks}</Text>
          </View>
        </View>

        <Text style={styles.sectionHeading}>Summary</Text>
        <Text style={styles.paragraph}>{glyphSafe(plan.summary)}</Text>

        {report && (
          <>
            <Text style={styles.sectionHeading}>Diagnostic snapshot</Text>
            <View style={styles.diagnosticGrid}>
              {(Object.keys(report.strands) as Strand[])
                .filter((s) => s !== 'measures_data')
                .map((s) => {
                  const ds = report.strands[s];
                  const pct = Math.max(0, Math.min(1, ds.confidence));
                  return (
                    <View key={s} style={styles.diagnosticCard}>
                      <Text style={styles.diagnosticStrand}>
                        {STRAND_LABEL[s]}
                      </Text>
                      <Text style={styles.diagnosticTier}>
                        {TIER_LABEL[ds.tier]} · score {ds.theta.toFixed(2)}
                      </Text>
                      <View style={styles.confidenceTrack}>
                        <View
                          style={[
                            styles.confidenceFill,
                            { width: `${pct * 100}%` },
                          ]}
                        />
                      </View>
                      <Text style={styles.diagnosticConfidenceLabel}>
                        Confidence {Math.round(pct * 100)}%
                      </Text>
                    </View>
                  );
                })}
            </View>

            <Text style={styles.sectionHeading}>Topics to work on</Text>
            <View style={[styles.insightBlock, styles.insightBlockGap]}>
              <Text style={[styles.insightTitle, styles.insightTitleGap]}>
                From your diagnostic answers
              </Text>
              {report.gaps.length === 0 ? (
                <Text style={styles.insightEmpty}>
                  No clear gaps surfaced at this confidence — the schedule still
                  closes the tier gap toward your goal.
                </Text>
              ) : (
                report.gaps.map((lo) => {
                  const { code, label } = splitLO(lo);
                  return (
                    <View key={lo} style={styles.insightItem}>
                      <Text style={styles.insightCode}>{code}</Text>
                      <Text style={styles.insightLabel}>
                        {glyphSafe(label || '(see curriculum reference)')}
                      </Text>
                    </View>
                  );
                })
              )}
            </View>

            <Text style={styles.sectionHeading}>Strengths</Text>
            <View style={[styles.insightBlock, styles.insightBlockStrength]}>
              <Text style={[styles.insightTitle, styles.insightTitleStrength]}>
                Anchors to keep sharp
              </Text>
              {report.strengths.length === 0 ? (
                <Text style={styles.insightEmpty}>
                  Run more questions to surface strengths — early sessions
                  prioritise probing weak areas first.
                </Text>
              ) : (
                report.strengths.map((lo) => {
                  const { code, label } = splitLO(lo);
                  return (
                    <View key={lo} style={styles.insightItem}>
                      <Text style={styles.insightCode}>{code}</Text>
                      <Text style={styles.insightLabel}>
                        {glyphSafe(label || '(see curriculum reference)')}
                      </Text>
                    </View>
                  );
                })
              )}
            </View>

            <Text style={styles.nextSteps}>{glyphSafe(report.nextSteps)}</Text>
          </>
        )}

        <Text style={styles.sectionHeading}>Strand priorities</Text>
        {plan.priorities.map((p) => (
          <View key={p.strand} style={styles.priorityRow}>
            <Text
              style={[styles.priorityChip, { backgroundColor: gapChipColor(p.gap) }]}
            >
              {gapChipLabel(p.gap)}
            </Text>
            <Text style={styles.priorityStrand}>{STRAND_LABEL[p.strand]}</Text>
            <Text style={styles.priorityFocus}>
              {tierLabel(p.currentTier)} to {tierLabel(p.goalTier)} · {glyphSafe(p.focus)}
            </Text>
          </View>
        ))}

        {plan.caveats.length > 0 && (
          <View style={styles.caveatList}>
            <Text style={styles.caveatHeading}>Heads-up</Text>
            {plan.caveats.map((c, i) => (
              <Text key={i} style={styles.caveatItem}>
                • {glyphSafe(c)}
              </Text>
            ))}
          </View>
        )}

        <View style={styles.footer} fixed>
          <Text>
            Math Notebook · {fmtDate(plan.generatedAt)} ·{' '}
            {plan.input.learnerName ?? 'Personalised study plan'}
          </Text>
        </View>
      </Page>

      {/* Schedule */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.eyebrow}>Weekly schedule</Text>
        <Text style={styles.title}>
          {plan.totalWeeks}-week study schedule
        </Text>
        <Text style={styles.subtitle}>
          Each topic targets a learning outcome from the Irish maths curriculum.
        </Text>
        <View style={{ marginTop: 12 }}>
          {plan.weeks.map((w) => (
            <View key={w.weekNumber} style={styles.weekBlock} wrap={false}>
              <View style={styles.weekHeader}>
                <Text style={styles.weekTitle}>
                  Week {w.weekNumber} · {glyphSafe(w.theme)}
                </Text>
                <Text style={styles.weekDates}>
                  {fmtDate(w.startDate)} – {fmtDate(w.endDate)}
                </Text>
              </View>
              <View style={styles.topicTable}>
                <View style={styles.topicRow}>
                  <Text style={[styles.colStrand, styles.topicHead]}>Strand</Text>
                  <Text style={[styles.colTitle, styles.topicHead]}>Topic</Text>
                  <Text style={[styles.colHours, styles.topicHead]}>Hrs</Text>
                </View>
                {w.topics.map((t, i) => {
                  const isLast = i === w.topics.length - 1;
                  const slips = t.relatedIncorrectItems ?? [];
                  return (
                    <View
                      key={i}
                      style={isLast ? [styles.topicRow, styles.topicRowLast] : styles.topicRow}
                    >
                      <Text style={styles.colStrand}>{STRAND_LABEL[t.strand]}</Text>
                      <View style={styles.topicCell}>
                        <Text style={styles.topicTitle}>{glyphSafe(t.title)}</Text>
                        <Text style={styles.topicSub}>
                          {t.learningOutcome} · {glyphSafe(t.practiceHint)}
                        </Text>
                        {slips.length > 0 && (
                          <View style={styles.slipBlock}>
                            <Text style={styles.slipHeading}>
                              Where you slipped
                            </Text>
                            {slips.map((slip, j) => (
                              <Text key={j} style={styles.slipItem}>
                                <Text style={styles.slipQuestion}>
                                  {glyphSafe(slip.questionText)}
                                </Text>
                                {' — you picked "'}
                                {glyphSafe(slip.chosenAnswer)}
                                {'", answer was "'}
                                {glyphSafe(slip.correctAnswer)}
                                {'". Trap: '}
                                {glyphSafe(slip.trap)}
                              </Text>
                            ))}
                          </View>
                        )}
                      </View>
                      <Text style={styles.colHours}>{t.hours}</Text>
                    </View>
                  );
                })}
              </View>
              <View style={styles.milestone}>
                <Text style={styles.milestoneLabel}>Milestone</Text>
                <Text style={styles.milestoneText}>{glyphSafe(w.milestone)}</Text>
              </View>
            </View>
          ))}
        </View>
        <View style={styles.footer} fixed>
          <Text>
            Math Notebook · {fmtDate(plan.generatedAt)} ·{' '}
            {plan.input.learnerName ?? 'Personalised study plan'}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
