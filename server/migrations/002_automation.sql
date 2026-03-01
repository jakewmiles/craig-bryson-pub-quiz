ALTER TABLE puzzles
  ADD COLUMN IF NOT EXISTS difficulty_score INTEGER,
  ADD COLUMN IF NOT EXISTS quality_score INTEGER,
  ADD COLUMN IF NOT EXISTS theme_tag TEXT,
  ADD COLUMN IF NOT EXISTS era_bucket TEXT,
  ADD COLUMN IF NOT EXISTS publishable BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS validation_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_puzzles_status_date ON puzzles(status, puzzle_date);
CREATE INDEX IF NOT EXISTS idx_puzzles_publishable ON puzzles(publishable);

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS position TEXT,
  ADD COLUMN IF NOT EXISTS nationality TEXT,
  ADD COLUMN IF NOT EXISTS retired BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS eligibility_score INTEGER,
  ADD COLUMN IF NOT EXISTS last_seen_in_quiz DATE;

CREATE TABLE IF NOT EXISTS player_facts (
  id BIGSERIAL PRIMARY KEY,
  player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  fact_type TEXT NOT NULL,
  fact_value TEXT NOT NULL,
  source_url TEXT,
  source_type TEXT NOT NULL DEFAULT 'internal',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (player_id, fact_type)
);

CREATE INDEX IF NOT EXISTS idx_player_facts_player_id ON player_facts(player_id);

ALTER TABLE puzzle_sources
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'reference',
  ADD COLUMN IF NOT EXISTS fetched_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source_hash TEXT,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS generation_runs (
  id BIGSERIAL PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed')),
  generated_count INTEGER NOT NULL DEFAULT 0,
  requested_buffer_days INTEGER,
  details JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS publish_runs (
  id BIGSERIAL PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed')),
  target_date DATE,
  published_puzzle_id BIGINT REFERENCES puzzles(id) ON DELETE SET NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS source_refresh_runs (
  id BIGSERIAL PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed')),
  checked_count INTEGER NOT NULL DEFAULT 0,
  stale_count INTEGER NOT NULL DEFAULT 0,
  details JSONB NOT NULL DEFAULT '{}'::jsonb
);
