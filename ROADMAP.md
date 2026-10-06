# Roadmap

Each phase ends with its acceptance criteria met **and** human approval of anything visual. Passing tests are necessary but not sufficient.

**Changes from the original outline** (see D-020):

- Authentication and Persistence are merged into one phase (6). With Supabase they share the ownership and RLS design.
- Companies ships with Opportunities (4), because every opportunity creates or links a company.
- Phases 2–5 need writes before a database exists. They use an in-memory repository that is clearly non-durable and resets on restart. That is acceptable because nothing is deployed before phase 6.

| Phase | Name                          | Status                                                                                              |
| ----- | ----------------------------- | --------------------------------------------------------------------------------------------------- |
| 0     | Foundation                    | Done                                                                                                |
| 1     | Visual design exploration     | Done                                                                                                |
| 2     | Onboarding + first write path | Design approved; build not started                                                                  |
| 3     | Today + People                | **In progress**: shell, Today and People built and approved; adding and editing people not started  |
| 4     | Opportunities + Companies     | **Done**: Pursuing and Companies built and approved                                                 |
| 5     | Outreach & correspondence     | **In progress**: Outreach view built and approved; logging replies and closing outreach not started |
| 6     | Accounts & persistence        | Settings UI built and approved (session-only); accounts and persistence not started                 |
| 7     | Gmail integration             | Not started                                                                                         |
| 8     | Polish & launch preparation   | Not started                                                                                         |
| 9     | Outreach intelligence         | Future                                                                                              |

## 0 · Foundation (done)

**Objective:** a technical and product foundation that later phases build on without re-deciding anything.

**Acceptance:** the domain model, repository abstraction, seed data, route scaffold, auth boundary, tests and docs exist. `pnpm check` passes. No visual decisions have been made.

## 1 · Visual design exploration

**Objective:** choose a visual direction from rendered evidence.

- Explore two or three genuinely different concepts in isolation (a branch or worktree), using seed data.
- Each concept renders: Today on desktop and mobile; a person with history and research context; one onboarding step.

**Acceptance:**

- The human has reviewed the rendered concepts and selected one.
- DESIGN.md is rewritten: typography, colour, density, layout, navigation (desktop, tablet, mobile), components, motion, motifs, and what each reference contributes.
- It is decided whether BoardUI is adopted, and how.
- No production UI is merged before this.

## 2 · Onboarding + first write path

**Objective:** a new user reaches a useful Today.

**Scope:**

- The onboarding flow from PRODUCT.md.
- Repository write methods for user goals, company find-or-create by name key, opportunity, person and next action.
- Server Actions validated with Zod.
- An in-memory writable repository.
- A way to start as a fresh user in development.
- Playwright, set up with the first end-to-end test.

**Acceptance:**

- Onboarding can be completed by keyboard alone, at 320 px and on desktop.
- It always ends on a Today with at least one item.
- Invalid input shows field-level errors.
- The Playwright test passes.
- Human visual approval.

## 3 · Today + People

**Objective:** the daily loop works.

**Scope:**

- The Today screen, with complete, snooze and reschedule.
- People list and person view: history, relationship status, and research context, with source facts, user notes and generated interpretations visibly distinct.
- Adding and editing people, with source required.

**Acceptance:**

- Today shows exactly what `deriveToday` returns, in order.
- Actions persist for the session.
- Status changes follow `relationshipStatusAfter` and can be overridden manually.
- Accessible and responsive.
- Human visual approval.

## 4 · Opportunities + Companies

**Objective:** track what the user is pursuing, and who is involved.

**Scope:**

- Opportunity list and detail: stages, deadline, priority, linked people, closing with a reason.
- Companies as an aggregated view of people, opportunities and facts.
- Implicit company creation, with no duplicate names.

**Acceptance:**

- Deadlines feed Today correctly.
- Companies never require separate data entry.
- Human visual approval.

## 5 · Outreach & correspondence

**Objective:** draft, approve, send manually, follow up, and track.

**Scope:**

- Drafts, with the approval gate.
- "Mark as sent": records a `message_sent` and the sent draft, and offers a follow-up.
- Logging replies, meetings and notes, which applies relationship transitions.
- Closing outreach.
- An Outreach view grouped by derived state.

**Acceptance:**

- An unapproved draft cannot be sent through any path.
- Editing an approved draft requires re-approval.
- States match `deriveOutreachState`.
- Playwright covers the core loop.
- Human visual approval.

## 6 · Accounts & persistence

**Objective:** real users, real data, deployed.

**Scope:**

- Supabase Auth: sign-in and callback routes, and `getSession()` wired to the provider.
- First-run `User` creation, and routing to onboarding until it is complete.
- A Postgres schema mirroring the domain, with RLS on `user_id`.
- A Postgres `Repository`.
- Settings: goals, profile, time zone.
- Account deletion.
- A preview deployment.
- Decide `cacheComponents` (D-018).

**Acceptance:**

- Loader tests pass against both repositories.
- A test proves that two users cannot see each other's records.
- Production no longer fails closed.
- No secrets in the repository.

## 7 · Gmail integration

**Objective:** send approved drafts and notice replies without leaving Reachout.

**Scope:**

- Gmail OAuth with minimal scopes.
- Sending approved drafts only.
- Reply detection in tracked threads.
- Idempotent sync through an adapter-owned id mapping.

**Acceptance:**

- A sent message produces exactly one `message_sent`.
- A reply produces exactly one `message_received` and appears in Today.
- No inbox-wide import.
- Disconnecting removes the tokens.

## 8 · Polish & launch preparation

**Objective:** ready for real students.

**Scope:**

- Critique and refinement passes (Impeccable, better-ui, emil-design-eng, each in its own role).
- An accessibility audit.
- A performance budget.
- Error monitoring.
- A privacy policy covering data about third parties.
- A pilot with a small group of students.

**Acceptance:**

- No known WCAG 2.2 AA failures.
- Pilot users complete onboarding and act from Today unassisted.

## 9 · Outreach intelligence (future)

**Objective:** use the context already in Reachout to propose one grounded outreach angle, one grounded draft and a sensible follow-up for a person (PRODUCT.md, D-022).

**Prerequisites:** phases 2–8, which bring the core surfaces, accounts and persistence, and the Gmail foundation.

**Possible scope:**

- Identify the strongest angle for a person from stored context only.
- Explain why that angle was chosen, citing the facts and notes it rests on.
- Generate one draft from it (`origin: "generated"`) that goes through the normal approval gate.
- Suggest follow-up timing, which becomes a next action only if the user accepts it.

**Before starting:** a DECISIONS.md entry, approved by the human, covering the model provider, how information about third parties is handled, and how quality is evaluated.

**Acceptance (to be refined):**

- Every angle and draft shows the stored records it used. Nothing generated is presented as fact.
- No draft is sent without explicit approval. There is no auto-send and no batch generation.
- It works only from stored context: no scraping, enrichment or browsing.
- Reachout stays fully usable with the feature off.
- Human visual approval.

## Not scheduled

Each of these needs its own DECISIONS.md entry before it enters the roadmap: Outlook, calendar awareness, user-initiated imports.
