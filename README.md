# House Special

A family meal planning app with AI-generated weekly plans, a recipe library, and a shared grocery list.

Live at [housespecial.stephendove.com](https://housespecial.stephendove.com)

---

## Features

- **AI meal planning** — generates a 7-day dinner plan and grocery list tailored to your family's preferences, allergies, and recent meal history
- **Recipe library** — save recipes by pasting a URL or text; Claude extracts the name, ingredients, and steps automatically
- **Shared family plan** — invite family members to share a meal calendar and grocery list in real time
- **Grocery list** — categorized, checkable, with allergy safety flags on relevant items
- **Family preferences** — configure allergies, dietary restrictions, favorite meals, cuisines to avoid, and more; the AI uses these on every generation

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | Vite + React (TypeScript), Cloudflare Pages |
| Backend | Cloudflare Worker (TypeScript) |
| Database | Cloudflare D1 (SQLite) |
| Auth | Google OAuth |
| AI | Anthropic API (Claude) |

---

## Development

See [CLAUDE.md](./CLAUDE.md) for full setup instructions, deploy steps, and database migration workflow.

**Quick start:**

```bash
# Terminal 1 — Worker (http://localhost:8787)
cd worker && npm run dev

# Terminal 2 — Frontend (http://localhost:5173)
cd app && npm run dev
```

Requires a `worker/.dev.vars` file with `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET`, `ALLOWED_ORIGIN`, and `ANTHROPIC_API_KEY`.
