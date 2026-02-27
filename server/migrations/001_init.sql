CREATE TABLE IF NOT EXISTS players (
  id BIGSERIAL PRIMARY KEY,
  canonical_name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS player_aliases (
  id BIGSERIAL PRIMARY KEY,
  player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  normalized_alias TEXT NOT NULL,
  UNIQUE (player_id, normalized_alias)
);

CREATE INDEX IF NOT EXISTS idx_player_aliases_normalized_alias
  ON player_aliases(normalized_alias);

CREATE TABLE IF NOT EXISTS puzzles (
  id BIGSERIAL PRIMARY KEY,
  puzzle_date DATE NOT NULL UNIQUE,
  player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
  legend_why TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS puzzle_clues (
  id BIGSERIAL PRIMARY KEY,
  puzzle_id BIGINT NOT NULL REFERENCES puzzles(id) ON DELETE CASCADE,
  clue_number SMALLINT NOT NULL CHECK (clue_number BETWEEN 1 AND 6),
  clue_text TEXT NOT NULL,
  clue_type TEXT NOT NULL,
  UNIQUE (puzzle_id, clue_number)
);

CREATE TABLE IF NOT EXISTS puzzle_sources (
  id BIGSERIAL PRIMARY KEY,
  puzzle_id BIGINT NOT NULL REFERENCES puzzles(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id BIGSERIAL PRIMARY KEY,
  anon_token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attempts (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  puzzle_id BIGINT NOT NULL REFERENCES puzzles(id) ON DELETE CASCADE,
  clue_number SMALLINT NOT NULL CHECK (clue_number BETWEEN 1 AND 6),
  guess_raw TEXT NOT NULL,
  guess_normalized TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, puzzle_id, clue_number)
);

CREATE TABLE IF NOT EXISTS streaks (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  max_streak INTEGER NOT NULL DEFAULT 0,
  last_completed_date DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
