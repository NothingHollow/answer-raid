# Shared leaderboard / 共享排行榜

The leaderboard is backed by Neon Postgres. The existing practice game remains available without a database. Ranked games use a same-origin server API and never accept a score supplied by the browser.

## Pages

- `/#/ranked`: start a ranked game with a public nickname. The rules are 6 correct answers per tier, 3 jokers total, EZ / HD / IN. Answer, timing, combo, hint penalties, lives and completion are calculated on the server.
- `/#/leaderboard`: top 50, all-time or today's results, automatic refresh every 10 seconds while visible, and a fullscreen button for an event display. Today uses Asia/Shanghai (UTC+8).
- Both pages follow the existing Chinese/English and light/dark controls.
- Practice results stay in localStorage. Historical local scores are deliberately not uploaded because they cannot be verified.

Ranked questions continue timing while a page is closed or an exit confirmation is visible. Feedback waits for the player to continue. A run expires after two hours. Refreshing the same tab resumes it using sessionStorage and an HttpOnly owner cookie. Quitting does not publish the run.

## Identity and ordering

No signup is required. A random HttpOnly, SameSite=Lax cookie identifies a browser; only its hash is stored in Postgres. The database connection and credentials never reach the frontend. Public entries include only a nickname, short display ID, score, tier, answer counts, best combo, completion flag and completion time.

One best result is shown per browser identity and case-insensitive nickname. This allows a shared event laptop to record different participants. Matching names from different browsers remain separate, distinguished by a short ID. Clearing cookies or changing device creates a new identity; names are not verified accounts. Ranking orders by score descending, correct answers descending, attempts ascending, then earliest completion and run ID for stable ties.

## Local development

1. Copy `.env.example` to `.env.local` and set `DATABASE_URL` to the TLS-enabled Neon connection string. This file is ignored by Git and Vercel uploads. Do not use a `VITE_` prefix for credentials.
2. `pnpm install --frozen-lockfile`
3. `pnpm db:migrate` creates only the `raid_runs` and `raid_rate_limits` tables and their indexes, idempotently.
4. `pnpm dev` serves the app and API together. `pnpm preview` is a **static** preview and cannot run ranked games.

## Vercel production

Import `NothingHollow/answer-raid`, use the Vite preset, and keep the root directory at the repository root. Set `DATABASE_URL` as a server environment variable in Production and Preview. Run the migration once against that database before deployment. `api/raid.ts` exposes the same handler used by Vite development. `vercel.json` puts functions near the supplied US East database.

The site and API must share an origin. Do not put database credentials or a browser-facing database proxy into GitHub Pages. The Pages workflow remains manually runnable for practice-only static builds; pushes run its checks, and Vercel hosts the full game.

## Integrity and operational limits

- Each write checks the owner cookie, action, run expiry and version. Optimistic conditional updates prevent concurrent requests or retries from scoring twice. Results become public only after the server reaches a terminal game state.
- Ranked responses hide correct answers and explanations until a question is answered. Practice includes the public question bank, so this is **not** a high-stakes anti-cheat system: knowledgeable users can look up answers or automate play.
- Database-backed write limits are 120 requests per owner per minute and 60 starts per IP per minute on Vercel. Shared event networks may need that start threshold adjusted. These limits are basic abuse controls, not bot-proof identity verification. Enable additional Vercel traffic controls for a large public event.
- Expired unfinished runs and expired rate-limit buckets are cleaned when a new run starts. Finished results are retained until an organizer removes them from the database. There is no public delete or admin endpoint.
- Keep the owner connection string private, rotate credentials if exposed, and use a dedicated limited database role in a larger deployment. Errors shown to players never include database connection details.

## Validation

- `pnpm test`: existing game tests plus ranked engine checks and the production DOM checks.
- `pnpm test:ranked`: server scoring, complete runs, timeouts, jokers, invalid actions and response redaction; no network required.
- `pnpm test:ranked:live`: opt-in integration test against the configured Neon database. Creates uniquely named QA runs, verifies cross-player ranking, rejects ownership violations and duplicate/concurrent answers, and deletes only those QA runs in `finally`.
- To exercise the deployed HTTP boundary too, set `RANKED_API_URL=https://your-site/api/raid` before the live test. The configured `DATABASE_URL` must point to that deployment's database so QA cleanup reaches the same records.

The connection string is not part of any tracked file, frontend bundle, API response or logging statement.
