'use client';

import {
  type PointerEvent as ReactPointerEvent,
  type Ref,
  type WheelEvent as ReactWheelEvent,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import type { Stroke, StrokePoint } from '../_engine/types';

export type PaperKind = 'rule' | 'grid' | 'dot';
export type CanvasTool = 'pen' | 'erase';

export interface PenCanvasHandle {
  undo: () => void;
  clear: () => void;
  snapshot: () => string | undefined;
  /**
   * Returns a downscaled PNG data URL of the current canvas — used by the
   * tutor pipeline to ship the working to a lite vision model. Caps the
   * longest edge at `maxWidth` (default 1024px) to keep the request body
   * under the route's 1.2MB ceiling on Retina displays.
   */
  snapshotPng: (maxWidth?: number) => string | undefined;
  resetView: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
}

interface PenCanvasProps {
  width: number;
  height: number;
  tool?: CanvasTool;
  color?: string;
  strokes: Stroke[];
  onStrokesChange?: (next: Stroke[]) => void;
  paper?: PaperKind;
  /** Base stroke width in canvas-space px. Pressure scales 0.55× to 1.85×. */
  stroke?: number;
  /** Solid paper colour painted under the grid. */
  paperColor?: string;
  ref?: Ref<PenCanvasHandle>;
  /** Reports zoom changes upward so the toolbar can show a percentage. */
  onZoomChange?: (zoom: number) => void;
  /**
   * When true, single-finger touch starts a stroke (phone mode — finger is the
   * only input). When false (default), single-finger touch pans the view to
   * preserve palm rejection for Apple Pencil users on iPad.
   */
  touchDraws?: boolean;
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Pressure-aware infinite drawing surface.
 *
 * Coordinates in `Stroke.points` are stored in **canvas-space** (i.e. before
 * pan/zoom). The viewport is a window into the canvas plane; we render with a
 * single `ctx.setTransform(zoom*dpr, 0, 0, zoom*dpr, panX*dpr, panY*dpr)` so
 * strokes and the paper grid share one transform.
 *
 * Pointer routing:
 *   - `pen` / `mouse` → draw (mouse pans on shift+drag or middle-button)
 *   - `touch`         → behavior depends on `touchDraws`:
 *                       false (default, iPad+Pencil): 1 finger pans, 2 fingers
 *                         pinch-zoom; never draws (palm rejection).
 *                       true  (phone, no stylus): 1 finger draws, 2 fingers
 *                         pinch + pan.
 *
 * The default mirrors iPadOS Notes / Procreate so a palm resting on the screen
 * never accidentally produces strokes when the learner is using an Apple Pencil.
 * On phones we flip to draw-on-touch because finger is the only available input.
 */
export function PenCanvas({
  width,
  height,
  tool = 'pen',
  color = '#1a1a1a',
  strokes,
  onStrokesChange,
  paper = 'rule',
  stroke = 1.6,
  paperColor = '#fdfbf3',
  ref,
  onZoomChange,
  touchDraws = false,
}: PenCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [current, setCurrent] = useState<Stroke | null>(null);
  const drawing = useRef(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  // Track all active touch pointers so we can detect 2-finger pinch.
  const touches = useRef<Map<number, { x: number; y: number }>>(new Map());
  // When pinch starts we snapshot the gesture origin so subsequent moves are
  // computed relative to it (otherwise zoom drifts as fingers wobble).
  const pinchStart = useRef<{
    distance: number;
    midX: number;
    midY: number;
    pan: { x: number; y: number };
    zoom: number;
  } | null>(null);
  // Mouse-pan state (shift+drag or middle-button).
  const mousePan = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => onZoomChange?.(zoom), [zoom, onZoomChange]);

  useImperativeHandle(
    ref,
    () => ({
      undo: () => onStrokesChange?.(strokes.slice(0, -1)),
      clear: () => onStrokesChange?.([]),
      snapshot: () => canvasRef.current?.toDataURL('image/png'),
      snapshotPng: (maxWidth = 1024) => {
        const c = canvasRef.current;
        if (!c || c.width === 0 || c.height === 0) return undefined;
        if (c.width <= maxWidth) return c.toDataURL('image/png');
        const scale = maxWidth / c.width;
        const off = document.createElement('canvas');
        off.width = maxWidth;
        off.height = Math.max(1, Math.round(c.height * scale));
        const ctx = off.getContext('2d');
        if (!ctx) return undefined;
        ctx.drawImage(c, 0, 0, off.width, off.height);
        return off.toDataURL('image/png');
      },
      resetView: () => {
        setPan({ x: 0, y: 0 });
        setZoom(1);
      },
      zoomIn: () => setZoom((z) => clamp(z * 1.25, MIN_ZOOM, MAX_ZOOM)),
      zoomOut: () => setZoom((z) => clamp(z / 1.25, MIN_ZOOM, MAX_ZOOM)),
    }),
    [strokes, onStrokesChange],
  );

  // Single render pass: paper fill → grid in canvas-space → all strokes.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.max(1, width * dpr);
    c.height = Math.max(1, height * dpr);
    c.style.width = `${width}px`;
    c.style.height = `${height}px`;

    // Paint paper in viewport-space first so it covers the whole visible area
    // regardless of pan/zoom (gives the canvas a solid base colour).
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = paperColor;
    ctx.fillRect(0, 0, width, height);

    // Switch to canvas-space (origin = canvas (0,0); pan/zoom applied).
    ctx.setTransform(zoom * dpr, 0, 0, zoom * dpr, pan.x * dpr, pan.y * dpr);

    // Compute the canvas-space rect currently visible so we only draw grid
    // lines/dots within bounds (saves draw calls when zoomed in).
    const viewMinX = -pan.x / zoom;
    const viewMinY = -pan.y / zoom;
    const viewMaxX = (width - pan.x) / zoom;
    const viewMaxY = (height - pan.y) / zoom;

    if (paper === 'rule') {
      ctx.strokeStyle = 'rgba(120,160,210,0.32)';
      ctx.lineWidth = 1 / zoom;
      const startY = Math.floor(viewMinY / 28) * 28;
      for (let y = startY; y < viewMaxY; y += 28) {
        ctx.beginPath();
        ctx.moveTo(viewMinX, y);
        ctx.lineTo(viewMaxX, y);
        ctx.stroke();
      }
      // Margin rule line at canvas-space x=48 (only render when in view).
      if (viewMinX <= 48 && viewMaxX >= 48) {
        ctx.strokeStyle = 'rgba(220,80,80,0.3)';
        ctx.beginPath();
        ctx.moveTo(48, viewMinY);
        ctx.lineTo(48, viewMaxY);
        ctx.stroke();
      }
    } else if (paper === 'grid') {
      ctx.strokeStyle = 'rgba(120,160,210,0.22)';
      ctx.lineWidth = 1 / zoom;
      const startX = Math.floor(viewMinX / 24) * 24;
      const startY = Math.floor(viewMinY / 24) * 24;
      for (let x = startX; x < viewMaxX; x += 24) {
        ctx.beginPath();
        ctx.moveTo(x, viewMinY);
        ctx.lineTo(x, viewMaxY);
        ctx.stroke();
      }
      for (let y = startY; y < viewMaxY; y += 24) {
        ctx.beginPath();
        ctx.moveTo(viewMinX, y);
        ctx.lineTo(viewMaxX, y);
        ctx.stroke();
      }
    } else if (paper === 'dot') {
      ctx.fillStyle = 'rgba(120,140,180,0.4)';
      const startX = Math.floor(viewMinX / 24) * 24;
      const startY = Math.floor(viewMinY / 24) * 24;
      for (let x = startX; x < viewMaxX; x += 24) {
        for (let y = startY; y < viewMaxY; y += 24) {
          ctx.beginPath();
          ctx.arc(x, y, 1 / zoom, 0, 6.3);
          ctx.fill();
        }
      }
    }

    // Render committed + in-flight strokes.
    const all = current ? [...strokes, current] : strokes;
    for (const s of all) {
      if (s.tool === 'erase') continue;
      ctx.strokeStyle = s.color;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let i = 0; i < s.points.length; i++) {
        const p = s.points[i]!;
        const w = (s.stroke || stroke) * (0.55 + (p.p || 0.5) * 1.3);
        ctx.lineWidth = w;
        if (i === 0) {
          ctx.moveTo(p.x, p.y);
        } else {
          const prev = s.points[i - 1]!;
          const mx = (prev.x + p.x) / 2;
          const my = (prev.y + p.y) / 2;
          ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
        }
      }
      ctx.stroke();
    }
  }, [strokes, current, width, height, paper, paperColor, stroke, pan, zoom]);

  /** Convert a viewport-space pointer event into a canvas-space stroke point. */
  const pt = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>): StrokePoint => {
      const r = canvasRef.current!.getBoundingClientRect();
      const vx = e.clientX - r.left;
      const vy = e.clientY - r.top;
      return {
        x: (vx - pan.x) / zoom,
        y: (vy - pan.y) / zoom,
        p: e.pressure > 0 ? e.pressure : 0.5,
      };
    },
    [pan, zoom],
  );

  function down(e: ReactPointerEvent<HTMLCanvasElement>) {
    // Touch events branch on `touchDraws`. The 2-finger path is identical
    // either way (pinch + pan); only single-finger differs.
    if (e.pointerType === 'touch') {
      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.current.size === 2) {
        const arr = Array.from(touches.current.values());
        const a = arr[0]!;
        const b = arr[1]!;
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        const r = canvasRef.current!.getBoundingClientRect();
        pinchStart.current = {
          distance,
          midX: (a.x + b.x) / 2 - r.left,
          midY: (a.y + b.y) / 2 - r.top,
          pan,
          zoom,
        };
        // Abort any half-finished stroke if a second finger lands. Critical
        // for the phone path: the user might land 2 fingers in quick succession
        // intending to pinch — we don't want the brief 1-finger window to
        // commit a tiny stroke.
        drawing.current = false;
        setCurrent(null);
      } else if (touches.current.size === 1 && touchDraws) {
        // Phone path: single finger starts a stroke. Mirror the pen primary
        // path below — capture the pointer so the stroke continues if the
        // finger drifts off the canvas edge.
        e.preventDefault();
        canvasRef.current?.setPointerCapture(e.pointerId);
        drawing.current = true;
        setCurrent({
          tool,
          color: tool === 'erase' ? '#ffffff' : color,
          stroke,
          points: [pt(e)],
        });
      }
      return;
    }

    // Mouse: shift+drag or middle button = pan.
    if (e.pointerType === 'mouse' && (e.shiftKey || e.button === 1)) {
      e.preventDefault();
      canvasRef.current?.setPointerCapture(e.pointerId);
      mousePan.current = { x: e.clientX, y: e.clientY };
      return;
    }

    // Pen / mouse-primary: draw.
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    drawing.current = true;
    setCurrent({
      tool,
      color: tool === 'erase' ? '#ffffff' : color,
      stroke,
      points: [pt(e)],
    });
  }

  function move(e: ReactPointerEvent<HTMLCanvasElement>) {
    // Touch path: pan or pinch.
    if (e.pointerType === 'touch') {
      if (!touches.current.has(e.pointerId)) return;
      const prev = touches.current.get(e.pointerId)!;
      touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (touches.current.size >= 2 && pinchStart.current) {
        // Two-finger pinch: zoom around the original midpoint, also pan to
        // keep that midpoint anchored under the fingers.
        const arr = Array.from(touches.current.values());
        const a = arr[0]!;
        const b = arr[1]!;
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        const newZoom = clamp(
          pinchStart.current.zoom * (distance / pinchStart.current.distance),
          MIN_ZOOM,
          MAX_ZOOM,
        );
        const ratio = newZoom / pinchStart.current.zoom;
        // The canvas-space point that started under the midpoint must stay
        // there: newPan = mid - (mid - oldPan) * ratio
        setZoom(newZoom);
        setPan({
          x:
            pinchStart.current.midX -
            (pinchStart.current.midX - pinchStart.current.pan.x) * ratio,
          y:
            pinchStart.current.midY -
            (pinchStart.current.midY - pinchStart.current.pan.y) * ratio,
        });
      } else if (touches.current.size === 1) {
        if (touchDraws && drawing.current) {
          // Phone path: single finger continues the stroke. Mirror the pen
          // path below — append a point and run the eraser hit-test in
          // canvas-space.
          const p = pt(e);
          setCurrent((c) => (c ? { ...c, points: [...c.points, p] } : c));
          if (tool === 'erase') {
            const r = 16 / zoom;
            onStrokesChange?.(
              strokes.filter(
                (s) =>
                  !s.points.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < r),
              ),
            );
          }
        } else {
          // iPad-with-Pencil path: single-finger pan.
          const dx = e.clientX - prev.x;
          const dy = e.clientY - prev.y;
          setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
        }
      }
      return;
    }

    // Mouse pan in progress.
    if (mousePan.current) {
      const dx = e.clientX - mousePan.current.x;
      const dy = e.clientY - mousePan.current.y;
      mousePan.current = { x: e.clientX, y: e.clientY };
      setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
      return;
    }

    if (!drawing.current) return;
    const p = pt(e);
    setCurrent((c) => (c ? { ...c, points: [...c.points, p] } : c));
    if (tool === 'erase') {
      // Eraser hit-test in canvas-space; threshold scales inversely with zoom
      // so the eraser feels the same size visually at any zoom level.
      const r = 16 / zoom;
      onStrokesChange?.(
        strokes.filter(
          (s) => !s.points.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < r),
        ),
      );
    }
  }

  function up(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (e.pointerType === 'touch') {
      touches.current.delete(e.pointerId);
      if (touches.current.size < 2) pinchStart.current = null;
      // Phone path: if this touch was drawing a stroke, finalize it. Mirrors
      // the pen finalize block below. `drawing.current` is only true here when
      // touchDraws was on AND the stroke wasn't aborted by a 2nd finger.
      if (drawing.current) {
        drawing.current = false;
        setCurrent((c) => {
          if (c && c.tool !== 'erase' && c.points.length > 1) {
            onStrokesChange?.([...strokes, c]);
          }
          return null;
        });
      }
      return;
    }
    if (mousePan.current) {
      mousePan.current = null;
      return;
    }
    if (!drawing.current) return;
    drawing.current = false;
    setCurrent((c) => {
      if (c && c.tool !== 'erase' && c.points.length > 1) {
        onStrokesChange?.([...strokes, c]);
      }
      return null;
    });
  }

  function onWheel(e: ReactWheelEvent<HTMLCanvasElement>) {
    if (e.ctrlKey || e.metaKey) {
      // Cursor-anchored zoom (matches Figma / Miro / Notion canvas).
      const r = canvasRef.current!.getBoundingClientRect();
      const vx = e.clientX - r.left;
      const vy = e.clientY - r.top;
      const factor = Math.exp(-e.deltaY * 0.002);
      const newZoom = clamp(zoom * factor, MIN_ZOOM, MAX_ZOOM);
      const ratio = newZoom / zoom;
      setZoom(newZoom);
      setPan({
        x: vx - (vx - pan.x) * ratio,
        y: vy - (vy - pan.y) * ratio,
      });
    } else {
      setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    }
  }

  return (
    <canvas
      ref={canvasRef}
      style={{
        touchAction: 'none',
        cursor: tool === 'erase' ? 'cell' : 'crosshair',
        display: 'block',
        // Block iOS native text-selection callout (Copy/Look Up) that Apple
        // Pencil hover-tap can otherwise trigger near interactive UI chrome.
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onPointerLeave={up}
      onWheel={onWheel}
    />
  );
}

interface PenCanvasAutoProps {
  tool?: CanvasTool;
  color?: string;
  strokes: Stroke[];
  onStrokesChange?: (next: Stroke[]) => void;
  paper?: PaperKind;
  paperColor?: string;
  stroke?: number;
  canvasRef?: Ref<PenCanvasHandle>;
  onZoomChange?: (zoom: number) => void;
  touchDraws?: boolean;
}

export function PenCanvasAuto({
  tool,
  color,
  strokes,
  onStrokesChange,
  paper,
  paperColor,
  stroke,
  canvasRef,
  onZoomChange,
  touchDraws,
}: PenCanvasAutoProps) {
  const wrap = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) setSize({ w: r.width, h: r.height });
    const ro = new ResizeObserver(([e]) => {
      if (!e) return;
      const cr = e.contentRect;
      if (cr.width > 0 && cr.height > 0) setSize({ w: cr.width, h: cr.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={wrap}
      style={{
        position: 'absolute',
        inset: 0,
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
    >
      {size.w > 0 && size.h > 0 && (
        <PenCanvas
          ref={canvasRef}
          width={size.w}
          height={size.h}
          tool={tool}
          color={color}
          strokes={strokes}
          onStrokesChange={onStrokesChange}
          paper={paper}
          paperColor={paperColor}
          stroke={stroke}
          onZoomChange={onZoomChange}
          touchDraws={touchDraws}
        />
      )}
    </div>
  );
}
