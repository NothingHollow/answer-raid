import assert from 'node:assert/strict';
import { createRun, transition, source, publicRun, InputError } from '../server/engine.ts';

const now = 100000;
let run = createRun('  测试 Player  ', now);
assert.equal(run.handle, '测试 Player');
let view = publicRun('test', 0, run, now);
assert.equal(view.question.zh.options.length, 4);
assert.equal(view.question.en.options.length, 4);
assert.ok(!('answer' in view.question));
assert.ok(!('explain' in view.question.en));
assert.equal(view.feedback, null);
assert.throws(() => createRun('<'.repeat(25), now), InputError);
assert.throws(() => createRun('\u202Ename', now), InputError);
assert.throws(() => transition(run, 'next', undefined, now), InputError);
assert.throws(() => transition(run, 'answer', -1, now), InputError);
assert.throws(() => transition(run, 'answer', 0.5, now), InputError);

// Same scoring rules as practice: a perfect, immediate clear is 10,185.
for (let i = 0; i < 18; i++) {
  const correct = run.order.indexOf(source(run).answer);
  run = transition(run, 'answer', correct, now);
  if (i < 17) run = transition(run, 'next', undefined, now);
}
assert.equal(run.score, 10185);
assert.equal(run.phase, 'over');
assert.equal(run.cleared, true);
assert.equal(run.bestCombo, 18);
assert.equal(new Set(run.used).size, 18);
assert.deepEqual(transition(run, 'answer', 0, now), run, 'completed runs cannot earn more points');

run = createRun('timeout', now);
run = transition(run, 'answer', run.order.indexOf(source(run).answer), now + 40000);
assert.equal(run.feedback?.timeout, true);
assert.equal(run.score, 0);
assert.equal(run.lives, 1);
assert.equal(run.phase, 'review');
run = transition(run, 'next', undefined, now + 40000);
run = transition(run, 'read', undefined, now + 80000);
assert.equal(run.phase, 'over');
assert.equal(run.answered, 2);

run = createRun('jokers', now);
const originalDeadline = run.deadline;
run = transition(run, 'freeze', undefined, now + 10000);
assert.equal(run.deadline, originalDeadline + 10000, 'freeze caps remaining time at the tier limit');
run = transition(run, 'fifty', undefined, now + 10000);
assert.equal(run.eliminated.length, 2);
assert.ok(!run.eliminated.includes(run.order.indexOf(source(run).answer)));
assert.throws(() => transition(run, 'answer', run.eliminated[0], now + 10000), InputError);
run = transition(run, 'hint', undefined, now + 10000);
assert.equal(run.jokers, 0);
assert.throws(() => transition(run, 'freeze', undefined, now + 10000), InputError);
run = transition(run, 'answer', run.order.indexOf(source(run).answer), now + 10000);
assert.equal(run.score, 60);
view = publicRun('test', 4, run, now + 10000);
assert.ok(view.question.en.explain);
assert.ok(view.question.zh.explain);
assert.throws(() => transition(run, 'answer', 0, now + 10000), InputError);

run = createRun('abandoned', now);
run = transition(run, 'abandon', undefined, now);
assert.equal(run.phase, 'abandoned');
assert.deepEqual(transition(run, 'read', undefined, now + 100000), run);
console.log('Ranked scoring, tiers, timeouts, jokers, hidden answers, invalid input and terminal states passed.');
