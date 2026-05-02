import { LuaSkill } from 'lua-cli';
import { GetSessionState } from './tools/GetSessionState';
import { DetectStage } from './tools/DetectStage';
import { PickNextItem } from './tools/PickNextItem';
import { ScoreAnswer } from './tools/ScoreAnswer';
import { FinaliseAssessment } from './tools/FinaliseAssessment';

export const diagnosticSkill = new LuaSkill({
  name: 'maths-diagnostic',
  description: 'Adaptive maths assessment for Irish Project Maths curriculum.',
  context:
    'Use these tools to drive a Rasch-adaptive diagnostic test. ' +
    'Always call get_session_state first. Never compute theta yourself.',
  tools: [
    new GetSessionState(),
    new DetectStage(),
    new PickNextItem(),
    new ScoreAnswer(),
    new FinaliseAssessment(),
  ],
});
