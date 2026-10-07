# Reachout

A personal outreach workspace for students and new grads. Reachout keeps track of the people, opportunities and conversations behind a job search, and tells you the next useful thing to do. You write every message, approve it and send it yourself: Reachout never sends anything.

**Status: V1 complete.** Every surface is built and verified locally. It is not deployed.

## Demo

```sh
pnpm install
pnpm dev          # http://localhost:3001
```

Open `/` and choose **Try the demo**. You land in a fictional student's workspace, already full of people, opportunities, drafts and history. No account, email, Supabase or `.env` file is needed.

- **Changes:** marking things done, snoozing, editing, approving and marking as sent all work for your visit.
- **Settings:** _Reset demo_ starts again; _Exit demo_ returns to the landing page.
- **Storage:** demo records live only in the server's memory and are never written to a database.

## What it does

**The loop:** find → research → understand → draft → approve → send (yourself) → follow up.

| Screen        | What it's for                                                                      |
| ------------- | ---------------------------------------------------------------------------------- |
| **Today**     | The next useful actions, in order: overdue follow-ups, replies, deadlines, drafts. |
| **People**    | Who you're talking to, why they matter, and the history between you.               |
| **Pursuing**  | Opportunities by stage, with deadlines and the people involved.                    |
| **Outreach**  | Every conversation by where it stands: to write, to approve, to send, waiting.     |
| **Companies** | The people and opportunities at each organisation.                                 |
| **Settings**  | Your profile and goals.                                                            |

There are no scores, no bulk sending, and no LinkedIn automation.

## Stack

- **App:** Next.js 16 (App Router, Server Actions, Proxy), React 19 and TypeScript.
- **Styling:** CSS Modules on a small set of locked design tokens.
- **Data:** Supabase (Auth, Postgres with row-level security), Zod 4 at every boundary.
- **Tests:** Vitest, Testing Library, pgTAP.
- **Tooling:** pnpm.

## Architecture

- **Rules:** domain rules are pure TypeScript in `src/domain/`, tested without React or a database.
- **Data access:** product code reads and writes only through a `Repository` interface. One server module (`src/server/repository.ts`) picks the implementation for the session:
  - Supabase for a signed-in account;
  - an in-memory copy of the demo dataset for the demo.
- **Writes:** they go through Postgres functions owned by a role that can't bypass RLS, so the database enforces ownership itself.

[ARCHITECTURE.md](ARCHITECTURE.md) has the detail.

## Security

- **Sign-in:** an email link (Supabase Auth); sessions live in httpOnly cookies, and there is no browser database client.
- **Isolation:** every account has its own workspace, kept apart by row-level security. That is proven by tests against a real Postgres, not by mocks.
- **Protections:**
  - rate limits on sign-in and Gmail;
  - a per-request nonce Content Security Policy and security headers;
  - no secrets in the browser bundle.
- **The demo:** a separate, server-signed session. It never reaches Supabase or a real account (D-035).

## Gmail

A read-only Gmail connector is implemented: it notices what you send to, and receive from, people you track, and never sends, changes or deletes mail. It is **switched off** (D-034). Public use needs Google's verification of the restricted `gmail.metadata` scope, which hasn't been started. Without it, "Mark as sent" records sent messages by hand.

## Local setup with accounts

Requires Node 24+, pnpm 11 and Docker.

```sh
pnpm db:start                      # local Supabase: Postgres, Auth, the Data API, and Mailpit
cp .env.example .env.local         # set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY from db:start's output
pnpm dev                           # http://localhost:3001
```

To sign in, choose **Sign in** and enter any address, then open the link from Mailpit (the `MAILPIT_URL` that `db:start` prints). A new address starts onboarding.

`REACHOUT_DEV_SEED=true pnpm dev` runs as the seed student without sign-in, in development only.

## Testing

```sh
pnpm check     # format, lint, typecheck, unit and component tests, build
pnpm test:db   # Repository contract, two-account isolation and rate limits, on the local Supabase
pnpm db:test   # pgTAP: RLS, grants and function ownership, inside Postgres
```

## Configuration and deployment

All settings are server-only environment variables, listed in `.env.example`.

- **Production** needs `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and `REACHOUT_RATE_LIMIT_SECRET`.
- **Gmail** stays off unless `REACHOUT_GMAIL_ENABLED=true`.

Reachout isn't deployed. [docs/launch-checklist.md](docs/launch-checklist.md) lists every step a hosted launch needs (Supabase projects, Auth, SMTP, domain).

## Docs

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
| [docs/launch-checklist.md](docs/launch-checklist.md) | What a hosted launch needs                        |
