# House Special — Claude Code Guide

## Project overview

Family meal planning app. React/Vite frontend + Cloudflare Worker backend + D1 (SQLite) database + Google OAuth + Anthropic API for AI meal generation and recipe extraction.

```
house_special/
  app/      — Vite + React frontend (TypeScript)
  worker/   — Cloudflare Worker backend (TypeScript)
```

## Running locally

**Terminal 1 — Worker:**
```bash
cd worker
npm run dev        # wrangler dev on http://localhost:8787
```

**Terminal 2 — Frontend:**
```bash
cd app
npm run dev        # Vite on http://localhost:5173
```

Worker requires `worker/.dev.vars` for local secrets (gitignored — never commit):
```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
SESSION_SECRET=...
ALLOWED_ORIGIN=http://localhost:5173
ANTHROPIC_API_KEY=...
```

## Deploying

**Frontend:** Auto-deploys on merge to `main` via Cloudflare Pages. No manual step needed.

**Worker:** Auto-deploys via GitHub Actions (`.github/workflows/deploy-worker.yml`) when `worker/` files are merged to `main`. Can also trigger manually from the GitHub Actions tab. To deploy locally:
```bash
cd worker
npx wrangler deploy
```
Requires `CLOUDFLARE_API_TOKEN` env var. The token needs **Account > D1 > Edit** permission in addition to the default Workers edit permissions. The same token is stored as a GitHub repo secret for CI.

## Database (D1)

- Database name: `housespecial`
- Database ID: `d323071c-ff9b-4a7e-a08b-1f93692c918f`
- Schema source of truth: `worker/schema.sql`
- Migrations: `worker/migrations/` (numbered sequentially)

**Apply pending migrations:**
```bash
cd worker
npx wrangler d1 migrations apply housespecial --local    # local dev DB
npx wrangler d1 migrations apply housespecial --remote   # production
```
Wrangler tracks applied migrations in a `d1_migrations` table and only runs new ones, so this is safe to re-run.

**Reset local DB from scratch (drops all data):**
```bash
cd worker
rm -rf .wrangler/state
npx wrangler d1 execute housespecial --file=schema.sql --local
```
Use `schema.sql` (the final state) for a fresh reset — don't re-run individual migrations on an empty DB, since most are `ALTER TABLE ADD COLUMN` against tables that don't exist yet.

**New migration checklist:**
1. Create `worker/migrations/000N_description.sql`
2. Update `worker/schema.sql` to match the final desired state
3. Apply locally: `npx wrangler d1 migrations apply housespecial --local`
4. Apply remotely: same command with `--remote`

## Architecture notes

- Auth is Google OAuth with session cookies. `requireAuth` in `worker/src/auth.ts` validates every request.
- Family data (meals, grocery, constraints, recipes) is scoped to a `family_id`. A user is auto-enrolled in a new family on first state write if they have none.
- AI meal generation: two sequential Claude calls — `suggest_dinners` (sonnet-4-6, forced tool use, 7-day plan) → `build_grocery_list` (sonnet-4-6, forced tool use). Rate limited to 5 generations/day per family via `generation_log` table.
- Recipe extraction uses `claude-haiku-4-5-20251001` (cheaper, fast, pure extraction task).
- Recipe-to-meal linking runs as post-processing after `suggest_dinners` returns — word-level intersection matching between meal name and recipe name/tags.
- `GET /families/recipes` and `GET /families/me` return all rows with no pagination. Acceptable at current scale (single-family app); add pagination if recipe counts exceed ~500.

**Data model notes:**
- Each `Meal` has a stable UUID `id` (separate from the `(family_id, date)` DB primary key). This allows future drag-and-swap without breaking grocery links.
- Each `GroceryItem` has `source_meal_ids: string[]` — the IDs of meals that added it. Empty array = ad hoc (never auto-removed). Removing a meal removes or unlinks its grocery items.
- `build_grocery_list` returns `meal_ids` per item so the LLM attributes groceries to specific meals in one pass — no per-meal API calls needed.
- Recipe `ingredients` are stored as `{ name: string; category: string }[]`, not plain strings. Backward compat: old plain-string ingredients are normalized to `{ name, category: 'Other' }` on read.
- Grocery auto-categorization: `app/src/utils/categorize.ts` — checks existing grocery list first (inherit category), then a ~200-entry keyword dictionary, then defaults to 'Other'.

## Key files

| File | Purpose |
|------|---------|
| `worker/src/index.ts` | All route dispatch |
| `worker/src/db.ts` | All D1 query functions |
| `worker/src/handlers/generate.ts` | AI meal plan generation |
| `worker/src/handlers/recipes.ts` | Recipe CRUD + extraction |
| `worker/schema.sql` | Authoritative DB schema |
| `app/src/types.ts` | Shared TypeScript types |
| `app/src/api.ts` | All frontend API calls |
| `app/src/App.tsx` | Root component, nav, view routing, recipe state |
| `app/src/components/EditMealModal.tsx` | Meal edit — recipe linking, grocery CRUD, delete cleanup |
| `app/src/utils/categorize.ts` | Grocery category auto-detection (keyword dictionary) |
| `app/src/styles.css` | All styles (single file) |

## UI conventions

- Bottom-sheet pattern for detail/confirm flows: `.sheet-overlay > .sheet > .sheet-handle + .sheet-header + .sheet-body + .sheet-footer`
- Inline confirm for destructive actions (e.g. "Clear all" in grocery) — no modals
- `.tag` class for pill badges; `.tag-danger` for allergy-related tags
- Page titles use `.page-title` class; section labels use `.section-label`
