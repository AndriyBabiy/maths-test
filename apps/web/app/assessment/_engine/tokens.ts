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

// ─── Responsive primitives ─────────────────────────────────────────
// These ADD to the system; existing tokens above remain unchanged.

export const breakpoints = {
  sm: 375,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

export const media = {
  sm: `@media (min-width: ${breakpoints.sm}px)`,
  md: `@media (min-width: ${breakpoints.md}px)`,
  lg: `@media (min-width: ${breakpoints.lg}px)`,
  xl: `@media (min-width: ${breakpoints.xl}px)`,
  touch: '@media (hover: none) and (pointer: coarse)',
  pointer: '@media (hover: hover) and (pointer: fine)',
  reducedMotion: '@media (prefers-reduced-motion: reduce)',
} as const;

// Touch-target sizing: WCAG 2.5.5 target size is 44×44 CSS px on coarse
// pointers; on fine-pointer (mouse) UIs we relax to 32px to stay dense.
export const tap = {
  touch: 44,
  pointer: 32,
} as const;

// Fluid type scale — clamps each step of `fontSize` so 14px body grows to
// ~16px on desktop while never dipping below readable mobile minimums.
// Each entry mirrors a key in `fontSize` so callers can swap in CSS.
export const fontSizeFluid = {
  micro: 'clamp(10px, 0.625rem + 0.1vw, 12px)',
  tiny: 'clamp(11px, 0.6875rem + 0.1vw, 13px)',
  small: 'clamp(12px, 0.75rem + 0.1vw, 14px)',
  body: 'clamp(13px, 0.8125rem + 0.15vw, 16px)',
  bodyLg: 'clamp(14px, 0.875rem + 0.15vw, 17px)',
  label: 'clamp(12px, 0.75rem + 0.1vw, 14px)',
  lead: 'clamp(15px, 0.9375rem + 0.2vw, 18px)',
  h4: 'clamp(15px, 0.9375rem + 0.25vw, 19px)',
  h3: 'clamp(17px, 1.0625rem + 0.4vw, 22px)',
  h2: 'clamp(20px, 1.25rem + 0.6vw, 28px)',
  h1: 'clamp(24px, 1.5rem + 1vw, 36px)',
  celebration: 'clamp(40px, 2.5rem + 3vw, 72px)',
} as const;

// Fluid spacing ramp — string-valued counterpart to `space` numeric ramp.
// Padding / gap values that should breathe between mobile and desktop
// without media queries.
export const spaceFluid = {
  0: '0px',
  1: 'clamp(2px, 0.125rem + 0.05vw, 4px)',
  2: 'clamp(3px, 0.1875rem + 0.05vw, 6px)',
  3: 'clamp(4px, 0.25rem + 0.1vw, 8px)',
  4: 'clamp(6px, 0.375rem + 0.15vw, 12px)',
  5: 'clamp(8px, 0.5rem + 0.25vw, 16px)',
  6: 'clamp(12px, 0.75rem + 0.4vw, 22px)',
  7: 'clamp(14px, 0.875rem + 0.5vw, 28px)',
  8: 'clamp(16px, 1rem + 0.75vw, 36px)',
  10: 'clamp(20px, 1.25rem + 1vw, 48px)',
  12: 'clamp(24px, 1.5rem + 1.25vw, 60px)',
  16: 'clamp(32px, 2rem + 2vw, 80px)',
} as const;

// Container width ramp — useful for stage / panel `max-width`.
export const containerWidth = {
  sm: 480,
  md: 720,
  lg: 960,
  xl: 1200,
  xxl: 1440,
} as const;

export type Breakpoint = keyof typeof breakpoints;
export type FontSizeFluid = keyof typeof fontSizeFluid;
export type SpaceFluid = keyof typeof spaceFluid;
