import { randomInt } from 'node:crypto';
import { noviceQuestions } from '../src/lib/data/questions/novice.js';
import { systemsQuestions } from '../src/lib/data/questions/systems.js';
import { acmQuestions } from '../src/lib/data/questions/acm.js';
import { faqQuestions } from '../src/lib/data/questions/faq.js';
import { documentQuestions } from '../src/lib/data/questions/document.js';
import { TIERS } from '../src/lib/data/tiers.js';
import { ROUNDS_PER_TIER } from '../src/lib/data/types.js';
import type { RankedAction, RankedRun } from '../src/lib/ranked-types.js';

export const bank = [...noviceQuestions, ...systemsQuestions, ...acmQuestions, ...faqQuestions, ...documentQuestions];
export interface RunState {
  handle: string;
  phase: RankedRun['phase'];
  tierIndex: number;
  progress: number;
  lives: number;
  score: number;
  correct: number;
  answered: number;
  combo: number;
  bestCombo: number;
  cleared: boolean;
  jokers: number;
  hint: boolean;
  eliminated: number[];
  deadline: number;
  used: string[];
  questionId: string;
  order: number[];
  feedback: RankedRun['feedback'];
}

export class InputError extends Error {}
function shuffle<T>(input: T[]): T[] {
  const result = [...input];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function source(state: RunState) {
  const q = bank.find(q => q.id === state.questionId);
  if (!q) throw new Error('Question no longer exists');
  return q;
}
function draw(state: RunState, now: number) {
  const pool = bank.filter(q => q.tier === TIERS[state.tierIndex].id && !state.used.includes(q.id));
  const q = pool[randomInt(pool.length)];
  state.questionId = q.id;
  state.used.push(q.id);
  state.order = shuffle(q.zh.options.map((_, i) => i));
  state.deadline = now + TIERS[state.tierIndex].timeLimit * 1000;
  state.phase = 'question';
  state.feedback = null;
  state.hint = false;
  state.eliminated = [];
}
export function createRun(handle: unknown, now: number): RunState {
  if (typeof handle !== 'string') throw new InputError('Invalid name');
  const clean = handle.normalize('NFKC').trim();
  if (!clean || clean.length > 24 || /[\p{Cc}\p{Cf}]/u.test(clean)) throw new InputError('Invalid name');
  const state: RunState = {
    handle: clean, phase: 'question', tierIndex: 0, progress: 0, lives: TIERS[0].allowMiss,
    score: 0, correct: 0, answered: 0, combo: 0, bestCombo: 0, cleared: false,
    jokers: 3, hint: false, eliminated: [], deadline: now, used: [], questionId: '', order: [], feedback: null,
  };
  draw(state, now);
  return state;
}
export function transition(state: RunState, action: RankedAction, choice: unknown, now: number): RunState {
  const next = structuredClone(state);
  if (action === 'abandon') {
    if (next.phase !== 'over') next.phase = 'abandoned';
    return next;
  }
  if (next.phase === 'over' || next.phase === 'abandoned') return next;
  if (next.phase === 'question' && now >= next.deadline) return answer(next, -1, now);
  if (action === 'read') return next;
  if (action === 'next') {
    if (next.phase !== 'review') throw new InputError('Answer first');
    if (next.progress >= ROUNDS_PER_TIER) {
      next.tierIndex++;
      next.progress = 0;
      next.lives = TIERS[next.tierIndex].allowMiss;
    }
    draw(next, now);
    return next;
  }
  if (next.phase !== 'question') throw new InputError('Question already answered');
  if (action === 'answer') {
    if (!Number.isInteger(choice) || Number(choice) < 0 || Number(choice) >= next.order.length || next.eliminated.includes(Number(choice))) {
      throw new InputError('Invalid answer');
    }
    return answer(next, Number(choice), now);
  }
  if (!['hint', 'freeze', 'fifty'].includes(action) || next.jokers <= 0) throw new InputError('Joker unavailable');
  if (action === 'hint') {
    if (next.hint) throw new InputError('Hint already used');
    next.hint = true;
  } else if (action === 'freeze') {
    next.deadline = Math.min(now + TIERS[next.tierIndex].timeLimit * 1000, next.deadline + 15000);
  } else {
    if (next.eliminated.length) throw new InputError('Already eliminated');
    const correct = next.order.indexOf(source(next).answer);
    next.eliminated = shuffle(next.order.map((_, i) => i).filter(i => i !== correct)).slice(0, 2);
  }
  next.jokers--;
  return next;
}
function answer(state: RunState, picked: number, now: number): RunState {
  const tier = TIERS[state.tierIndex];
  const answer = state.order.indexOf(source(state).answer);
  const timeout = now >= state.deadline;
  const correct = !timeout && picked === answer;
  let gain = 0;
  state.answered++;
  if (correct) {
    state.combo++;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    const remaining = Math.min(1, Math.max(0, (state.deadline - now) / (tier.timeLimit * 1000)));
    gain = Math.round(tier.baseScore * (1 + 0.5 * remaining) * Math.min(2, 1 + 0.1 * (state.combo - 1)) * (state.hint ? 0.4 : 1));
    state.score += gain;
    state.correct++;
    state.progress++;
  } else {
    state.combo = 0;
    state.lives--;
  }
  state.cleared = state.tierIndex === TIERS.length - 1 && state.progress >= ROUNDS_PER_TIER;
  state.phase = state.lives <= 0 || state.cleared ? 'over' : 'review';
  state.feedback = { correct, answer, picked: timeout ? -1 : picked, gain, timeout };
  return state;
}
export function publicRun(id: string, version: number, state: RunState, now: number): RankedRun {
  const q = source(state);
  const text = (lang: 'zh' | 'en') => ({
    prompt: q[lang].prompt,
    options: state.order.map(i => q[lang].options[i]),
    ...(state.feedback ? { explain: q[lang].explain } : {}),
  });
  return {
    id, version, handle: state.handle, phase: state.phase, tier: TIERS[state.tierIndex].name,
    progress: state.progress, lives: state.lives, score: state.score, correct: state.correct,
    answered: state.answered, combo: state.combo, bestCombo: state.bestCombo, cleared: state.cleared,
    jokers: state.jokers, hint: state.hint, eliminated: state.eliminated, deadline: state.deadline,
    serverNow: now, feedback: state.feedback,
    question: { id: q.id, zh: text('zh'), en: text('en'), tags: q.tags, code: q.code, chartKind: q.chartKind, chartData: q.chartData },
  };
}
