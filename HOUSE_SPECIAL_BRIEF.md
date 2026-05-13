# House Special — Development Brief
## Agent Orchestration Roadmap

---

## Project Overview

**House Special** is a family meal planning web app at `housespecial.stephendove.com`. Deployed on Cloudflare Pages (frontend auto-deploys on merge to `main`) with a Cloudflare Worker as the backend/database layer. The frontend is Vite + React. Google OAuth is implemented and working, supporting multiple families with shared access.

The core user flow today:
1. Family configures their preferences (Settings)
2. User copies a planning prompt to clipboard
3. User pastes into Claude manually, gets JSON back
4. User pastes JSON into the app to import meals + grocery list

**Goal:** Replace the clipboard copy/paste flow with direct Anthropic API calls via agent orchestration inside the Worker.

---

## What's Already Built

- ✅ Google OAuth (login, session, logout)
- ✅ Multi-family support (invite links, join, leave, ownership transfer)
- ✅ Meal calendar (14-day view, leftover tracking)
- ✅ Grocery list (categories, warn flags, check-off)
- ✅ Import flow (copy prompt → paste JSON → parse into state)
- ✅ Free-form prompt editor in Settings (`prompt_context` stored per-family in D1)
- ✅ D1 database (families, users, meals, grocery_items, family_invites)
- ✅ Cloudflare Pages auto-deploy on merge to `main`

---

## Phase 1 — Structured Constraints Form (replaces free-form prompt editor)

The free-form `prompt_context` textarea we currently have in Settings is an interim solution. It's fragile (users can accidentally break their own prompt) and produces unstructured text that can't cleanly feed an agent. Replace it with a structured constraints form that stores a JSON object per family.

### Why This First

The constraints JSON becomes the single source of truth used by:
- The existing clipboard prompt builder (`buildPlanningPrompt`) — keeps the manual flow working during transition
- The upcoming agent calls — clean structured input, no prompt parsing needed

### Constraints Schema

```json
{
  "family": {
    "adults": 2,
    "children": [{ "age": 3 }, { "age": 1 }]
  },
  "allergies": ["gluten"],
  "dietary_restrictions": ["no pork"],
  "favorites": ["tacos", "pasta", "stir fry"],
  "avoid": ["mushrooms", "fish"],
  "preferred_cuisines": ["italian", "mexican", "asian"],
  "notes": "Optional freeform field for anything that doesn't fit above"
}
```

**Allergies vs dietary_restrictions:** Allergies are safety-critical hard constraints (label them visually as such in the UI). Dietary restrictions are preference-based. The agent prompt should treat these differently.

**Children ages:** The model uses these to infer toddler-friendly needs without requiring explicit instructions.

**notes:** A small optional freeform field at the bottom — replaces the current full-textarea approach but keeps an escape hatch for edge cases.

### DB Changes

