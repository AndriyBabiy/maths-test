'use client';

import {
  type PointerEvent as ReactPointerEvent,
  type Ref,
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
}

interface PenCanvasProps {
  width: number;
  height: number;
  tool?: CanvasTool;
  color?: string;
  strokes: Stroke[];
  onStrokesChange?: (next: Stroke[]) => void;
  paper?: PaperKind;
  stroke?: number;
  paperColor?: string;
  ref?: Ref<PenCanvasHandle>;
}

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
}: PenCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [current, setCurrent] = useState<Stroke | null>(null);
  const drawing = useRef(false);

  useImperativeHandle(
    ref,
    () => ({
      undo: () => onStrokesChange?.(strokes.slice(0, -1)),
      clear: () => onStrokesChange?.([]),
      snapshot: () => canvasRef.current?.toDataURL('image/png'),
    }),
    [strokes, onStrokesChange],
  );

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
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = paperColor;
    ctx.fillRect(0, 0, width, height);

    if (paper === 'rule') {
      ctx.strokeStyle = 'rgba(120,160,210,0.32)';
      ctx.lineWidth = 1;
      for (let y = 32; y < height; y += 28) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(220,80,80,0.3)';
      ctx.beginPath();
      ctx.moveTo(48, 0);
      ctx.lineTo(48, height);
      ctx.stroke();
    } else if (paper === 'grid') {
      ctx.strokeStyle = 'rgba(120,160,210,0.22)';
      ctx.lineWidth = 1;
      for (let x = 24; x < width; x += 24) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 24; y < height; y += 24) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
    } else if (paper === 'dot') {
      ctx.fillStyle = 'rgba(120,140,180,0.4)';
      for (let x = 24; x < width; x += 24)
        for (let y = 24; y < height; y += 24) {
          ctx.beginPath();
          ctx.arc(x, y, 1, 0, 6.3);
          ctx.fill();
        }
    }

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
  }, [strokes, current, width, height, paper, paperColor, stroke]);

  function pt(e: ReactPointerEvent<HTMLCanvasElement>): StrokePoint {
    const r = canvasRef.current!.getBoundingClientRect();
    return {
      x: e.clientX - r.left,
      y: e.clientY - r.top,
      p: e.pressure > 0 ? e.pressure : 0.5,
    };
  }

  function down(e: ReactPointerEvent<HTMLCanvasElement>) {
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
    if (!drawing.current) return;
    const p = pt(e);
    setCurrent((c) => (c ? { ...c, points: [...c.points, p] } : c));
    if (tool === 'erase') {
      onStrokesChange?.(
        strokes.filter(
          (s) => !s.points.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 16),
        ),
      );
    }
  }

  function up() {
    if (!drawing.current) return;
    drawing.current = false;
    setCurrent((c) => {
      if (c && c.tool !== 'erase' && c.points.length > 1) {
        onStrokesChange?.([...strokes, c]);
      }
      return null;
    });
  }

  return (
    <canvas
      ref={canvasRef}
      style={{
        touchAction: 'none',
        cursor: tool === 'erase' ? 'cell' : 'crosshair',
        display: 'block',
      }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onPointerLeave={up}
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
  canvasRef?: Ref<PenCanvasHandle>;
}

export function PenCanvasAuto({
  tool,
  color,
  strokes,
  onStrokesChange,
  paper,
  paperColor,
  canvasRef,
}: PenCanvasAutoProps) {
  const wrap = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    // Set initial size synchronously so canvas mounts on first paint.
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
    <div ref={wrap} style={{ position: 'absolute', inset: 0 }}>
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
        />
      )}
    </div>
  );
}
