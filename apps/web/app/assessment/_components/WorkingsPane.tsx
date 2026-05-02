'use client';

import { type CSSProperties, useRef, useState } from 'react';
import {
  color,
  font,
  fontSize,
  fontWeight,
  motion as motionTokens,
  radius,
  shadow,
  space,
} from '../_engine/tokens';
import type { Mood, Question, Stroke } from '../_engine/types';
import {
  CameraGlyph,
  CrossGlyph,
  EraserGlyph,
  LightbulbGlyph,
  PageGlyph,
  PencilGlyph,
  SquiggleGlyph,
  TickGlyph,
  UndoGlyph,
} from './glyphs';
import {
  type CanvasTool,
  type PaperKind,
  type PenCanvasHandle,
  PenCanvasAuto,
} from './PenCanvas';
import { FeedbackRibbon, SketchBox, SketchBtn } from './primitives';

interface WorkingsPaneProps {
  activeQ: Question;
  qIndex: number;
  strokes: Stroke[];
  setStrokes: (next: Stroke[]) => void;
  ribbon: { text: string; mood: Mood } | null;
  tutorMood: Mood;
  onSubmit: (chosenIndex: 0 | 1 | 2 | 3) => void;
  paper: PaperKind;
  setPaper: (next: PaperKind) => void;
  penColor: string;
  setPenColor: (next: string) => void;
  pending: boolean;
}

const PEN_COLORS = [
  color.pen.black,
  color.pen.blue,
  color.pen.red,
  color.pen.green,
  color.pen.amber,
];

const PEN_COLOR_LABELS: Record<string, string> = {
  [color.pen.black]: 'Black',
  [color.pen.blue]: 'Blue',
  [color.pen.red]: 'Red',
  [color.pen.green]: 'Green',
  [color.pen.amber]: 'Amber',
};

const CHOICE_LETTERS = ['A', 'B', 'C', 'D'] as const;

const PAPER_LABEL: Record<PaperKind, string> = {
  rule: 'Ruled',
  grid: 'Grid',
  dot: 'Dot',
};

