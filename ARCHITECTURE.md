# Architecture

## Stack

| Concern         | Choice                                                                                                 | Notes                                                                                                                                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework       | Next.js 16.3 (App Router, Turbopack), React 19.2                                                       | `typedRoutes` on. Middleware is called **Proxy** in v16. Read `node_modules/next/dist/docs/` before using APIs (see AGENTS.md)                                                                  |
| Language        | TypeScript 5.9, strict + `noUncheckedIndexedAccess`, `noImplicitOverride`, `noImplicitReturns`         | TypeScript 7 not adopted yet (D-017)                                                                                                                                                            |
| Styling         | Tailwind CSS 4, CSS modules                                                                            | The locked tokens (DESIGN.md) are CSS variables on `:root` in `app/globals.css`; the fonts load in `app/fonts.ts`. Components style themselves with CSS modules carrying the prototype's values |
| Validation      | Zod 4                                                                                                  | Domain schemas are the source of truth for record shapes                                                                                                                                        |
| Data and auth   | Supabase: Postgres 17 and Auth, through `@supabase/ssr` and `@supabase/supabase-js` on the server only | The Supabase CLI (a dev dependency) runs the local stack, migrations and pgTAP. No ORM (D-027)                                                                                                  |
| Tests           | Vitest 5, Testing Library, jsdom                                                                       | Playwright once browser-critical flows exist (roadmap phase 2)                                                                                                                                  |
| Lint / format   | ESLint 9 (`eslint-config-next`), Prettier 3 + Tailwind plugin                                          | Zero warnings allowed; architecture boundaries are lint rules                                                                                                                                   |
| Package manager | pnpm 11, Node ≥ 24                                                                                     |                                                                                                                                                                                                 |

Scripts: `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm typecheck` (`next typegen && tsc`), `pnpm test`, `pnpm format`, `pnpm format:check`, and `pnpm check` (all of them in CI order).

## Folders

```
src/
  app/          Routes only. Thin: read through src/server, render feature UI, hold the Server Actions.
    (app)/      Signed-in area: today, people, opportunities, outreach, companies, settings; actions.ts
    onboarding/ Outside the app shell; its own Server Action
    sign-in/    Public: email-link sign-in
    auth/       The link's landing route (confirm) and the sign-in/sign-out actions
    error.tsx   A calm page when something can't load
  proxy.ts      Per-request CSP nonce, session refresh and optimistic redirects (Next's Proxy). Never the only check.
  domain/       Pure TypeScript: Zod schemas, types, rules, derivations. No I/O, no React, no clock.
  data/         The Repository interface and its implementations.
    memory/     In-memory repository (tests, design references, the development seed session)
    seed/       Seed dataset
    supabase/   The durable repository: row mapping, generated database types
  integrations/ Provider adapters, server-only. They translate; the rules stay in the domain.
    gmail/      OAuth (PKCE), the three Gmail reads, message mapping, and the sync
  server/       Server-only composition: config, Supabase client, auth boundary, getRepository(), Gmail flows,
                secret sealing, rate limits, CSP. The only place that picks a data source.
  features/     Per product area: loaders and workflow steps (take a Repository), and that area's UI.
    shell/      The app shell: desktop rail, phone tab bar.
    workspace/  The user's records for the screens: loader, record index, state, workflow steps (operations.ts), actions contract (outcome.ts).
    today/      Today: wording, focus, actions, desktop and phone compositions.
    people/     People: grouping and search, knowledge, desktop and phone compositions. Reuses Today's actions.
    pursuing/   Pursuing (route /opportunities): timing groups, stage path, activity, desktop and phone compositions.
    outreach/   Outreach: one track per person grouped by action state, acted on in place; desktop and phone compositions.
    companies/  Companies: derived aggregates (opportunities, people, history) per company; desktop and phone compositions.
    settings/   Settings: profile and goals (saved), Gmail, the account, and what isn't built yet, said plainly.
    onboarding/ Onboarding: seven questions, then the records they create, saved once, opening Today.
    sign-in/    Sign-in, in onboarding's frame.
  components/   Shared presentational pieces: Avatar, icons, date wording.
  test/         Test setup, record builders, the Repository contract, database-test accounts.
supabase/
  migrations/   Versioned schema: tables, constraints, indexes, RLS, grants, workflow functions.
  tests/        pgTAP checks of access rules, run inside Postgres.
  templates/    The sign-in email.
  config.toml   The local stack.
```

Add a folder when there is code for it. Do not create `lib/`, `utils/` or `helpers/` as dumping grounds: generic code goes next to its only user until a second user exists.

