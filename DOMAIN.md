# Domain

The smallest model that supports the core loop. The schemas in [`src/domain/`](src/domain/) are the source of truth; this document explains them. Every rule below is enforced by a schema, a domain function, or `findIntegrityViolations` ([`records.ts`](src/domain/records.ts)).

## Entities

| Entity         | Responsibility                                                 | Code                                        |
| -------------- | -------------------------------------------------------------- | ------------------------------------------- |
| User           | The account owner and their goals                              | [user.ts](src/domain/user.ts)               |
| Company        | Any organisation — an anchor for aggregation, not a CRM record | [company.ts](src/domain/company.ts)         |
| Person         | Someone the user may reach out to                              | [person.ts](src/domain/person.ts)           |
| Opportunity    | Something concrete the user is pursuing                        | [opportunity.ts](src/domain/opportunity.ts) |
| Interaction    | A dated event in the correspondence history                    | [interaction.ts](src/domain/interaction.ts) |
| Draft          | An unsent outgoing message, gated by approval                  | [draft.ts](src/domain/draft.ts)             |
| NextAction     | The next concrete step on a person or opportunity              | [next-action.ts](src/domain/next-action.ts) |
| SourceFact     | A checkable fact, with where it came from                      | [research.ts](src/domain/research.ts)       |
| Interpretation | Generated reasoning over facts — labelled, cited, reviewable   | [research.ts](src/domain/research.ts)       |

**Derived, never stored:** relationship-status transitions, outreach state, Today.

```
User ──owns──▶ every record below
Person ──────────▶ Company (0..1)
Opportunity ─────▶ Company (exactly 1)
Opportunity ─────▶ Person (many, via personIds)
Interaction ─────▶ Person (1), Opportunity (0..1)
Draft ───────────▶ Person (1), Opportunity (0..1); when sent ▶ its message_sent Interaction
NextAction ──────▶ Person and/or Opportunity (at least one), Interaction (0..1)
SourceFact ──────▶ subject: Person | Company | Opportunity
Interpretation ──▶ subject, plus the SourceFacts it is based on (1..n)
```

## Cross-cutting rules

**Ownership.** Single-user. Every record carries `userId`. A record may only reference records with the same owner. A `Repository` is created for one user, so no read can cross owners. There are no teams, workspaces or sharing.

**Ids** are opaque, branded strings (`PersonId` cannot be passed as an `OpportunityId`).

