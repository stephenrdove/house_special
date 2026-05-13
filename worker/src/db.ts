import type { AppState, GroceryItem, Meal } from './types.ts';

// ─── STATE ────────────────────────────────────────────────────────────────────

export async function getState(db: D1Database, familyId: string): Promise<AppState> {
  const [mealsRows, groceryRows] = await Promise.all([
    db.prepare('SELECT date, name, notes, leftover, recipe_id FROM meals WHERE family_id = ?')
      .bind(familyId).all<{ date: string; name: string; notes: string; leftover: number; recipe_id: string | null }>(),
    db.prepare('SELECT id, name, category, checked, warn FROM grocery_items WHERE family_id = ? ORDER BY sort_order ASC')
      .bind(familyId).all<{ id: string; name: string; category: string; checked: number; warn: number }>(),
  ]);

  const meals: Record<string, Meal> = {};
  for (const row of mealsRows.results) {
    meals[row.date] = { name: row.name, notes: row.notes, leftover: row.leftover === 1, recipe_id: row.recipe_id ?? undefined };
  }

  const grocery: GroceryItem[] = groceryRows.results.map(row => ({
    id: row.id, name: row.name, category: row.category,
    checked: row.checked === 1, warn: row.warn === 1,
  }));

  return { meals, grocery };
}

export async function putState(db: D1Database, familyId: string, state: AppState): Promise<void> {
  const now = Date.now();
  const statements: D1PreparedStatement[] = [
    db.prepare('DELETE FROM meals WHERE family_id = ?').bind(familyId),
    db.prepare('DELETE FROM grocery_items WHERE family_id = ?').bind(familyId),
  ];

  for (const [date, meal] of Object.entries(state.meals)) {
    statements.push(
      db.prepare('INSERT INTO meals (family_id, date, name, notes, leftover, recipe_id, updated_at) VALUES (?,?,?,?,?,?,?)')
        .bind(familyId, date, meal.name, meal.notes || '', meal.leftover ? 1 : 0, meal.recipe_id ?? null, now)
    );
  }

  state.grocery.forEach((item, i) => {
    statements.push(
      db.prepare('INSERT INTO grocery_items (id, family_id, name, category, checked, warn, sort_order, updated_at) VALUES (?,?,?,?,?,?,?,?)')
        .bind(item.id, familyId, item.name, item.category, item.checked ? 1 : 0, item.warn ? 1 : 0, i, now)
    );
  });

  await db.batch(statements);
}

export async function updateGroceryItem(
  db: D1Database, familyId: string, itemId: string, checked: boolean,
): Promise<boolean> {
  const result = await db.prepare(
    'UPDATE grocery_items SET checked=?, updated_at=? WHERE id=? AND family_id=?'
  ).bind(checked ? 1 : 0, Date.now(), itemId, familyId).run();
  return result.meta.changes > 0;
}

// ─── FAMILY ───────────────────────────────────────────────────────────────────

export async function getFamilyId(db: D1Database, userId: string): Promise<string | null> {
  const row = await db.prepare('SELECT family_id FROM users WHERE id = ?')
    .bind(userId).first<{ family_id: string | null }>();
  return row?.family_id ?? null;
}

export async function createFamilyForUser(db: D1Database, userId: string): Promise<string> {
  const familyId = crypto.randomUUID();
  const now = Date.now();
  await db.batch([
    db.prepare('INSERT INTO families (id, owner_id, created_at) VALUES (?,?,?)').bind(familyId, userId, now),
    db.prepare('UPDATE users SET family_id = ? WHERE id = ?').bind(familyId, userId),
  ]);
  return familyId;
}

export async function getFamilyMembers(
  db: D1Database, familyId: string,
): Promise<{ id: string; name: string; email: string; picture: string; is_owner: boolean }[]> {
  const [members, family] = await Promise.all([
    db.prepare('SELECT id, name, email, picture FROM users WHERE family_id = ?')
      .bind(familyId).all<{ id: string; name: string; email: string; picture: string }>(),
    db.prepare('SELECT owner_id FROM families WHERE id = ?')
      .bind(familyId).first<{ owner_id: string }>(),
  ]);
  return members.results.map(m => ({ ...m, is_owner: m.id === family?.owner_id }));
}

export async function getFamilyConstraints(
  db: D1Database, familyId: string,
): Promise<string | null> {
  const row = await db.prepare('SELECT constraints FROM families WHERE id = ?')
    .bind(familyId).first<{ constraints: string | null }>();
  return row?.constraints ?? null;
}

