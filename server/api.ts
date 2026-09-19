import { createHash, randomBytes } from 'node:crypto';
import { database } from './db.js';
import { createRun, InputError, publicRun, transition, type RunState } from './engine.js';
import type { RankedAction } from '../src/lib/ranked-types.js';

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const actions = new Set(['read', 'answer', 'next', 'hint', 'freeze', 'fifty', 'abandon']);
const cookieName = 'raid_player';
function response(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}
async function bodyOf(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new InputError('JSON required');
  const reader = request.body?.getReader();
  if (!reader) throw new InputError('Body required');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 4096) { await reader.cancel(); throw new InputError('Body too large'); }
    chunks.push(value);
  }
  try {
    const body: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch { throw new InputError('Invalid JSON'); }
}

export async function handleApi(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    if (!['GET', 'POST'].includes(request.method)) return response({ error: 'method' }, 405, { Allow: 'GET, POST' });
    // No cross-site writes or permissive CORS; credentials stay in an HttpOnly cookie.
    if (request.method === 'POST') {
      const origin = request.headers.get('origin');
      if ((origin && origin !== url.origin) || request.headers.get('sec-fetch-site') === 'cross-site') {
        return response({ error: 'origin' }, 403);
      }
    }
    const sql = database();
    if (request.method === 'GET') {
      const period = url.searchParams.get('period') === 'today' ? 'today' : 'all';
      // UTC+8 matches the club event's local day. Best score per browser identity + name.
      const rows = await sql`
        WITH eligible AS (
          SELECT id, owner_hash, state, finished_at,
            row_number() OVER (
              PARTITION BY owner_hash, lower(state->>'handle')
              ORDER BY (state->>'score')::int DESC, (state->>'correct')::int DESC,
                       (state->>'answered')::int ASC, finished_at ASC, id ASC
            ) AS personal
          FROM raid_runs
          WHERE finished_at IS NOT NULL AND state->>'phase' = 'over'
            AND (${period} = 'all' OR finished_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Shanghai') AT TIME ZONE 'Asia/Shanghai')
        )
        SELECT state->>'handle' AS handle,
          substr(md5(owner_hash || lower(state->>'handle')), 1, 6) AS player,
          (state->>'score')::int AS score,
          CASE (state->>'tierIndex')::int WHEN 0 THEN 'EZ' WHEN 1 THEN 'HD' ELSE 'IN' END AS tier,
          (state->>'correct')::int AS correct, (state->>'answered')::int AS answered,
          (state->>'bestCombo')::int AS combo, (state->>'cleared')::boolean AS cleared,
          finished_at AS at
        FROM eligible WHERE personal = 1
        ORDER BY score DESC, correct DESC, answered ASC, finished_at ASC, id ASC LIMIT 50`;
      return response({ entries: rows.map((row, i) => ({ ...row, rank: i + 1 })), period, updatedAt: new Date().toISOString() });
    }
    const body = await bodyOf(request);
    const rawCookie = request.headers.get('cookie')?.split(';').map(x => x.trim()).find(x => x.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
    const existingOwner = rawCookie && /^[a-f0-9]{64}$/.test(rawCookie) ? rawCookie : null;
    if (!existingOwner && body.action !== 'start') return response({ error: 'session' }, 401);
    const owner = existingOwner ?? randomBytes(32).toString('hex');
    const ownerHash = digest(owner);
    const headers: Record<string, string> = !existingOwner ? {
      'Set-Cookie': `${cookieName}=${owner}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000${url.protocol === 'https:' ? '; Secure' : ''}`,
    } : {};
    const now = Date.now();
    // A shared database bucket also works across concurrent serverless instances.
    const bucket = `${ownerHash}:${Math.floor(now / 60000)}`;
    const rate = await sql`INSERT INTO raid_rate_limits (key, hits, expires_at)
      VALUES (${bucket}, 1, now() + interval '2 minutes')
      ON CONFLICT (key) DO UPDATE SET hits = raid_rate_limits.hits + 1 RETURNING hits`;
    if (rate[0].hits > 120) return response({ error: 'rate' }, 429, { ...headers, 'Retry-After': '60' });
    if (body.action === 'start') {
      if (typeof body.id !== 'string' || !uuid.test(body.id)) throw new InputError('Invalid run ID');
      const state = createRun(body.handle, now);
      // Starts have an additional IP bucket (Vercel's trusted proxy header only).
      const ip = process.env.VERCEL ? request.headers.get('x-vercel-forwarded-for') : 'local';
      const startKey = `start:${digest(ip ?? 'unknown')}:${Math.floor(now / 60000)}`;
      const starts = await sql`INSERT INTO raid_rate_limits (key, hits, expires_at)
        VALUES (${startKey}, 1, now() + interval '2 minutes')
        ON CONFLICT (key) DO UPDATE SET hits = raid_rate_limits.hits + 1 RETURNING hits`;
      if (starts[0].hits > 60) return response({ error: 'rate' }, 429, { ...headers, 'Retry-After': '60' });
      await sql`DELETE FROM raid_rate_limits WHERE expires_at < now()`;
      await sql`DELETE FROM raid_runs WHERE expires_at < now() AND finished_at IS NULL`;
      await sql`INSERT INTO raid_runs (id, owner_hash, state) VALUES (${body.id}, ${ownerHash}, ${JSON.stringify(state)}::jsonb) ON CONFLICT (id) DO NOTHING`;
      const saved = await sql`SELECT id, version, state FROM raid_runs WHERE id = ${body.id} AND owner_hash = ${ownerHash} AND expires_at > now()`;
      if (!saved.length) return response({ error: 'session' }, 409, headers);
      return response(publicRun(saved[0].id, saved[0].version, saved[0].state as RunState, Date.now()), 200, headers);
    }
    if (!actions.has(String(body.action)) || typeof body.id !== 'string' || !uuid.test(body.id)) throw new InputError('Invalid action');
    const rows = await sql`SELECT id, version, state FROM raid_runs WHERE id = ${body.id} AND owner_hash = ${ownerHash} AND expires_at > now()`;
    if (!rows.length) return response({ error: 'session' }, 404);
    const row = rows[0];
    if (body.action !== 'read' && body.version !== row.version) return response({ error: 'stale' }, 409);
    const state = transition(row.state as RunState, body.action as RankedAction, body.choice, Date.now());
    if (JSON.stringify(state) === JSON.stringify(row.state)) return response(publicRun(row.id, row.version, state, Date.now()));
    const updated = await sql`UPDATE raid_runs SET state = ${JSON.stringify(state)}::jsonb, version = version + 1,
      finished_at = CASE WHEN ${state.phase} = 'over' THEN coalesce(finished_at, now()) ELSE finished_at END
      WHERE id = ${body.id} AND owner_hash = ${ownerHash} AND version = ${row.version} RETURNING version`;
    if (!updated.length) return response({ error: 'stale' }, 409);
    return response(publicRun(row.id, updated[0].version, state, Date.now()));
  } catch (error) {
    if (error instanceof InputError) return response({ error: 'invalid' }, 400);
    // Never send/log database errors: connection details may contain credentials.
    console.error('Leaderboard request failed');
    return response({ error: 'unavailable' }, 503);
  }
}