- Add `constraints TEXT` column to `families` table (JSON-serialized)
- Migration: `ALTER TABLE families ADD COLUMN constraints TEXT;`
- Remove `prompt_context` column (or keep as deprecated — it's new so no migration risk either way)
- New DB functions: `getFamilyConstraints`, `setFamilyConstraints`
- Extend `GET /families/me` to return `constraints`
- New endpoint: `PUT /families/constraints`

### UI (SettingsView.tsx)

Replace the "Planning Prompt" card with a "Family Preferences" card:
- **Adults:** stepper (+ / −)
- **Children:** dynamic list — "Add child" button, each child has an age input and a remove button
- **Allergies:** tag input — type a value, press Enter → chip. Red/warning visual weight.
- **Dietary restrictions:** tag input — neutral visual weight
- **Favorites:** tag input
- **Avoid:** tag input
- **Preferred cuisines:** tag input
- **Notes:** small textarea (optional, ~3 rows)
- Save / Saved! button pattern (same as current prompt editor)

### Update planningPrompt.ts

Replace `DEFAULT_FAMILY_CONTEXT` + `familyContext` string with a `constraints` object parameter. The function reads structured fields and renders them into the prompt naturally. The locked JSON format section stays identical and untouched.

---

## Phase 2 — Agent Orchestration

Replace the clipboard → paste flow with a Worker endpoint that calls the Anthropic API directly and returns a ready-to-import plan.

### Architecture

```
Frontend "Generate Plan" button
    → POST /families/generate
        → Auth check
        → Fetch constraints (D1)
        → Fetch recent meal history (D1, last 28 days)
        → LLM Call 1: suggest_dinners(constraints, history) → 14-day meal plan
        → LLM Call 2: build_grocery_list(meal_plan) → categorized grocery list
        → Return { weeks, grocery } (same shape as current JSON import)
Frontend auto-imports result — no paste step
```

### Worker Setup

- Add `@anthropic-ai/sdk` to `worker/package.json`
- Add `ANTHROPIC_API_KEY` as a Worker secret: `npx wrangler secret put ANTHROPIC_API_KEY`
- New handler: `worker/src/handlers/generate.ts`
- New route: `POST /families/generate` in `index.ts`

### Tool Definitions

**`suggest_dinners`**
```json
{
  "name": "suggest_dinners",
  "input": {
    "constraints": "<constraints JSON>",
    "history": ["2025-04-01: Tacos", "2025-04-03: Pasta"]
  },
  "output": [
    { "date": "YYYY-MM-DD", "meal": "Meal name", "notes": "optional", "leftover": false }
  ]
}
```

**`build_grocery_list`**
```json
{
  "name": "build_grocery_list",
  "input": {
    "meal_plan": "<output of suggest_dinners>"
  },
  "output": [
    { "category": "Produce", "name": "Item name", "warn": false }
  ]
}
```

### Why Two Calls

Meal history is prominent and fresh in the `suggest_dinners` context — the current single-prompt approach buries it. Grocery generation operates on clean structured meal data rather than freeform text. Each call is small, debuggable, and independently testable.

### Cloudflare Free Tier

Workers free plan has a 30-second CPU limit. Two LLM calls is the max safe design:
- Do NOT batch per-meal calls
- All 14 dinners in one `suggest_dinners` call
- One `build_grocery_list` call on the result
- Constraints are read from D1 at generation time (fast, no KV needed — constraints rarely change and D1 latency is negligible)

### Model

Use `claude-sonnet-4-5` (`claude-sonnet-4-5-20251001`). Good balance of quality and speed for this use case. Upgrade to Opus only if meal quality needs improvement.

### Frontend Changes

- New "Generate Plan" button in `ImportView`
- Calls `POST /families/generate`, gets `{ weeks, grocery }` back
- Runs the existing `importJSON` logic directly — no paste step
- Keep the "Copy Planning Prompt" / paste flow as a fallback during rollout
- Show a loading state on the button during generation (~10–20s expected)

---

## Phase 3 — Polish (Future)

- Remove clipboard/paste flow once agent flow is proven stable
- Rate limiting: cap `POST /families/generate` calls per family per day using D1 counters
- Recipe storage: save full recipes, not just meal names
- Cuisine variety enforcement: agent prompt explicitly distributes across `preferred_cuisines` week-to-week
- GitHub Actions workflow to auto-deploy Worker on merge to `main` (no more manual `wrangler deploy`)

---

## Technical Stack

| Layer | Technology |
|---|---|
| Frontend | Vite + React, Cloudflare Pages (auto-deploy on merge to `main`) |
| Backend | Cloudflare Worker (auth, DB, API proxy, agent orchestration) |
| Database | Cloudflare D1 (SQLite) |
| Auth | Google OAuth |
| AI | Anthropic API — `claude-sonnet-4-5` |
| Repo | GitHub — auto-deploys frontend, Worker deployed manually via `npx wrangler deploy` |

---

## Key Design Principles

1. **Constraints are structured, not freeform** — clean JSON in, clean JSON out
2. **History is explicit** — passed as a clean array into the agent, not buried in instructions
3. **Two LLM calls max** — respects free tier limits, keeps cost predictable
4. **Same output shape** — agent returns `{ weeks, grocery }` identical to the current import format; no frontend parser changes needed
5. **Clipboard flow survives Phase 1** — structured constraints still power `buildPlanningPrompt`, so manual flow keeps working until Phase 2 is ready
6. **Auth gates everything** — no API access without valid Google OAuth session
