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
CREATE INDEX IF NOT EXISTS idx_recipes_family ON recipes(family_id);
