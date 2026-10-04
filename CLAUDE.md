# Working on Reachout

Reachout helps students and recent graduates create real opportunities through thoughtful, human-controlled outreach. These rules are for any agent working in this repository. They override generic habits and the defaults of any skill.

## Read before working

| Doc                                | Read when                                                      |
| ---------------------------------- | -------------------------------------------------------------- |
| [PRODUCT.md](PRODUCT.md)           | Always: what the product is and is not                         |
| [DOMAIN.md](DOMAIN.md)             | Any change touching records, rules, Today or status            |
| [DESIGN.md](DESIGN.md)             | Any change a user could see                                    |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Any change to structure, data access, auth or integrations     |
| [DECISIONS.md](DECISIONS.md)       | Before proposing anything that might contradict a decision     |
| [ROADMAP.md](ROADMAP.md)           | To know which phase you are in and what is out of scope        |
| [DEVLOG.md](DEVLOG.md)             | To see what happened recently; append an entry when you finish |

Current status: **phase 0 done. Phase 1, visual design exploration, is next. VISUAL DIRECTION: UNSETTLED.**

## Workflow

**UNDERSTAND → DIAGNOSE → DECIDE → SCOPE → IMPLEMENT → VERIFY → REVIEW → APPROVE → COMMIT**

1. **Understand:** read the relevant docs and code. Restate the task in product terms.
2. **Diagnose:** find the real cause or need, not the nearest symptom.
3. **Decide:** choose an approach. If it changes product behaviour or contradicts a decision, stop and ask. Record durable decisions in DECISIONS.md.
4. **Scope:** state what is in and what is out. Smallest change that fully solves it.
5. **Implement:** match the surrounding code.
6. **Verify:** `pnpm check` (format, lint, typecheck, test, build). All must pass. Report failures honestly, with output.
7. **Review:** reread your diff against these rules and the docs.
8. **Approve:** a human approves. Visual work needs human approval of the rendered result.
9. **Commit:** only after approval, and only when asked. Never push without being asked. No remote exists yet.

## Rules

### Scope and requirements

- **Do not invent missing requirements.** If the docs don't answer a material question, ask. Don't fill the gap with a guess.
- **No feature creep.** Build what the current roadmap phase needs. Note other ideas in your report; do not build them.
- **Do not casually reopen approved surfaces.** Once a screen or decision is approved, changing it needs a reason and the human's agreement.
- Keep docs true. If you change a rule, update DOMAIN.md and the tests in the same change.

### Design

- **VISUAL DIRECTION: UNSETTLED.** Until DESIGN.md says otherwise, do not choose fonts, colours, radii, shadows, spacing scales, layout systems, navigation styling or motion.
- **Uncertain or major visual work requires isolated design exploration first**, on a separate branch or worktree, with genuinely different options rendered and shown to the human.
- **Implementation passing tests ≠ visual approval.** Never describe UI as done, polished or production-ready on the strength of code, tests or a build.
- **Human visual approval wins** over any skill's opinion, any reference, and your own taste.
- **Do not take screenshots unless explicitly requested**, even when a skill suggests it. Ask first.
- Design skills have single responsibilities (DESIGN.md › Tooling). Don't stack them on one surface without naming the lead. Never let a component library become the visual identity, and do not run `boardui init` before the design phase approves BoardUI.
- Route placeholders are to be **replaced** by designed screens, never decorated.

### Architecture

- **Preserve the repository abstraction.** Product code reads data only through `Repository`. Only `src/server/repository.ts` chooses an implementation. Features and routes never import `@/data/seed` (lint-enforced).
- **Keep domain rules out of React components.** Rules live in `src/domain/` as pure functions with tests; components render their results.
- Domain code never reads the clock; pass `today` and `at` in.
- Every data read goes through `getRepository()`, and therefore through `requireSession()`. Never bypass it, and never pretend authentication is operational when it is not.
- Validate external input (forms, params, provider payloads) with Zod before it reaches the domain.
- Use the bundled Next.js docs: this Next.js version differs from older training data (see `@AGENTS.md` below).

### Data

- **Use realistic domain data.** Seed and fixtures are believable students, people and opportunities. No lorem ipsum, no joke data.
- **Never special-case demo names or ids** in product logic. Nothing may branch on "Aisha", `usr_01` or any seed value.
- Seed dates are relative to an anchor (`createSeedDataset(anchor)`). Do not hard-code calendar dates in seed text.
- No LinkedIn scraping or automation, no bulk sending, no numeric scores (D-004, D-005).

### AI

- **Do not silently add AI.** No AI SDK, provider, model call or "smart" heuristic presented as AI without a DECISIONS.md entry approved by the human.
- Generated content is always labelled (`Interpretation`, or `Draft.origin: "generated"`), cites facts, and passes human approval. It is never stored as a source fact, and deterministic rules never read it.

### Tests

- Test behaviour that could plausibly break, especially Today derivation and domain rules. Don't write tests that restate types.
- Build fixtures with `src/test/builders.ts` (validated by the real schemas). Use the seed repository for loader tests.
- Playwright arrives in phase 2. Don't add browser tests or tools before then.

### Reporting

- Report what you changed, what you verified (with the commands), and what you did not verify.
- If you skipped something, say so. If a check fails, show the output.

## Commands

```sh
pnpm dev           # local dev server (runs as the seed user)
pnpm check         # format:check → lint → typecheck → test → build
pnpm test:watch    # Vitest in watch mode
pnpm format        # apply Prettier
```

@AGENTS.md
