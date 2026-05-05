import Link from 'next/link';
import {
  color,
  font,
  fontSize,
  fontWeight,
  radius,
  shadow,
  space,
} from './assessment/_engine/tokens';

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: color.bg.canvas,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: space[12],
        fontFamily: font.sans,
      }}
    >
      <div
        style={{
          maxWidth: 560,
          width: '100%',
          background: color.bg.surface,
          padding: `${space[12]}px ${space[10]}px`,
          border: `1px solid ${color.border.default}`,
          borderRadius: radius.xl,
          boxShadow: shadow.md,
        }}
      >
        <span
          style={{
            display: 'inline-block',
            fontSize: fontSize.micro,
            fontWeight: fontWeight.semibold,
            color: color.accent.primary,
            background: color.accent.primarySoft,
            padding: `${space[2]}px ${space[5]}px`,
            borderRadius: radius.pill,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            marginBottom: space[6],
          }}
        >
          Adaptive · Project Maths
        </span>
        <h1
          style={{
            fontSize: fontSize.h1,
            fontWeight: fontWeight.semibold,
            margin: 0,
            color: color.ink.primary,
            letterSpacing: '-0.02em',
            lineHeight: 1.15,
          }}
        >
          Find your tier in about ten questions.
        </h1>
        <p
          style={{
            fontSize: fontSize.lead,
            fontWeight: fontWeight.regular,
            color: color.ink.muted,
            margin: `${space[5]}px 0 ${space[10]}px`,
            lineHeight: 1.6,
          }}
        >
          A clean, modern adaptive assessment. The tutor agent picks each
          question from how the last one went — work it out, pick A/B/C/D, get
          a personalised report.
        </p>

        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: `0 0 ${space[10]}px 0`,
            display: 'grid',
            gap: space[5],
          }}
        >
          {[
            'Three-pane workbook · contents, tutor chat, scratchpad',
            'Pressure-aware pen canvas with undo and erase',
            'Adaptive multi-choice with strand-level feedback',
          ].map((line) => (
            <li
              key={line}
              style={{
                fontSize: fontSize.body,
                color: color.ink.secondary,
                paddingLeft: space[7],
                position: 'relative',
                lineHeight: 1.5,
              }}
            >
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 7,
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: color.accent.primary,
                }}
              />
              {line}
            </li>
          ))}
        </ul>

        <Link
          href="/assessment"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: space[4],
            fontSize: fontSize.bodyLg,
            fontWeight: fontWeight.semibold,
            color: color.ink.onAccent,
            background: color.accent.primary,
            padding: `${space[5]}px ${space[8]}px`,
            borderRadius: radius.md,
            textDecoration: 'none',
            transition: 'background 200ms cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: shadow.sm,
          }}
        >
          Start the assessment
          <span aria-hidden style={{ fontWeight: fontWeight.regular }}>→</span>
        </Link>
      </div>
    </main>
  );
}
