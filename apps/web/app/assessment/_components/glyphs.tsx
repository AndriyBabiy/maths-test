'use client';

/**
 * Lucide-style line glyphs on a 24×24 grid.
 * Modern, consistent stroke (1.6px), rounded line caps.
 */

import type { CSSProperties } from 'react';

interface SvgProps {
  size?: number;
  ink?: string;
  sw?: number;
  title: string;
  style?: CSSProperties;
  children: React.ReactNode;
}

function Svg({ size = 16, ink = 'currentColor', sw = 1.6, title, style, children }: SvgProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={ink}
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={title}
      style={{ display: 'block', flexShrink: 0, ...style }}
    >
      <title>{title}</title>
      {children}
    </svg>
  );
}

type GlyphProps = Omit<SvgProps, 'title' | 'children'> & { title?: string };

export function NotebookGlyph(props: GlyphProps) {
  return (
    <Svg title={props.title ?? 'Notebook'} {...props}>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 3v18" />
      <path d="M11 8h6M11 12h6M11 16h4" />
    </Svg>
  );
}

export function ClockGlyph(props: GlyphProps) {
  return (
    <Svg title={props.title ?? 'Time'} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Svg>
  );
}

export function TickGlyph(props: GlyphProps) {
  return (
    <Svg title={props.title ?? 'Correct'} {...props}>
      <path d="M5 12.5l4 4L19 7" />
    </Svg>
  );
}

export function CrossGlyph(props: GlyphProps) {
  return (
    <Svg title={props.title ?? 'Wrong'} {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Svg>
  );
}

export function FlameGlyph(props: GlyphProps) {
  return (
    <Svg title={props.title ?? 'Streak'} {...props}>
      <path d="M12 3c2 3 1 5 3 7s3 3 3 6a6 6 0 1 1-12 0c0-2 1-3 2-4s1-3 0-5c2 1 3 0 4-4z" />
    </Svg>
  );
}

export function ResetGlyph(props: GlyphProps) {
  return (
    <Svg title={props.title ?? 'Reset'} {...props}>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
    </Svg>
  );
}

export function UndoGlyph(props: GlyphProps) {
  return (
    <Svg title={props.title ?? 'Undo'} {...props}>
      <path d="M9 14l-4-4 4-4" />
      <path d="M5 10h9a5 5 0 0 1 0 10h-3" />
    </Svg>
  );
}

export function PencilGlyph(props: GlyphProps) {
  return (
    <Svg title={props.title ?? 'Pencil'} {...props}>
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z" />
    </Svg>
  );
}

export function EraserGlyph(props: GlyphProps) {
  return (
    <Svg title={props.title ?? 'Eraser'} {...props}>
      <path d="M3 17l6 6h11" />
      <path d="M14 4l7 7-9 9-7-7z" />
    </Svg>
  );
}

export function CameraGlyph(props: GlyphProps) {
  return (
    <Svg title={props.title ?? 'Snapshot'} {...props}>
      <path d="M3 8a2 2 0 0 1 2-2h2l2-2h6l2 2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <circle cx="12" cy="13" r="3.5" />
    </Svg>
  );
}

export function SquiggleGlyph(props: GlyphProps) {
  return (
    <Svg title={props.title ?? 'Lines'} {...props}>
      <path d="M3 8h18M3 12h18M3 16h12" />
    </Svg>
  );
}

export function SendGlyph(props: GlyphProps) {
  return (
    <Svg title={props.title ?? 'Send'} {...props}>
      <path d="M22 2L11 13" />
      <path d="M22 2l-7 20-4-9-9-4z" />
    </Svg>
  );
}

export function LockGlyph(props: GlyphProps) {
  return (
    <Svg title={props.title ?? 'Locked'} {...props}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </Svg>
  );
}

export function LightbulbGlyph(props: GlyphProps) {
  return (
    <Svg title={props.title ?? 'Hint'} {...props}>
      <path d="M9 18h6" />
      <path d="M10 21h4" />
      <path d="M12 3a6 6 0 0 1 4 10c-1 1-1.5 2-1.5 3h-5c0-1-.5-2-1.5-3a6 6 0 0 1 4-10z" />
    </Svg>
  );
}

export function ChartGlyph(props: GlyphProps) {
  return (
    <Svg title={props.title ?? 'Score'} {...props}>
      <path d="M4 20h16" />
      <path d="M7 20v-6M12 20V8M17 20v-9" />
    </Svg>
  );
}

export function PageGlyph(props: GlyphProps) {
  return (
    <Svg title={props.title ?? 'Page'} {...props}>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6" />
    </Svg>
  );
}

export function ChevronDownGlyph(props: GlyphProps) {
  return (
    <Svg title={props.title ?? 'Expand'} {...props}>
      <path d="M6 9l6 6 6-6" />
    </Svg>
  );
}

export function ChevronRightGlyph(props: GlyphProps) {
  return (
    <Svg title={props.title ?? 'Collapse'} {...props}>
      <path d="M9 6l6 6-6 6" />
    </Svg>
  );
}

export function CircleDotGlyph(props: GlyphProps) {
  return (
    <Svg title={props.title ?? 'Active'} {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function CircleGlyph(props: GlyphProps) {
  return (
    <Svg title={props.title ?? 'Pending'} {...props}>
      <circle cx="12" cy="12" r="9" />
    </Svg>
  );
}