function paperBackground(kind: PaperKind): CSSProperties {
  if (kind === 'rule') {
    return {
      backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent 31px, ${color.border.subtle} 31px, ${color.border.subtle} 32px)`,
    };
  }
  if (kind === 'grid') {
    return {
      backgroundImage: `linear-gradient(${color.border.subtle} 1px, transparent 1px), linear-gradient(90deg, ${color.border.subtle} 1px, transparent 1px)`,
      backgroundSize: '24px 24px',
    };
  }
  return {
    backgroundImage: `radial-gradient(circle, ${color.border.default} 1px, transparent 1px)`,
    backgroundSize: '20px 20px',
    backgroundPosition: '10px 10px',
  };
}

export function WorkingsPane({
  activeQ,
  qIndex,
  strokes,
  setStrokes,
  ribbon,
  onSubmit,
  paper,
  setPaper,
  penColor,
  setPenColor,
  pending,
}: WorkingsPaneProps) {
  const [tool, setTool] = useState<CanvasTool>('pen');
  const canvasRef = useRef<PenCanvasHandle | null>(null);

  const isDone = activeQ.state === 'done';
  const choices = activeQ.choices ?? null;
  const cyclePaper = () =>
    setPaper(paper === 'rule' ? 'grid' : paper === 'grid' ? 'dot' : 'rule');

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        padding: `${space[6]}px ${space[7]}px`,
        gap: space[5],
        background: color.bg.surface,
      }}
    >
      {/* Question card */}
      <SketchBox
        elevation="sm"
        pad={0}
        radius={radius.lg}
        border={`1px solid ${color.border.default}`}
        style={{
          padding: `${space[6]}px ${space[7]}px`,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: space[4],
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              fontFamily: font.sans,
              fontSize: fontSize.micro,
              fontWeight: fontWeight.semibold,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: color.accent.primary,
            }}
          >
            Question {qIndex + 1}
          </span>
          {ribbon && <FeedbackRibbon text={ribbon.text} mood={ribbon.mood} />}
        </div>
        <div
          style={{
            fontFamily: font.sans,
            fontSize: fontSize.h3,
            fontWeight: fontWeight.regular,
            color: color.ink.primary,
            lineHeight: 1.5,
            marginTop: space[3],
            whiteSpace: 'pre-wrap',
          }}
        >
          {activeQ.prompt}
        </div>
      </SketchBox>

      {/* Multiple choice answers */}
      {choices ? (
        <div
          role="radiogroup"
          aria-label="Choose your answer"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: space[4],
          }}
        >
          {choices.map((text, i) => {
            const idx = i as 0 | 1 | 2 | 3;
            const isChosen = activeQ.chosenIndex === idx;
            const showResult = isDone && isChosen;
            const correct = activeQ.correct === true;
            const verdict: 'good' | 'bad' | undefined = showResult
              ? correct
                ? 'good'
                : 'bad'
              : undefined;
            return (
              <ChoiceButton
                key={i}
                letter={CHOICE_LETTERS[idx]}
                text={text}
                disabled={isDone || pending}
                pending={pending}
                chosen={isChosen}
                verdict={verdict}
                onClick={() => onSubmit(idx)}
              />
            );
          })}
        </div>
      ) : (
        <SketchBox
          elevation="xs"
          radius={radius.lg}
          border={`1px solid ${color.border.default}`}
          style={{
            padding: `${space[5]}px ${space[6]}px`,
            textAlign: 'center',
          }}
          pad={0}
        >
          <span
            style={{
              fontFamily: font.sans,
              fontSize: fontSize.body,
              color: color.ink.muted,
            }}
          >
            {pending
              ? 'Agent thinking…'
              : 'No choices on this question — keep working on the canvas.'}
          </span>
        </SketchBox>
      )}

      {/* Hint */}
      {activeQ.hint && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: space[3],
            padding: `${space[4]}px ${space[5]}px`,
            background: color.feedback.warnBg,
            border: `1px solid ${color.feedback.warnEdge}`,
            borderRadius: radius.md,
          }}
        >
          <LightbulbGlyph size={16} ink={color.feedback.warnInk} />
          <span
            style={{
              fontFamily: font.sans,
              fontSize: fontSize.body,
              color: color.feedback.warnInk,
              lineHeight: 1.5,
            }}
          >
            {activeQ.hint}
          </span>
        </div>
      )}

      {/* Tools row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: space[3],
          padding: `${space[4]}px 0`,
          borderTop: `1px solid ${color.border.subtle}`,
          flexWrap: 'wrap',
        }}
      >
        <SketchBtn
          small
          variant={tool === 'pen' ? 'secondary' : 'ghost'}
          active={tool === 'pen'}
          ariaPressed={tool === 'pen'}
          onClick={() => setTool('pen')}
          ariaLabel="Pen tool"
        >
          <PencilGlyph size={14} />
          <span>Pen</span>
        </SketchBtn>
        <SketchBtn
          small
          variant={tool === 'erase' ? 'secondary' : 'ghost'}
          active={tool === 'erase'}
          ariaPressed={tool === 'erase'}
          onClick={() => setTool('erase')}
          ariaLabel="Eraser tool"
        >
          <EraserGlyph size={14} />
          <span>Erase</span>
        </SketchBtn>
        <SketchBtn
          small
          variant="ghost"
          onClick={() => canvasRef.current?.undo()}
          ariaLabel="Undo last stroke"
        >
          <UndoGlyph size={14} />
          <span>Undo</span>
        </SketchBtn>

        <div
          role="radiogroup"
          aria-label="Pen color"
          style={{
            display: 'flex',
            gap: space[2],
            alignItems: 'center',
            paddingLeft: space[3],
            marginLeft: space[2],
            borderLeft: `1px solid ${color.border.subtle}`,
            height: 30,
          }}
        >
          {PEN_COLORS.map((c) => {
            const selected = penColor === c;
            return (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={`Pen color ${PEN_COLOR_LABELS[c] ?? c}`}
                onClick={() => setPenColor(c)}
                title={PEN_COLOR_LABELS[c] ?? c}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: radius.pill,
                  background: c,
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  flexShrink: 0,
                  boxShadow: selected
                    ? `0 0 0 2px ${color.bg.surface}, 0 0 0 4px ${color.accent.primary}`
                    : 'none',
                  transition: `box-shadow ${motionTokens.fast}`,
                }}
              />
            );
          })}
        </div>

        <div style={{ flex: 1 }} />

        <SketchBtn
          small
          variant="ghost"
          onClick={cyclePaper}
          ariaLabel={`Paper style: ${PAPER_LABEL[paper]}. Click to cycle.`}
          title={`Paper: ${PAPER_LABEL[paper]} (click to change)`}
        >
          {paper === 'rule' ? (
            <PageGlyph size={14} />
          ) : (
            <SquiggleGlyph size={14} />
          )}
          <span>{PAPER_LABEL[paper]}</span>
        </SketchBtn>
        <SketchBtn
          small
          variant="ghost"
          ariaLabel="Snapshot canvas"
          title="Snapshot canvas"
          onClick={() => canvasRef.current?.snapshot()}
        >
          <CameraGlyph size={14} />
        </SketchBtn>
      </div>

      {/* Canvas */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          position: 'relative',
          backgroundColor: color.bg.surface,
          border: `1px solid ${color.border.default}`,
          borderRadius: radius.lg,
          overflow: 'hidden',
          boxShadow: shadow.xs,
          ...paperBackground(paper),
        }}
      >
        <PenCanvasAuto
          canvasRef={canvasRef}
          tool={tool}
          color={penColor}
          strokes={strokes}
          onStrokesChange={setStrokes}
          paper={paper}
          paperColor="transparent"
        />
      </div>
    </div>
  );
}

function ChoiceButton({
  letter,
  text,
  disabled,
  pending,
  chosen,
  verdict,
  onClick,
}: {
  letter: string;
  text: string;
  disabled: boolean;
  pending: boolean;
  chosen: boolean;
  verdict?: 'good' | 'bad';
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);

  let bg: string = color.bg.surface;
  let border: string = color.border.default;
  let ink: string = color.ink.primary;

  if (verdict === 'good') {
    bg = color.feedback.goodBg;
    border = color.feedback.goodEdge;
    ink = color.feedback.goodInk;
  } else if (verdict === 'bad') {
    bg = color.feedback.badBg;
    border = color.feedback.badEdge;
    ink = color.feedback.badInk;
  } else if (hover && !disabled) {
    bg = color.accent.primarySoft;
    border = color.accent.primaryEdge;
  } else if (chosen && !disabled) {
    bg = color.accent.primarySoft;
    border = color.accent.primaryEdge;
  }

  const active = chosen || !!verdict;
  const badgeBg = active ? color.accent.primarySoft : color.bg.muted;
  const badgeInk = active ? color.accent.primary : color.ink.secondary;

  return (
    <button
      type="button"
      role="radio"
      aria-checked={chosen}
      aria-pressed={chosen}
      aria-disabled={pending}
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: radius.lg,
        padding: `${space[5]}px ${space[6]}px`,
        textAlign: 'left',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled && !verdict ? 0.6 : 1,
        display: 'flex',
        alignItems: 'center',
        gap: space[4],
        minHeight: 56,
        transition: `background ${motionTokens.fast}, border-color ${motionTokens.fast}`,
        color: ink,
        fontFamily: font.sans,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 24,
          height: 24,
          borderRadius: radius.sm,
          background: badgeBg,
          color: badgeInk,
          fontFamily: font.sans,
          fontSize: fontSize.tiny,
          fontWeight: fontWeight.semibold,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {letter}
      </span>
      <span
        style={{
          fontFamily: font.sans,
          fontSize: fontSize.body,
          fontWeight: fontWeight.regular,
          color: ink,
          lineHeight: 1.5,
          flex: 1,
          whiteSpace: 'pre-wrap',
        }}
      >
        {text}
      </span>
      {verdict === 'good' && (
        <TickGlyph size={18} ink={color.feedback.goodInk} />
      )}
      {verdict === 'bad' && (
        <CrossGlyph size={18} ink={color.feedback.badInk} />
      )}
    </button>
  );
}
