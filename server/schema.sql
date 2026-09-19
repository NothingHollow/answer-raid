CREATE TABLE IF NOT EXISTS raid_runs (
  id uuid PRIMARY KEY,
  owner_hash text NOT NULL,
  state jsonb NOT NULL,
  version integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '2 hours',
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS raid_runs_owner_idx ON raid_runs (owner_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS raid_runs_finished_idx ON raid_runs (finished_at DESC) WHERE finished_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS raid_rate_limits (
  key text PRIMARY KEY,
  hits integer NOT NULL,
  expires_at timestamptz NOT NULL
);
