# Reachout

A personal outreach operating system for university students and recent graduates: find the right people, understand them, write something worth replying to, follow up, and turn conversations into opportunities. "Reachout" is a working name.

**Status:**

- The design is complete and frozen.
- Every production surface is built: Today, People, Pursuing, Outreach, Companies, Settings and Onboarding.
- Accounts and persistence are in place: email-link sign-in through Supabase Auth, durable Postgres storage, and row-level security per workspace.
- Gmail and AI are not built. Nothing has been deployed.

The design reference is the prototype at `/prototypes/directions?v=3` (development only).

## Local development

Requires Node 24+, pnpm 11 and Docker (for the local Supabase stack).

```sh
pnpm install
pnpm db:start                      # local Supabase: Postgres, Auth, the Data API, and a mail catcher
cp .env.example .env.local         # then set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY,
                                   # the API_URL and PUBLISHABLE_KEY that db:start prints
pnpm dev                           # http://localhost:3000
```

**Signing in locally:**

1. Enter any address on `/sign-in`.
2. Open the email in the local mail catcher (Mailpit, at the `MAILPIT_URL` that `db:start` prints).
3. Follow the link. It points at port 3000; if `pnpm dev` runs on another port, change the port in the link.

A new address starts onboarding.

**Without Supabase:**

- `REACHOUT_DEV_SEED=true pnpm dev` runs as the fictional seed student, in memory, with no sign-in. Changes last until the server restarts.
- Production refuses this setting.
- With neither setting, the app fails closed.

## Checks and tests

```sh
pnpm check     # format, lint, typecheck, unit and component tests, build
pnpm test:db   # the Repository contract and two-account isolation, against the local Supabase
pnpm db:test   # pgTAP: RLS, grants and function ownership, checked inside Postgres
```

## Database

- **Schema:** versioned migrations in `supabase/migrations/`. Never change it in the dashboard.
- **New migration:** `pnpm exec supabase migration new <name>`.
- **Apply from scratch:** `pnpm db:reset`. This wipes local data.
- **Regenerate types:** `pnpm db:types`, which writes `src/data/supabase/database.types.ts`.
- **Before going live:** [docs/launch-checklist.md](docs/launch-checklist.md).

| Doc                                                  | What it covers                                    |
| ---------------------------------------------------- | ------------------------------------------------- |
| [PRODUCT.md](PRODUCT.md)                             | Thesis, users, core loop, onboarding, scope       |
| [DOMAIN.md](DOMAIN.md)                               | Entities, invariants, Today and outreach rules    |
| [ARCHITECTURE.md](ARCHITECTURE.md)                   | Stack, layers, data, auth, integration boundaries |
| [DESIGN.md](DESIGN.md)                               | Quality bar, process, accessibility, tooling      |
| [DECISIONS.md](DECISIONS.md)                         | Numbered durable decisions                        |
| [ROADMAP.md](ROADMAP.md)                             | Phases and acceptance criteria                    |
| [DEVLOG.md](DEVLOG.md)                               | What happened, newest first                       |
| [CLAUDE.md](CLAUDE.md)                               | Rules for coding agents                           |
| [docs/launch-checklist.md](docs/launch-checklist.md) | What the live Supabase project needs              |