export async function setFamilyConstraints(
  db: D1Database, familyId: string, constraints: string | null,
): Promise<void> {
  await db.prepare('UPDATE families SET constraints = ? WHERE id = ?')
    .bind(constraints, familyId).run();
}

export async function createInviteToken(
  db: D1Database, familyId: string, createdBy: string,
): Promise<string> {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  const token = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
  const expiresAt = Date.now() + 48 * 60 * 60 * 1000; // 48 hours
  await db.prepare('INSERT INTO family_invites (token, family_id, created_by, expires_at) VALUES (?,?,?,?)')
    .bind(token, familyId, createdBy, expiresAt).run();
  return token;
}

export async function leaveFamily(db: D1Database, userId: string): Promise<void> {
  const [user, ownerOf] = await Promise.all([
    db.prepare('SELECT family_id FROM users WHERE id = ?')
      .bind(userId).first<{ family_id: string | null }>(),
    db.prepare('SELECT id FROM families WHERE owner_id = ?')
      .bind(userId).first<{ id: string }>(),
  ]);

  if (!user?.family_id) return;
  const familyId = user.family_id;

  const statements: D1PreparedStatement[] = [
    db.prepare('UPDATE users SET family_id = NULL WHERE id = ?').bind(userId),
  ];

  if (ownerOf) {
    const nextOwner = await db.prepare(
      'SELECT id FROM users WHERE family_id = ? AND id != ? LIMIT 1'
    ).bind(familyId, userId).first<{ id: string }>();

    if (nextOwner) {
      statements.push(
        db.prepare('UPDATE families SET owner_id = ? WHERE id = ?').bind(nextOwner.id, familyId)
      );
    } else {
      statements.push(
        db.prepare('DELETE FROM families WHERE id = ?').bind(familyId)
      );
    }
  }

  await db.batch(statements);
}

// ─── RECIPES ──────────────────────────────────────────────────────────────────

export interface RecipeRow {
  id: string;
  family_id: string;
  name: string;
  source_url: string | null;
  ingredients: string;
  steps: string;
  notes: string;
  tags: string;
  created_at: number;
}

export async function listRecipes(db: D1Database, familyId: string): Promise<RecipeRow[]> {
  const result = await db.prepare(
    'SELECT * FROM recipes WHERE family_id = ? ORDER BY created_at DESC'
  ).bind(familyId).all<RecipeRow>();
  return result.results;
}

export async function listRecipeNames(db: D1Database, familyId: string): Promise<string[]> {
  const result = await db.prepare(
    'SELECT name FROM recipes WHERE family_id = ? ORDER BY created_at DESC'
  ).bind(familyId).all<{ name: string }>();
  return result.results.map(r => r.name);
}

export async function insertRecipe(
  db: D1Database,
  familyId: string,
  recipe: Omit<RecipeRow, 'id' | 'family_id' | 'created_at'>,
): Promise<string> {
  const id = crypto.randomUUID();
  await db.prepare(
    'INSERT INTO recipes (id, family_id, name, source_url, ingredients, steps, notes, tags, created_at) VALUES (?,?,?,?,?,?,?,?,?)'
  ).bind(id, familyId, recipe.name, recipe.source_url ?? null, recipe.ingredients, recipe.steps, recipe.notes, recipe.tags, Date.now()).run();
  return id;
}

export async function deleteRecipe(
  db: D1Database, familyId: string, recipeId: string,
): Promise<boolean> {
  const result = await db.prepare(
    'DELETE FROM recipes WHERE id = ? AND family_id = ?'
  ).bind(recipeId, familyId).run();
  return result.meta.changes > 0;
}

export async function acceptInvite(
  db: D1Database, userId: string, token: string, force = false,
): Promise<{ ok: boolean; error?: string; conflict?: boolean }> {
  const invite = await db.prepare(
    'SELECT family_id, expires_at FROM family_invites WHERE token = ?'
  ).bind(token).first<{ family_id: string; expires_at: number }>();

  if (!invite) return { ok: false, error: 'Invalid invite link' };
  if (Date.now() > invite.expires_at) return { ok: false, error: 'Invite link has expired' };

  const user = await db.prepare('SELECT family_id FROM users WHERE id = ?')
    .bind(userId).first<{ family_id: string | null }>();

  if (user?.family_id === invite.family_id) return { ok: true };

  if (user?.family_id) {
    if (!force) return { ok: false, error: 'You are already a member of a family plan', conflict: true };
    await leaveFamily(db, userId);
  }

  await db.batch([
    db.prepare('UPDATE users SET family_id = ? WHERE id = ?').bind(invite.family_id, userId),
    db.prepare('DELETE FROM family_invites WHERE token = ?').bind(token),
  ]);

  return { ok: true };
}
