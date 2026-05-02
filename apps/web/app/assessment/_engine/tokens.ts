/**
 * Design tokens — modern, clean foundation.
 *
 * Palette: zinc neutral surface · indigo accent · emerald/rose feedback.
 * Typography: Inter (one family, weight-driven hierarchy).
 * Elevation: layered subtle shadows, no hand-drawn wobble.
 */

export const color = {
  bg: {
    canvas: '#fafafa',
    surface: '#ffffff',
    muted: '#f4f4f5',
    subtle: '#f9fafb',
    sidebar: '#fafafa',
    inverse: '#18181b',
  },
  border: {
    subtle: '#f1f5f9',
    default: '#e4e4e7',
    strong: '#d4d4d8',
    focus: '#6366f1',
  },
  ink: {
    primary: '#18181b',
    secondary: '#3f3f46',
    muted: '#52525b',
    soft: '#71717a',
    faint: '#a1a1aa',
    onAccent: '#ffffff',
  },
  accent: {
    primary: '#4f46e5',
    primaryHover: '#4338ca',
    primarySoft: '#eef2ff',
    primaryEdge: '#c7d2fe',
    primaryInk: '#3730a3',
  },
  feedback: {
    goodBg: '#ecfdf5',
    goodInk: '#047857',
    goodEdge: '#a7f3d0',
    warnBg: '#fffbeb',
    warnInk: '#b45309',
    warnEdge: '#fcd34d',
    badBg: '#fef2f2',
    badInk: '#b91c1c',
    badEdge: '#fecaca',
    infoBg: '#eff6ff',
    infoInk: '#1d4ed8',
    infoEdge: '#bfdbfe',
  },
  // Kept for canvas drawing — not used in chrome.
  pen: {
    black: '#18181b',
    blue: '#2563eb',
    red: '#dc2626',
    green: '#059669',
    amber: '#d97706',
  },
  // Legacy aliases so existing components compile; map to modern surface.
  // Will be removed once all callsites migrate.
  paper: {
    cream: '#ffffff',
    creamSoft: '#fafafa',
    creamSidebar: '#fafafa',
    creamPage: '#fafafa',
  },
  frame: {
    wood: '#18181b',
    woodEdge: '#27272a',
    woodLetterbox: '#0a0a0a',
    woodInk: '#fafafa',
    woodInkMuted: '#a1a1aa',
  },
  highlight: {
    yellow: '#eef2ff',
    yellowSoft: '#f5f3ff',
    yellowEdge: '#c7d2fe',
    yellowEdgeStrong: '#6366f1',
  },
} as const;

export const font = {
  sans: "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
  display:
    "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
  handwrite:
    "'Inter', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
  mono: "ui-monospace, SFMono-Regular, 'JetBrains Mono', Menlo, monospace",
} as const;

export const fontWeight = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

export const fontSize = {
  micro: 11,
  tiny: 12,
  small: 13,
  body: 14,
  bodyLg: 15,
  label: 13,
  lead: 16,
  h4: 17,
  h3: 20,
  h2: 24,
  h1: 32,
  celebration: 64,
} as const;

export const space = {
  0: 0,
  1: 2,
  2: 4,
  3: 6,
  4: 8,
  5: 12,
  6: 16,
  7: 20,
  8: 24,
  10: 32,
  12: 40,
  16: 56,
} as const;

export const radius = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 999,
} as const;

// Legacy alias for back-compat.
export const stroke = {
  hairline: 1,
  thin: 1,
  regular: 1,
  bold: 1.5,
  heavy: 2,
} as const;

export const motion = {
  fast: '120ms cubic-bezier(0.4, 0, 0.2, 1)',
  base: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '320ms cubic-bezier(0.4, 0, 0.2, 1)',
} as const;

export const shadow = {
  xs: '0 1px 2px rgba(15, 23, 42, 0.04)',
  sm: '0 1px 3px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)',
  md: '0 4px 12px rgba(15, 23, 42, 0.06), 0 2px 4px rgba(15, 23, 42, 0.04)',
  lg: '0 12px 32px rgba(15, 23, 42, 0.08), 0 4px 8px rgba(15, 23, 42, 0.04)',
  focus: '0 0 0 3px rgba(99, 102, 241, 0.2)',
} as const;

// Legacy alias.
export const elevation = {
  binding: 'none',
  innerSpread: 'none',
  innerLeft: 'none',
  celebration: shadow.lg,
} as const;

export const dashedRule = `1px solid ${color.border.default}`;
export const inkBorder = `1px solid ${color.border.default}`;
export const focusRing = `0 0 0 3px rgba(99, 102, 241, 0.25)`;