### Dependency rules (enforced by ESLint)

```
app ──▶ features ──▶ domain
 │         │           ▲
 ▼         ▼           │
server ──▶ data ───────┘
```

| Layer             | May not import                                                |
| ----------------- | ------------------------------------------------------------- |
| `domain`          | React, Next.js, or any other `src/` layer                     |
| `data`            | React, Next.js, `app`, `components`, `features`, `server`     |
| `features`, `app` | `@/data/seed` — they take a `Repository` or call `src/server` |
| `components`      | `data`, `server`, `features`                                  |

Test files are exempt so they can use seed data as fixtures. Production code never imports the design prototypes in `src/app/prototypes` (lint, plus `app/boundaries.test.ts`); the prototypes import production modules instead. `app/boundaries.test.ts` also checks that:

- only `data/`, `server/` and the proxy import Supabase;
- production routes never use the session-only local actions;
- no application code reads a service key.

## Server / client boundary

- Pages and layouts are **Server Components** by default. Data is read on the server through `getRepository()`.
- `src/server/*` begins with `import "server-only"`. Importing it into a Client Component fails the build.
- Client Components (`"use client"`) receive plain, serialisable domain records, and Server Actions, as props. In production they never import `server/` or `data/`. The one exception is `createLocalActions`, which runs the workflow over the in-memory repository for tests and the design references only.
- Mutations are **Server Actions** (`app/(app)/actions.ts`, `app/onboarding/actions.ts`, `app/auth/actions.ts`). Each one is reachable by a direct POST, so each:
  - parses its input with Zod;
  - takes the user from the session, never from the input (`getRepository()`);
  - runs one workflow step (`features/*/operations.ts`), which applies a pure domain function and persists the result.
