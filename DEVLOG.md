# Devlog

Newest first. One entry per working session: what changed, why, and what is next. Durable decisions go in DECISIONS.md, not here.

## 2026-10-04 · Phase 0: Foundation

Started Reachout from scratch as a technical foundation and documentation pass. No visual design.

**Built**

- Next.js 16.3 / React 19.2 / TypeScript 5.9 (strict) / Tailwind 4 / Zod 4 / Vitest 5 + Testing Library. pnpm, ESLint with architecture-boundary rules, Prettier.
- Domain model in `src/domain/`:
  - entities: User, Company, Person, Opportunity, Interaction, Draft, NextAction, SourceFact, Interpretation;
  - rules: draft approval, next-action complete/snooze/reschedule, relationship transitions;
  - derivations: outreach state, Today;
  - cross-record integrity checks.
- A user-scoped `Repository` interface and an in-memory seed repository. The seed dataset is relative to an anchor date: 10 people, 6 opportunities, 5 companies, 14 interactions, 3 drafts, 8 next actions, 6 facts, 2 interpretations.
- Server boundary: `getRepository()` → `requireSession()`. The auth stub runs as the seed user in development and fails closed in production.
- Route scaffold: `/` redirects to `/today`; the `(app)` group holds today, people, opportunities, outreach, companies and settings; `/onboarding` sits outside it. All pages are unstyled placeholders.
- Docs: PRODUCT, DOMAIN, ARCHITECTURE, DESIGN, DECISIONS (D-001 to D-020), ROADMAP, CLAUDE.

**Tooling found or installed**

- better-ui, emil-design-eng, Impeccable 4.5.0 and crafted-frontend-ui were already installed as user-level skills. They were not duplicated into the repository.
- The BoardUI agent skill was installed project-level and set to explicit invocation; `boardui init` was not run.
- The Impeccable 4.4.0 plugin was not enabled here (D-019).

**Verified:** `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (62 tests), `pnpm build`.

**Next:** phase 1, visual design exploration.
