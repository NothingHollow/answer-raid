/** Opt-in live database test. Creates only uniquely identified QA runs and removes them in finally. */
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { handleApi } from '../server/api.ts';
import { database } from '../server/db.ts';
import { bank } from '../server/engine.ts';
import type { RankedRun } from '../src/lib/ranked-types.ts';

const sql = database();
const ids: string[] = [];
const owners: string[] = [];
const url = process.env.RANKED_API_URL ?? 'http://localhost/api/raid';
const send = (request: Request) => process.env.RANKED_API_URL ? fetch(request) : handleApi(request);
async function post(body: object, cookie = '') {
  return send(new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie, origin: new URL(url).origin }, body: JSON.stringify(body) }));
}
async function start(handle: string) {
  const id = randomUUID(); ids.push(id);
  const res = await post({ action: 'start', id, handle });
  assert.equal(res.status, 200);
  const cookie = res.headers.get('set-cookie')!.split(';')[0];
  owners.push(createHash('sha256').update(cookie.split('=')[1]).digest('hex'));
  return { cookie, run: await res.json() as RankedRun };
}
function choice(run: RankedRun, correct: boolean) {
  const q = bank.find(q => q.id === run.question.id)!;
  const right = run.question.en.options.indexOf(q.en.options[q.answer]);
  return correct ? right : (right + 1) % 4;
}
try {
  const a = await start(`QA-${randomUUID().slice(0, 6)}`);
  const b = await start(`QA-${randomUUID().slice(0, 6)}`);
  assert.equal((await post({ action: 'read', id: a.run.id }, b.cookie)).status, 404, 'other players cannot read a private run');
  assert.equal((await post({ action: 'read', id: a.run.id })).status, 401);
  assert.equal((await send(new Request(url, { method: 'POST', headers: { origin: 'https://attacker.example' } }))).status, 403);
  assert.equal((await post({ action: 'answer', id: a.run.id, version: 0, choice: 9 }, a.cookie)).status, 400);
  const answer = { action: 'answer', id: a.run.id, version: a.run.version, choice: choice(a.run, true), score: 999999999 };
  const concurrent = await Promise.all([post(answer, a.cookie), post(answer, a.cookie)]);
  assert.deepEqual(concurrent.map(r => r.status).sort(), [200, 409]);
  a.run = await (concurrent.find(r => r.status === 200)!).json() as RankedRun;
  assert.ok(a.run.score > 0 && a.run.score <= 150, 'client score ignored');
  for (const player of [a, b]) {
    while (player.run.phase !== 'over') {
      const res = await post({ action: player.run.phase === 'review' ? 'next' : 'answer', id: player.run.id, version: player.run.version, choice: choice(player.run, false) }, player.cookie);
      assert.equal(res.status, 200);
      player.run = await res.json() as RankedRun;
    }
  }
  for (const period of ['all', 'today']) {
    const board = await (await send(new Request(`${url}?period=${period}`))).json();
    const aEntry = board.entries.find((r: {handle: string}) => r.handle === a.run.handle);
    const bEntry = board.entries.find((r: {handle: string}) => r.handle === b.run.handle);
    assert.ok(aEntry && bEntry);
    assert.ok(aEntry.rank < bEntry.rank);
  }
  const duplicate = await post({ action: 'answer', id: a.run.id, version: a.run.version, choice: 0 }, a.cookie);
  assert.equal((await duplicate.json()).score, a.run.score);
  console.log('Live Neon persistence, cross-player ranking, replay/race protection, ownership and origin checks passed.');
} finally {
  for (const id of ids) await sql`DELETE FROM raid_runs WHERE id = ${id}`;
  for (const owner of owners) await sql`DELETE FROM raid_rate_limits WHERE key LIKE ${owner + ':%'}`;
  console.log('Removed only the QA runs created by this test.');
}
