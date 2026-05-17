CREATE TABLE IF NOT EXISTS families (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL DEFAULT 'Our Family',
  owner_id       TEXT NOT NULL,
  created_at     INTEGER NOT NULL,
  prompt_context TEXT,
  constraints    TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  google_id   TEXT UNIQUE NOT NULL,
  email       TEXT NOT NULL,
  name        TEXT NOT NULL,
  picture     TEXT NOT NULL DEFAULT '',
  family_id   TEXT,
  created_at  INTEGER NOT NULL,
  last_seen   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS family_invites (
  token      TEXT PRIMARY KEY,
  family_id  TEXT NOT NULL,
  created_by TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS meals (
  id          TEXT NOT NULL DEFAULT '',
  family_id   TEXT NOT NULL,
  date        TEXT NOT NULL,
  name        TEXT NOT NULL,
  notes       TEXT NOT NULL DEFAULT '',
  leftover    INTEGER NOT NULL DEFAULT 0,
  recipe_id   TEXT,
  updated_at  INTEGER NOT NULL,
  PRIMARY KEY (family_id, date)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_meals_id ON meals(id);

CREATE TABLE IF NOT EXISTS grocery_items (
  id              TEXT NOT NULL,
  family_id       TEXT NOT NULL,
  name            TEXT NOT NULL,
  category        TEXT NOT NULL,
  checked         INTEGER NOT NULL DEFAULT 0,
  warn            INTEGER NOT NULL DEFAULT 0,
  source_meal_ids TEXT NOT NULL DEFAULT '[]',
  sort_order      INTEGER NOT NULL DEFAULT 0,
  updated_at      INTEGER NOT NULL,
  PRIMARY KEY (id, family_id)
);

CREATE TABLE IF NOT EXISTS recipes (
  id          TEXT NOT NULL,
  family_id   TEXT NOT NULL,
  name        TEXT NOT NULL,
  source_url  TEXT,
  ingredients TEXT NOT NULL DEFAULT '[]',
  steps       TEXT NOT NULL DEFAULT '[]',
  notes       TEXT NOT NULL DEFAULT '',
  tags        TEXT NOT NULL DEFAULT '[]',
  created_at  INTEGER NOT NULL,
  PRIMARY KEY (id, family_id)
);

CREATE TABLE IF NOT EXISTS generation_log (
  family_id TEXT NOT NULL,
  date      TEXT NOT NULL,
  count     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (family_id, date)
);

CREATE INDEX IF NOT EXISTS idx_meals_family           ON meals(family_id);
CREATE INDEX IF NOT EXISTS idx_grocery_family         ON grocery_items(family_id);
CREATE INDEX IF NOT EXISTS idx_users_family           ON users(family_id);
CREATE INDEX IF NOT EXISTS idx_recipes_family         ON recipes(family_id);
CREATE INDEX IF NOT EXISTS idx_family_invites_family  ON family_invites(family_id);
CREATE INDEX IF NOT EXISTS idx_generation_log_family  ON generation_log(family_id);
