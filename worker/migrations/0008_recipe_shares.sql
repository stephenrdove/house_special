CREATE TABLE IF NOT EXISTS recipe_shares (
  token      TEXT PRIMARY KEY,
  family_id  TEXT NOT NULL,
  created_by TEXT NOT NULL,
  recipe_id  TEXT NOT NULL,
  snapshot   TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_recipe_shares_family ON recipe_shares(family_id);
