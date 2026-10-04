# Architecture

## Stack

| Concern         | Choice                                                                                         | Notes                                                                                                                                                                                     |
| --------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework       | Next.js 16.3 (App Router, Turbopack), React 19.2                                               | `typedRoutes` on. Middleware is called **Proxy** in v16. Read `node_modules/next/dist/docs/` before using APIs (see AGENTS.md)                                                            |
| Language        | TypeScript 5.9, strict + `noUncheckedIndexedAccess`, `noImplicitOverride`, `noImplicitReturns` | TypeScript 7 not adopted yet (D-017)                                                                                                                                                      |
| Styling         | Tailwind CSS 4                                                                                 | Only `@import "tailwindcss"` so far. Design tokens and fonts are defined in DESIGN.md and currently live in the prototype CSS modules; they move into the app when production UI is built |
| Validation      | Zod 4                                                                                          | Domain schemas are the source of truth for record shapes                                                                                                                                  |
| Tests           | Vitest 5, Testing Library, jsdom                                                               | Playwright once browser-critical flows exist (roadmap phase 2)                                                                                                                            |
| Lint / format   | ESLint 9 (`eslint-config-next`), Prettier 3 + Tailwind plugin                                  | Zero warnings allowed; architecture boundaries are lint rules                                                                                                                             |
| Package manager | pnpm 11, Node ≥ 24                                                                             |                                                                                                                                                                                           |

Scripts: `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm typecheck` (`next typegen && tsc`), `pnpm test`, `pnpm format`, `pnpm format:check`, and `pnpm check` (all of them in CI order).

## Folders