- Pages pass the actions to the screens as plain objects (`WorkspaceActions`, `SettingsActions`, `CompleteOnboarding`), so features never import `server/`. Tests and the design references pass `createLocalActions` instead, which runs the same steps over an in-memory repository.
- **A screen changes only once the save answers.** Failures are announced in calm words (`problemMessage`) and offer no Undo. A second click while saving does nothing. After a saved change the action calls `refresh()`, so the shell (Today's dot) catches up.
- Vitest cannot render async Server Components. Test their loaders (`features/*/load-*.ts`) directly, and cover full pages with Playwright later.
- **What a link or a refresh must keep lives in the URL, by id.**
  - People's selected person is `/people?person=<id>`; Pursuing's selected opportunity is `/opportunities?opportunity=<id>`; Outreach's open track is `/outreach?person=<id>` (one track per person, D-014). Build links with `personHref`, `opportunityHref` and `outreachHref` (`features/sections.ts`), never with names or titles.
  - Screens read the id through `useUrlSelection` (`features/workspace/use-url-selection.ts`), validated with Zod. Unknown ids fall back to a default.
  - Desktop selection replaces the history entry; opening a record on a phone pushes one, so Back returns to the list. The native history methods keep `useSearchParams` in step without a server round trip.
  - Companies' selected company is `/companies?company=<id>`. `companyHref(id, from)` adds `from=<opportunity-id>` when a phone opens a company from an opportunity: Back returns to that opportunity, and the tab bar keeps Pursuing marked. `from` is used only if the opportunity exists and is at that company.

## Repository abstraction

[`src/data/repository.ts`](src/data/repository.ts) is the only way product code reads and writes records.

- **Scoped at creation.** A repository is created for one signed-in user (and their workspace), so no method takes a `userId` and no caller can forget the ownership filter.
- **Plain interface, no factory hierarchy.** One object grouped by entity: `repo.people.list()`, `repo.drafts.approve(…)`, `repo.research.facts(subject?)`.
- **Ordering is part of the contract** (documented on the interface), so callers never re-sort for correctness. Implementations sort in TypeScript with the same comparators, so collation can't differ.
- **Writes are explicit, one per workflow step:**
  - each takes the domain's result and the `updatedAt` the caller read (`expected`), and returns the saved records with an `undo` step;
  - it throws `DomainError` (a rule) or `RepositoryError` (`not_found`, `conflict`, `onboarding_complete`, `undo_unavailable`, `invalid`, `unauthenticated`, `unavailable`);
  - there is no generic CRUD.
- **The contract is tested.** `src/test/repository-contract.ts` runs against the in-memory repository in `pnpm test` and against Supabase in `pnpm test:db`.

## In-memory repository

- [`createMemoryRepository`](src/data/memory/memory-repository.ts) holds a validated RecordSet, refuses inconsistent data (`findIntegrityViolations`), returns copies, and mirrors the database functions' checks: ownership, version, transition, once-only onboarding and exact undo.
- [`createSeedDataset(anchor)`](src/data/seed/dataset.ts) builds a realistic fictional dataset: one student, 5 companies, 10 people, 6 opportunities, 14 interactions, 3 drafts, 8 next actions, plus facts and interpretations. Every date is relative to `anchor`.
- **Used by:** tests, the design references (always the seed data, development only), and the development seed session (`REACHOUT_DEV_SEED=true`, never in production; it lasts until the server restarts).
- No code may branch on seed names or ids.

## Persistence

PostgreSQL on Supabase (D-025, D-027). The schema is in [`supabase/migrations/`](supabase/migrations/), applied in order to a fresh database.

- **Accounts:**
  - `profiles` is the domain's User, keyed by the Auth user id;
  - `workspaces` holds one personal workspace per account;
  - `workspace_members` says who may use each workspace.
- **Records:**
  - one table per domain entity: companies, people, opportunities (with `opportunity_people` for `personIds`, in order), interactions, drafts, next_actions, source_facts, interpretations (with `interpretation_facts`);
  - every row carries `workspace_id`;
  - discriminated unions are a type column plus nullable columns, guarded by check constraints that mirror the Zod invariants;
  - DOMAIN.md's cross-record rules are declarative where possible: one open follow-up per person (partial unique index), a sent draft pointing at a `message_sent` to the same person (composite foreign key), unique company names per workspace (generated key).
- **Integrity:**
  - references are composite foreign keys on `(workspace_id, id)`, so nothing points across workspaces;
  - they never cascade, so deleting something that history points at fails;
  - only removing a workspace (with its account) removes its records.
- **Not stored:** Today, outreach state, timing groups and company aggregates are derived on read. Instants are `timestamptz` in UTC; dates are `date`.
- **Indexes** follow the reads and the foreign keys: membership by profile, each table by `(workspace_id, id)`, people and opportunities by company, interactions by person and time, drafts by person and status, next actions by status and due date, and the polymorphic subjects of facts and interpretations.
- **Row-level security** is on every table. Members of a workspace can read its rows (`private.member_workspaces()`); each profile is readable only by its own user.
- **Grants:**
  - the Data API's `authenticated` role can only `SELECT`;
  - `anon` can do nothing;
  - the `private` schema (helpers, `undo_steps`) is closed to both.
- **Writes** are SQL functions in `supabase/migrations/…_workflow_functions.sql`:
  - each is owned by `reachout_writer` (no login, no RLS bypass) and callable only by signed-in users;
  - each re-checks visibility, the caller's version and the transition, in one transaction, and records an undo step.
- **The Supabase repository** ([`src/data/supabase/`](src/data/supabase/)) reads through the Data API as the user, maps rows to domain records explicitly (`rows.ts`), parses every row with the domain schemas, and writes only through those functions. Database types are generated (`pnpm db:types`).
- **First sign-in:** `getRepository()` finds the user's workspace, or calls `bootstrap_account`, which creates the profile, workspace and membership idempotently.
- **Migrations:**
  - add one with `pnpm exec supabase migration new <name>`, apply from scratch with `pnpm db:reset`, then regenerate types with `pnpm db:types`;
  - never change the schema in the dashboard;
  - deployed migrations are never edited: add a new one.

## Authentication

Supabase Auth, signing in by email link (D-026). See [`src/server/auth.ts`](src/server/auth.ts) and [`src/server/config.ts`](src/server/config.ts).

- **Modes** (`authMode()`):
  - `supabase`: requires `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`, https unless the URL is on this machine;
  - `seed`: `REACHOUT_DEV_SEED=true`, development only, refused in production;
  - otherwise it throws `AuthNotConfiguredError`, so an unconfigured deployment serves nothing.
- **Session:** `getSession()` verifies the JWT from the httpOnly cookies on the server (`getClaims`), and nothing the browser sends can choose the user. `requireSession()` redirects to `/sign-in` without one. `getRepository()` calls it, so every read and write is authenticated by construction.
- **Proxy** ([`src/proxy.ts`](src/proxy.ts)):
  - refreshes the session cookies before rendering;
  - sends signed-out page loads to `/sign-in?next=<path>`, and signed-in visits to `/sign-in` on to the app;
  - skips static files;
  - is never the only check.
- **Sign-in:**
  - `/sign-in` asks for an email and calls `signInWithOtp` from a Server Action;
  - the return path waits in a short-lived httpOnly cookie, checked by `safeNextPath` when the link is used (no open redirects);
  - `/auth/confirm` exchanges the link's token hash (or code) for a session, or returns to `/sign-in?error=link`.
- **Sign-out:** a Server Action in Settings ends this browser's session.
- **Routing:**
  - `/` goes to `/onboarding` until onboarding is complete, then to `/today`;
  - the app layout and the onboarding page make the same redirects;
  - these redirects are routing, not security.
- **Protected routes:** everything except `/sign-in`, `/auth/*` and the development-only `/prototypes`.
- **Timeouts:** every Supabase call is abandoned after 10 seconds and reported as unavailable, so nothing hangs.

## Email integration: Gmail, read-only (D-031)

Gmail is a correspondence connector, separate from sign-in. It never sends, changes or deletes mail. Manual "Mark as sent" stays as the fallback, and is final (D-030).

- **Launch gate (D-034):** Gmail is off unless `REACHOUT_GMAIL_ENABLED=true` and all four settings are present (`gmailConfig()`).
- **When off:**
  - Settings says "Coming later", with no Connect;
  - `startGmailConnection` refuses;
  - the callback redirects to `/settings` without acting;
  - sync returns `disabled`, and nothing reaches Google.
- **At launch:** public production leaves it off until Google verifies the scope.

- **Layers:**
  - `src/domain/correspondence.ts` holds the rules (matching, reconciliation);
  - `src/integrations/gmail/` translates Gmail (OAuth, API reads, message mapping, the sync loop) and imports no UI, routes or database client (lint);
  - `src/server/gmail.ts` assembles them for the signed-in user;
  - Server Actions (`connectGmail`, `checkGmail`, `disconnectGmailAccount`, `syncGmailOnEntry`) and the callback route (`app/(app)/settings/gmail/callback`) are thin.
  - React never calls Google, and provider shapes never reach the UI.
- **OAuth:**
  - the web-server flow with PKCE and `state`, for the `gmail.metadata` scope only;
  - the handshake is sealed in an httpOnly cookie on the callback path, for ten minutes, bound to the signed-in user;
  - the callback redirects only to `/settings?gmail=<outcome>`.
- **Tokens:**
  - the refresh token is sealed with AES-256-GCM (`src/server/secret-box.ts`, with the owner as associated data) and stored in `private.gmail_credentials`, which the Data API can't reach;
  - access tokens are minted per sync and never stored.
  - **Keys:** `GMAIL_TOKEN_ENCRYPTION_KEY` seals new tokens. During a rotation, `GMAIL_TOKEN_ENCRYPTION_KEY_PREVIOUS` still opens older ones until they are re-sealed (on reconnect) or the users reconnect. Losing both keys means every user reconnects; nothing else is lost.
- **Storage:**
  - `gmail_connections` holds the account, status, history cursor, last sync and lease;
  - `gmail_messages` maps a provider message id to the interaction it became, once per person, with a composite foreign key so a sent message can only map to a `message_sent` for that same person;
  - only matched mail is stored, as ordinary interactions.
- **Sync** (`syncGmail`):
  - triggered on entering the app (the shell calls `syncGmailOnEntry` after load, at most every ten minutes) and by "Check now" (rate-limited);
  - a database lease (`begin_gmail_sync`) allows one at a time per account;
  - it reads `history.list` from the cursor and fetches headers only for new messages (four at a time), matches and reconciles them in the domain, and records each through `record_gmail_message` in its own transaction;
  - a 20-second budget, 8-second request timeouts, and the cursor saved per change, so a stopped sync continues next time.
- **Failure:**
  - `invalid_grant`, a missing scope, or an unopenable credential → "needs reconnecting", and syncing stops;
  - an outage → `last_error = unavailable`, nothing changed, retried later;
  - an expired history cursor → continue from now (`history_reset`).
- **Not built:** sending, push notifications (Pub/Sub), importing mail from before the connection, Outlook.

## Security

- **Sessions:** httpOnly, `SameSite=Lax`, `Secure` in production; no browser Supabase client; the JWT verified on the server for every read and write.
- **Database:**
  - RLS on every table, including `private`;
  - the Data API can only read;
  - writes only through functions owned by `reachout_writer` (no login, no RLS bypass), each with `search_path = ''`;
  - the security-definer helpers that read membership are the only functions owned by `postgres`.
- **Rate limits** (D-032): `take_rate_limit` in Postgres, keyed by HMACs with `REACHOUT_RATE_LIMIT_SECRET`. It covers sign-in links (per address and per client), Gmail connections and "Check now"; the limits live in the function.
- **Headers** (D-033): a nonce-based CSP from the Proxy (no `unsafe-eval` in production), plus frame, MIME-sniffing, referrer, permissions, opener and HSTS headers from `next.config.ts`. `X-Powered-By` is off.
- **Inputs:**
  - every Server Action parses with Zod, with length caps;
  - redirects only go to fixed internal paths, or to `safeNextPath`;
  - errors shown to users are calm copy, never provider or database messages;
  - logs carry error kinds, never tokens or provider bodies.
- **Dependencies:** `pnpm audit --prod` before a release.

## AI boundary (future)

No AI SDK or provider is installed. When AI arrives:

- It lives in `src/ai/` (server-only), behind functions that take domain records and return domain records.
- **Inputs:** source facts, user notes, goals.
- **Outputs:** only `Interpretation` records (`generatedBy.kind: "model"`, citing facts, `review: "suggested"`) or `Draft`s with `origin: "generated"` in `awaiting_approval`.
- It may never create source facts, mark anything sent, change statuses, or complete actions.
- Today, outreach state and relationship rules never read AI output, so the product works identically with AI switched off.
- Every AI feature needs a DECISIONS.md entry before it is built (see CLAUDE.md).

## Validation

- **Records:** each entity's Zod schema, with refinements for invariants. Repositories parse what they load; domain mutations re-parse what they return.
- **Cross-record invariants:** `findIntegrityViolations`.
- **Boundaries:** Server Action inputs, route params and future provider payloads are parsed with Zod before reaching the domain.
- **Errors:** domain rules throw `DomainError` with a stable `code` for the UI to map to copy. Messages are for developers.

## Testing

Three layers, kept distinct:

- **Unit and component (`pnpm test`, part of `pnpm check`):**
  - domain rules and derivations, especially Today; builders in [`src/test/builders.ts`](src/test/builders.ts) construct fixtures through the real schemas;
  - feature loaders and workflow steps over the in-memory repository;
  - the server boundary: modes, fail-closed, the seed session refused in production, `safeNextPath`;
  - components with Testing Library, acting through `createLocalActions` and awaiting each saved answer;
  - `server-only` is aliased to a no-op under Vitest.
- **Repository contract and database (`pnpm test:db`, needs `pnpm db:start`):**
  - real accounts signed in by email link on the local Supabase;
  - the same Repository contract and Gmail sync contract (with Google faked) as in memory;
  - two-account isolation through the Data API: reads, reads by id, every workflow and Gmail function, direct writes to every table, and signed out;
  - racing first sign-ins and onboarding submissions;
  - rate limits.
  - These fail, rather than skip, if the local stack isn't running.
- **In Postgres (`pnpm db:test`):** pgTAP checks that every table (public and private) has RLS, the grants, that only the sign-in rate limit is callable signed out, function ownership by `reachout_writer`, credentials closed to the Data API, and isolation in plain SQL.
- **Google is never called by a test.** Gmail OAuth and API behaviour is tested against fakes at the `fetch` boundary; real Google is a launch check (docs/launch-checklist.md).
- **Browser (Playwright):** not installed yet. Runtime checks so far are headless-Chrome DOM measurements (no screenshots) recorded in DEVLOG.md.
- Test behaviour that could plausibly break. Do not write tests that restate a type.

## Deployment assumptions

- Likely Vercel, on the Node.js runtime, with a hosted Supabase project. Nothing is deployed yet: [docs/launch-checklist.md](docs/launch-checklist.md) lists what the live project needs first.
- **Configuration** (all server-only, read in `src/server/`; `.env.example` lists the names):
  - required: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and in production `REACHOUT_RATE_LIMIT_SECRET`;
  - Gmail, only when switched on (D-034): `REACHOUT_GMAIL_ENABLED=true`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_GMAIL_REDIRECT_URI`, `GMAIL_TOKEN_ENCRYPTION_KEY` (and `GMAIL_TOKEN_ENCRYPTION_KEY_PREVIOUS` during a rotation).
  - The application needs no service key. `.env*` files are gitignored.
- No custom servers, no edge runtime requirement, no background workers until Gmail sync needs them (decide then).

## Open technical decisions

- **Optimistic UI:** not used. A screen changes when the save answers, which keeps failures honest. Revisit if latency in production makes actions feel slow.
- **Collaborators in a workspace:** the storage allows it (D-025); the product doesn't. It needs a product decision first.
