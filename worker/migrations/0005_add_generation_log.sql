CREATE TABLE IF NOT EXISTS generation_log (
  family_id TEXT NOT NULL,
  date      TEXT NOT NULL,
  count     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (family_id, date)
);