**Time.** `CalendarDate` (`YYYY-MM-DD`, the user's local day) for deadlines and due dates; `Instant` (UTC ISO 8601) for when things happened. Domain functions never read the clock — callers pass `today` / `at`. `today` is computed at the boundary from `User.timeZone` (`calendarDateIn`).

**Mutations** are pure functions that return a new, re-validated record (`approveDraft`, `completeNextAction`, …). They throw `DomainError` with a stable `code` when a rule is broken.

## User

The account owner. Identity (sign-in) belongs to the auth provider; this is the product profile.

- **Required:** `name`, `email`, `timeZone` (IANA).
- **Optional:** `education` (institution, course, graduationYear); `goals` (objective, targetRoles, targetSectors, targetLocations — each list non-empty); `onboardingCompletedAt`.
- **Objective:** `internship | graduate_role | startup_role | research | mentorship | other` — one primary objective.
- **Invariant:** completed onboarding ⇒ `goals` present.

## Company

Any organisation: employer, startup, university, lab. Created implicitly when a person or opportunity names it; the user is never asked to "maintain" companies. The Companies area aggregates people, opportunities and facts per organisation.

- **Required:** `name`. **Optional:** `website`, `sector`, `location`, `notes` (user).
- **Invariant:** names are unique per user, ignoring case and whitespace (`companyNameKey`). Implicit creation must match on this key rather than create duplicates.

## Person

First-class. A contact the user found somewhere and may reach out to.

- **Required:** `name`; context — a `role` or a `companyId` (at least one); `source` (`alumni_network | event | linkedin | company_website | university | publication | introduction | other`, plus optional `detail`); `relationshipStatus`.
- **Optional:** `email`, `linkedinUrl` (must be on linkedin.com — stored as a link only, never fetched), `location`, `whyRelevant` (user), `notes` (user), `preferredChannel` (`email | linkedin | other`), `outreachClosure` (`closedAt`, `reason: no_response | not_a_fit | completed`).
- **Linked opportunities** are held on `Opportunity.personIds`, not duplicated here.

### Relationship status

Qualitative, never a score: `new`, `contacted`, `replied`, `warm`, `dormant`. Stored on the person; recording an interaction applies `relationshipStatusAfter`:

| Interaction        | Effect                                                           |
| ------------------ | ---------------------------------------------------------------- |
| `message_sent`     | `new` / `dormant` → `contacted`; otherwise unchanged             |
| `message_received` | `new` / `contacted` / `dormant` → `replied`; otherwise unchanged |
| `meeting`          | same as `message_received`                                       |
| `note`             | unchanged                                                        |

Automatic transitions only move forward. `warm` and `dormant` are user judgements: never set automatically, never overwritten by an interaction (except that contact with a dormant person revives them). The user may set any status at any time.

## Opportunity

First-class. Something concrete the user is pursuing.

- **Required:** `title`, `companyId`, `status`, `personIds` (may be empty).
- **Optional:** `type` (`internship | graduate_role | startup_role | research | mentorship | referral | other`), `priority` (`high | medium | low`; absent = medium), `deadline`, `url`, `notes` (user), `closedReason`.
- **Stages:** `identified → researching → reaching_out → applied → interviewing → offer → closed`. The order is for display and sorting. Transitions are **not** forced through every stage: a referral can jump to interviewing; a mentorship never has an application. "Offer / Closed" from the brief survives as two stages, because an offer is still a live decision.
- **Closed** requires `closedReason` (`accepted | declined | rejected | withdrawn | no_response | expired`), and only closed opportunities have one.
- **Pre-application** (`identified`, `researching`, `reaching_out`) is the only window in which a deadline demands action.
- **`referral`** means a path into an organisation through a person when no specific role is posted. When a role exists, link the referrer to that opportunity instead.
- A person is linked at most once per opportunity.

## Interaction

The correspondence history: facts about the past. Future work is a `NextAction`, not an interaction.

- **Common:** `personId` (required — correspondence is always with someone), `opportunityId?`, `occurredAt`, `summary`.
- **Kinds:**
  - `message_sent` / `message_received` — `channel` (`email | linkedin | other`), optional `subject`, `body`.
  - `meeting` — `format` (`in_person | video | phone`).
  - `note` — a dated entry written by the user. Not an exchange.
- **Exchanges** are `message_sent`, `message_received` and `meeting`. Notes never affect who spoke last.

How the brief's interaction types map onto the model:

| Brief                    | Model                                                            |
| ------------------------ | ---------------------------------------------------------------- |
| email / LinkedIn message | `message_sent` with `channel`                                    |
| reply                    | `message_received`                                               |
| note                     | `note`                                                           |
| meeting                  | `meeting`                                                        |
| scheduled follow-up      | `NextAction` with `kind: follow_up`                              |
| completed follow-up      | that `NextAction` completed, plus the `message_sent` it produced |

## Draft

An outgoing message the user has not sent. Every message passes through explicit human approval.

- **Required:** `personId`, `channel`, `body`, `origin` (`user | generated`), `status`. **Optional:** `opportunityId`, `subject`.
- **Lifecycle:** `awaiting_approval → approved → sent`, or `→ discarded` from either pending state.
- **Invariants:**
  - Only an `approved` draft can be marked sent (`markDraftSent`). Approval cannot be skipped, including for generated drafts.
  - Approval covers the exact content: revising an approved draft returns it to `awaiting_approval`.
  - An email needs a `subject` before it can be approved.
  - A sent draft references the `message_sent` interaction it became, to the same person.
  - Sent and discarded drafts are immutable.

In V1 "send" means the user sends it from their own email or LinkedIn, then marks it sent. With Gmail, the same approval gate precedes the provider call.

## NextAction

The next concrete step. Not a general to-do list: every action is attached to a person or an opportunity (or both).

- **Required:** `kind` (`follow_up | reach_out | apply | prepare | research | other`), `title`, `dueOn`, `status`, and a `personId` or an `opportunityId`. **Optional:** `interactionId` (what prompted it).
- **Lifecycle:** `open → done` (`completedAt`) or `open → dismissed` (`dismissedAt`). Only open actions change.
- **Rules:**
  - A `follow_up` must name the person.
  - A person has at most one open follow-up.
  - Reschedule: the new due date cannot be in the past.
  - Snooze by _n_ whole days counts from today if the action is already due, otherwise from its due date.

## Research context: facts, notes, interpretation

Three layers, never collapsed into one field:

| Layer          | Example                                              | Where it lives                                     | Rules                                                                                                      |
| -------------- | ---------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Source fact    | "Graduated in CS from the University of Manchester." | `SourceFact` with `provenance` (kind, url, detail) | Checkable. Says where it came from.                                                                        |
| User note      | "Met at the careers fair."                           | `notes` / `whyRelevant` on the record              | The user's own words. Dated events go in `note` interactions.                                              |
| Interpretation | "Shared university background is a natural opening." | `Interpretation`                                   | Generated (`generatedBy: model \| rule`), cites ≥1 fact, has `review: suggested \| accepted \| dismissed`. |

- An interpretation is never treated as a fact. Accepting one records the user's verdict; it does not promote the text into a fact or a note.
- Deterministic product logic — Today, outreach state, relationship status — never reads interpretations.
- If the user adopts generated wording (for example as `whyRelevant`), it becomes a user note: the user is now asserting it.

**Future outreach intelligence** (ROADMAP phase 9, not built) adds no entity:

- A recommended angle is an `Interpretation` about the person, so it cites at least one source fact.
- A recommended draft is a `Draft` with `origin: "generated"`. It is approved like any other draft, and appears in Today as one awaiting approval.
- A suggested follow-up becomes a `NextAction` only when the user accepts it.
- It reads stored records only. It never writes facts or notes, and deterministic rules still never read interpretations.

## Outreach state (derived)

Where outreach to a person stands, from `deriveOutreachState` ([outreach.ts](src/domain/outreach.ts)). Evaluated in this order:

1. **closed** — `outreachClosure` exists and nothing newer has happened: no exchange after `closedAt`, and no pending draft updated after it.
2. **replied** — the latest exchange is the person's message or a meeting.
3. **draft** — a pending draft (awaiting approval or approved) exists.
4. **not_started** — no exchanges at all.
5. **follow_up_due** — the user's message is the latest exchange, and an open follow-up for the person is due today or earlier.
6. **sent** — otherwise: the user's message is the latest exchange.

Outreach state describes the current exchange; relationship status describes the longer-term relationship. They are deliberately separate. Known limitation: one outreach track per person, so concurrent outreach to the same person about two opportunities shares a state.

## Today (derived)

"What needs my attention today?" Computed by `deriveToday` ([today.ts](src/domain/today.ts)) from people, opportunities, interactions, drafts and open next actions on every read. Nothing about Today is stored and there is no task table behind it.

| Tier | Item                                             | Included when                                                                                                 | Order within tier                          |
| ---- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| 1    | `overdue_follow_up`                              | open `follow_up`, `dueOn` before today                                                                        | oldest due date first                      |
| 2    | `reply_awaiting_response`                        | the person's latest exchange is `message_received`, and outreach is not closed                                | longest waiting first                      |
| 3    | `deadline_approaching`                           | pre-application opportunity, deadline from today to **7** days ahead                                          | soonest; then priority high → medium → low |
| 4    | `draft_awaiting_approval`, `draft_ready_to_send` | draft awaiting approval; approved draft not yet sent                                                          | awaiting before approved; then oldest      |
| 5    | `upcoming_action`                                | any other open action due within **3** days — including follow-ups due today to +3 and overdue non-follow-ups | earliest due date first                    |

Further rules:

- **Suppression.** A follow-up is hidden when the person has a reply awaiting response (the reply supersedes it) or when outreach to them is closed.
- **Never empty while work exists.** If no item qualifies but open next actions exist, the single soonest one is shown as `upcoming_action`.
- **Excluded:** deadlines already passed, deadlines after applying, done or dismissed actions, sent or discarded drafts, interpretations.
- **Determinism.** Ties break on record id; output does not depend on input order (tested).
- The windows live in `TODAY_RULES`. Changing them is a product decision: record it in DECISIONS.md.

From Today the user can complete, snooze or reschedule a next action (`completeNextAction`, `snoozeNextAction`, `rescheduleNextAction`). Other items resolve through their own records: reply, approve, send, update the opportunity.

## Onboarding → records

Onboarding is a product flow, not a separate model. Its answers create ordinary records:

| Step                                                               | Creates                                                                                                      |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| 1–4. Objective, target roles, sectors, locations                   | `User.goals`                                                                                                 |
| 5. First opportunity (title, organisation, optional deadline/URL)  | `Company` (matched by name key, or created) + `Opportunity` (stage chosen by the user; default `identified`) |
| 6. First relevant person (name, role or organisation, where found) | `Person` with `source`, linked through `Opportunity.personIds`                                               |
| 7. First next action (what and when; default today)                | `NextAction` attached to that person and/or opportunity                                                      |
| Finish                                                             | `User.onboardingCompletedAt`                                                                                 |

Because step 7 always creates an open next action, Today is never empty after onboarding.

## Deliberately not modelled

| Concept                 | Why not                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------ |
| Campaign, Sequence      | Volume tooling. Contradicts quality over volume.                                           |
| Lead, Deal, Pipeline    | Sales framing. People are relationships; opportunity stages are not a sales funnel.        |
| Workspace, Team         | Single-user product.                                                                       |
| AnalyticsRecord, scores | No fake numbers. Success measures come from existing records.                              |
| Task                    | NextAction is deliberately attached and narrow.                                            |
| Thread / Conversation   | Outreach state derives per person. Revisit with Gmail threads (roadmap phase 7) if needed. |
| Tags                    | No demonstrated need yet.                                                                  |
