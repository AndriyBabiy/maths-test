import type { LuaTool } from 'lua-cli';
import { z } from 'zod';
import type { Strand } from '@maths-diag/core';
import { stripLatex } from '../latex.js';
import { ALL_ITEMS, engine, sessions } from '../runtime.js';

export class PickNextItem implements LuaTool {
  name = 'pick_next_item';
  description =
    'Math layer chooses the next item with b ≈ theta_strand. Call after every answer ' +
    'once stage is known. Returns the chosen Item, or signals that the bank is sparse ' +
    'and generate_item should be used instead.';
  inputSchema = z.object({
    sessionId: z.string(),
    strand: z.enum([
      'number',
      'algebra',
      'geometry_trig',
      'functions',
      'statistics_prob',
      'measures_data',
    ]),
  });

  async execute(input: { sessionId: string; strand: Strand }): Promise<unknown> {
    const { sessionId, strand } = input;
    const state = await sessions.get(sessionId);
    if (!state) {
      throw new Error(`[pick_next_item] Unknown session: ${sessionId}`);
    }

    const item = engine.pickItem([...ALL_ITEMS], state, strand);

    if (item === null) {
      throw new Error(
        `[pick_next_item] No anchor within tolerance for strand=${strand}. ` +
          `Bank is too sparse for this (theta, strand) cell.`,
      );
    }

    // Pre-process LaTeX to readable text. The heylua.ai chat UI doesn't
    // render `$\frac{...}$`-style maths, so the question line shows blank
    // there. Stripping at the tool boundary keeps the source items KaTeX-
    // ready for richer UIs while staying safe for the current chat shell.
    const renderedItem = {
      ...item,
      text: stripLatex(item.text),
      choices: item.choices.map((c) => stripLatex(c)) as [
        string,
        string,
        string,
        string,
      ],
    };

    // Returns the full Item including correctIndex. The API glue layer is
    // expected to strip correctIndex before the payload reaches the UI.
    return { item: renderedItem };
  }
}