```
src/
  app/          Routes only. Thin: read through src/server, render feature UI.
    (app)/      Signed-in area: today, people, opportunities, outreach, companies, settings
    onboarding/ Outside the app shell
  domain/       Pure TypeScript: Zod schemas, types, rules, derivations. No I/O, no React, no clock.
  data/         The Repository interface and its implementations.
    seed/       Seed dataset + in-memory repository (development and tests)
  server/       Server-only composition: auth boundary, getRepository(). The only place that picks a data source.
  features/     Per product area: loaders (take a Repository) and, later, that area's UI.
  components/   Shared presentational components (currently only RoutePlaceholder).
  test/         Test setup and record builders.
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

Test files are exempt so they can use seed data as fixtures.

## Server / client boundary

- Pages and layouts are **Server Components** by default. Data is read on the server through `getRepository()`.
- `src/server/*` begins with `import "server-only"`. Importing it into a Client Component fails the build.
- Client Components (`"use client"`) receive plain, serialisable domain records as props. They never import `server/` or `data/`.
- Mutations will be **Server Actions**. Each one validates its input with Zod, gets the repository via `getRepository()`, applies a pure domain function (e.g. `completeNextAction`), and persists the result. The action file stays thin; the rules live in `domain/`.
- Vitest cannot render async Server Components. Test their loaders (`features/*/load-*.ts`) directly, and cover full pages with Playwright later.

## Repository abstraction

[`src/data/repository.ts`](src/data/repository.ts) is the only way product code reads records.

- **Scoped at creation.** A repository is created for one user, so no method takes a `userId` and no caller can forget the ownership filter.
- **Plain interface, no factory hierarchy.** One object grouped by entity: `repo.people.list()`, `repo.research.facts(subject)`.
- **Ordering is part of the contract** (documented on the interface), so callers never re-sort for correctness.
- **Writes arrive with the features that need them**, next to the domain operation they persist (for example `nextActions.save(completeNextAction(...))`).
- Feature loaders take a `Repository` parameter, so they are tested against the seed repository with no mocking.

## Seed repository

- [`createSeedDataset(anchor)`](src/data/seed/dataset.ts) builds a realistic fictional dataset: one student, 5 companies, 10 people, 6 opportunities, 14 interactions, 3 drafts, 8 next actions, plus facts and interpretations. Every date is relative to `anchor`, so the data stays plausible on any day. Development uses today's date; tests pin a date.
- The whole set is parsed through `RecordSetSchema` and checked with `findIntegrityViolations` (ownership, references, uniqueness). The repository refuses inconsistent data.
- It is read-only and returns copies.
- No code may branch on seed names or ids.

## Persistence (future)

PostgreSQL, most likely on Supabase (D-007). No database exists yet: no hosted project, credentials, migrations or RLS.

When it arrives (roadmap phase 6):

- Tables mirror the domain entities. Every owned table has `user_id`; references are foreign keys. Discriminated unions (interaction kind, draft status, next-action status) become a type column plus nullable columns, guarded by check constraints matching the Zod invariants.
- Add `src/data/postgres/` implementing the same `Repository` and validate rows with the same schemas on read. Change `getRepository()` in [`src/server/repository.ts`](src/server/repository.ts), and nothing else.
- Row-level security mirrors the ownership rule (`user_id = auth.uid()`) as defence in depth. The repository's own scoping stays.
- `findIntegrityViolations` becomes the reference for which constraints the schema must enforce.
- Run the existing loader tests against both implementations.

## Authentication

Authentication is a hard requirement and is **not operational**. See [`src/server/auth.ts`](src/server/auth.ts).

- **Authenticated user:** a `Session` (`userId`, `method`) whose `userId` is a `User.id`. Sign-in identity belongs to the provider; the product profile is the `User` record.
- **Where the session enters:** only through `getSession()` / `requireSession()`. `getRepository()` calls `requireSession()`, so every data read is authenticated by construction. Following Next's guidance, access control sits in this data access layer, not in layouts, because layouts do not re-run on navigation.
- **Protected routes:** everything under `(app)/` and `/onboarding`. Today's pages are static placeholders that read no data. Once they read data, they are protected through `getRepository()`.
- **Current behaviour:** outside production, every request is the seed user (`method: "development"`). In production, `getSession()` throws `AuthNotConfiguredError`, so an unconfigured deployment fails closed.
- **Provider integration point (phase 6, likely Supabase Auth):**
  - `getSession()` reads the provider session from cookies and maps it to `Session`.
  - Add public `/sign-in` and an auth callback route.
  - `requireSession()` redirects to sign-in instead of throwing.
  - Optionally add `src/proxy.ts` for optimistic redirects based on the cookie alone. Proxy is never the only check.
  - On first sign-in, create the `User` record, then route to `/onboarding` until `onboardingCompletedAt` is set.

## Email integration boundary (future)

Gmail first (roadmap phase 7). Nothing is implemented, and the domain stays provider-independent: `channel: "email"` covers every provider.

- An adapter in `src/integrations/gmail/` (server-only) translates in both directions. The domain never imports it.
- **Outbound:** only an `approved` Draft can be sent. On provider success, record a `message_sent` Interaction and mark the draft `sent` (`markDraftSent`). On failure, the draft stays approved.
- **Inbound:** a provider message in a tracked thread becomes a `message_received` Interaction for the matching person. The user is never asked to sync their whole inbox.
- Provider ids (message id, thread id) go in an adapter-owned mapping table keyed by interaction or draft id, which also makes sync idempotent. They are not added to domain records.
- OAuth tokens are stored server-side and encrypted, scoped to the minimum Gmail permissions.
- No SMTP, Resend, Microsoft or inbox-wide sync until a decision says otherwise.

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

- **Unit (Vitest):** domain rules and derivations, especially Today. Builders in [`src/test/builders.ts`](src/test/builders.ts) construct fixtures through the real schemas.
- **Integration (Vitest):** feature loaders over the seed repository; the server boundary (auth stub, fail-closed).
- **Components (Testing Library):** synchronous components only. `server-only` is aliased to a no-op under Vitest.
- **Browser (Playwright, from phase 2):** onboarding end-to-end, then the core loop. Not installed yet.
- Test behaviour that could plausibly break. Do not write tests that restate a type.

## Deployment assumptions

- Likely Vercel, on the Node.js runtime. Nothing is deployed until authentication and persistence exist (phase 6). Production fails closed before then.
- Secrets go only in environment variables, read only in `src/server/` and future adapters. `.env*` files are gitignored.
- No custom servers, no edge runtime requirement, no background workers until Gmail sync needs them (decide then).

## Open technical decisions

- **`cacheComponents` (Partial Prerendering):** off. Revisit when real per-user data arrives, since it changes how dynamic reads must be wrapped (D-018).
- **Postgres access layer** (Supabase client, an ORM such as Drizzle, or SQL): decide in phase 6.
- **Optimistic UI and caching for mutations:** decide with the first write path (phase 2).
