CREATE TABLE IF NOT EXISTS families (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL DEFAULT 'Our Family',
  owner_id   TEXT NOT NULL,
  created_at INTEGER NOT NULL
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
  family_id   TEXT NOT NULL,
  date        TEXT NOT NULL,
  name        TEXT NOT NULL,
  notes       TEXT NOT NULL DEFAULT '',
  leftover    INTEGER NOT NULL DEFAULT 0,
  updated_at  INTEGER NOT NULL,
  PRIMARY KEY (family_id, date)
);

CREATE TABLE IF NOT EXISTS grocery_items (
  id          TEXT NOT NULL,
  family_id   TEXT NOT NULL,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL,
  checked     INTEGER NOT NULL DEFAULT 0,
  warn        INTEGER NOT NULL DEFAULT 0,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  updated_at  INTEGER NOT NULL,
  PRIMARY KEY (id, family_id)
);

CREATE INDEX IF NOT EXISTS idx_meals_family    ON meals(family_id);
CREATE INDEX IF NOT EXISTS idx_grocery_family  ON grocery_items(family_id);
CREATE INDEX IF NOT EXISTS idx_users_family    ON users(family_id);
