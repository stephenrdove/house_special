-- Add stable ID to meals (separate from the (family_id, date) primary key)
ALTER TABLE meals ADD COLUMN id TEXT NOT NULL DEFAULT '';
UPDATE meals SET id = lower(hex(randomblob(16))) WHERE id = '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_meals_id ON meals(id);

-- Track which meal(s) each grocery item was added for
ALTER TABLE grocery_items ADD COLUMN source_meal_ids TEXT NOT NULL DEFAULT '[]';
