# Decisions

Durable decisions, numbered and never renumbered. To change one, add a new entry that supersedes it and mark the old one `Superseded by D-0xx`. All entries below were accepted on 2026-10-04 in the foundation pass.

## D-001 · V1 is for students and recent graduates

University students, final-year students and graduates up to about two years out, targeting software, technology, startups, finance, consulting and research. **Why:** their problem (few contacts, no structure, deadline-driven) is acute and specific. **Consequence:** no features for recruiters, teams or experienced professionals in V1.

## D-002 · Web only, responsive

V1 is one responsive web app for desktop, tablet and mobile. No native app, no Expo or React Native. **Why:** one codebase, and the core loop is reading and writing text. **Consequence:** mobile web must carry the full core loop (DESIGN.md).

## D-003 · Today is the centre of gravity, and it is derived

Today is computed from people, opportunities, interactions, drafts and next actions on every read, using deterministic, documented priority rules. There is no task table behind it. **Why:** a separate task list drifts from reality and duplicates state. **Consequence:** new attention signals become new rules in `deriveToday`, with tests and a DOMAIN.md update.

## D-004 · Quality over volume

No bulk sending, sequences, mail merge, or open and click tracking. **Why:** volume tools damage students' reputations and reply rates, and contradict the thesis. **Consequence:** bulk operations on outreach are out of scope even when easy to build.

## D-005 · No LinkedIn scraping or automation

LinkedIn exists only as an optional profile URL on a person and as a manual message channel. No scraping, automated messaging, browser automation or profile fetching. **Why:** terms of service, account risk to users, and the product's integrity. **Consequence:** capturing someone from LinkedIn is manual, so it must be fast.

## D-006 · Repository abstraction first, with seed data behind it

All reads go through a user-scoped `Repository` interface. The first implementation is an in-memory repository over a realistic seed dataset. **Why:** product and design work can proceed without a database, and the UI can never depend on where data comes from. **Consequence:** the interface stays small; write methods are added per feature; nothing outside `src/server/` chooses an implementation.

## D-007 · Database deferred; PostgreSQL on Supabase is the likely direction — _Superseded by D-025 and D-027_

No database, hosted project, credentials, migrations or RLS in the foundation. **Why:** the domain should settle first, and Supabase pairs naturally with Supabase Auth (D-008). **Consequence:** decided for real in roadmap phase 6, including the access layer.

## D-008 · Authentication is required; the provider is deferred; unconfigured production fails closed — _Provider decided by D-026_

Every data read passes through `requireSession()` inside `getRepository()`. Until a provider is wired, development runs as the seed user and production throws `AuthNotConfiguredError`. **Why:** a clean boundary now means adding a provider changes one file, and an accidental deployment cannot serve data. **Consequence:** nothing is deployed before phase 6. Supabase Auth is the likely provider.

## D-009 · AI is assistive, never autonomous

AI may later summarise, explain relevance, suggest angles, draft and suggest follow-ups. It may only produce `Interpretation` records (labelled, citing facts, user-reviewed) and `generated` drafts that still need approval. Source facts, user notes and generated interpretation stay separate. **Why:** trust, and the product must stay fully useful without an LLM. **Consequence:** no AI SDK or provider yet. Every AI feature needs its own decision entry.

## D-010 · Visual direction is deliberately deferred — _Superseded by D-021_

The foundation chooses no typography, colour, density, layout, navigation appearance, component style or motion. A dedicated design phase explores several genuinely different concepts, renders them with real data, and the human chooses one. **Why:** premature visual decisions harden into the product's identity by default. **Consequence:** route files are unstyled placeholders. See DESIGN.md.

## D-011 · Every outgoing message requires explicit human approval

Only an `approved` draft can be sent. Editing an approved draft returns it to `awaiting_approval`. This applies equally to drafts written by the user and generated drafts. **Why:** the user is accountable for what is sent in their name. **Consequence:** the Gmail integration sends approved drafts only.

## D-012 · Companies are thin and created implicitly

A company is any organisation (employer, startup, university, lab) with a name and optional website, sector, location and notes. It is created when a person or opportunity names it, matched by a normalised name. **Why:** students should not maintain CRM records; companies exist to aggregate people and opportunities. **Consequence:** no company-only workflows in V1.

## D-013 · Relationship status is stored, with forward-only automatic transitions

Statuses are `new`, `contacted`, `replied`, `warm` and `dormant`. Recording an interaction moves status forward (`relationshipStatusAfter`). `warm` and `dormant` are set only by the user. There are no numeric scores. **Why:** "warm" is a human judgement that cannot be derived, while the mechanical transitions should not need manual upkeep. **Consequence:** the stored status can be overridden by the user at any time.

## D-014 · Outreach state is derived per person; closure is stored on the person

`not_started`, `draft`, `sent`, `follow_up_due`, `replied` and `closed` are derived from interactions, drafts and next actions. Closing outreach stores `outreachClosure` on the person, and any later exchange or new draft reopens it. **Why:** no Thread entity is needed until a provider brings real threads. **Consequence:** one outreach track per person (known limitation). Revisit with Gmail.

## D-015 · Opportunity stages are ordered but transitions are not enforced

Stages run `identified → researching → reaching_out → applied → interviewing → offer → closed`, and closed requires a reason. Any move is allowed, because real paths skip stages. `referral` is an opportunity type only when no specific role is posted; otherwise the referrer is linked to the role. **Why:** this survived domain review; strict state machines fight reality for this user. **Consequence:** deadline rules key off "pre-application" stages, not off transitions.

## D-016 · Seed data is generated relative to an anchor date

`createSeedDataset(anchor)` places every date relative to the anchor. Development anchors on today; tests pin a date. **Why:** fixed dates rot within days, and Today would go stale. **Consequence:** seed text avoids absolute calendar dates.

## D-017 · Follow create-next-app's pins: TypeScript 5.9, ESLint 9, React 19.2

Next.js 16.3.8's own template pins these versions. TypeScript 7 and ESLint 10 exist but are not adopted. **Why:** stay on the combination Next tests. **Consequence:** revisit when Next's template moves (ESLint 9 is already marked deprecated upstream).

## D-018 · `cacheComponents` (Partial Prerendering) is off for now — _Superseded by D-029_

**Why:** it changes how dynamic, per-user reads must be structured, and there are no real per-user reads yet. **Consequence:** decide in phase 6, when sessions and real data arrive.

## D-019 · Design tooling is installed but inert until the design phase — _Superseded by D-021_

- better-ui, emil-design-eng and Impeccable are user-level skills that only run when explicitly invoked.
- crafted-frontend-ui is the owner's personal user-level skill.
- The BoardUI agent skill is installed in this project with `disable-model-invocation: true`. `boardui init` is not run.
- The older Impeccable 4.4.0 plugin is not enabled here, because of duplication and edit hooks.

**Why:** prepare the toolkit without letting any of it make visual decisions early. **Consequence:** DESIGN.md › Tooling defines each tool's single responsibility.

## D-020 · Roadmap order: Accounts and persistence after the core loop; Companies alongside Opportunities

The brief's separate Authentication and Persistence phases are merged into one, because with Supabase they share ownership and RLS design. That phase follows the core loop (onboarding through outreach). Companies ships with Opportunities, because every opportunity creates or links one. **Why:** fewer phases, no throwaway ordering. **Consequence:** feature phases 2–5 add write methods behind an in-memory repository that is explicitly non-durable. See ROADMAP.md.

## D-021 · Direction C ("Focus") is approved and the visual system is locked

_2026-10-04 · Accepted_

After exploring three directions and two refinement passes, the human approved Direction C as Reachout's visual language. DESIGN.md now records the locked system:

- a warm neutral canvas with one white sheet;
- ink-blue brand for location, selection and opportunities;
- marigold, red and green for status only;
- Bricolage Grotesque with Hanken Grotesk;
- restrained rounded surfaces and black primary actions;
- a labelled rail on desktop and a bottom tab bar on mobile;
- the date tile as a selective timing device;
- focus-first Today and relationship-first People, with "Why X matters" as a signature concept;
- facts, notes and interpretation visibly separated.

Rejected:

- **A · Briefing:** too editorial and passive.
- **B · Triage:** visually too dense, dark and enterprise or CRM-like. Some of its structural ideas survive in C.

BoardUI may supply individual behavioural primitives only, re-skinned with Reachout's tokens; `boardui init` is not run. **Onboarding is the next design surface**, built with this system.

**Why:** C makes "what should I do next, and why does this person matter" the centre of the product.

**Consequence:**

- New surfaces follow DESIGN.md rather than re-exploring.
- Changing the locked system needs a reason and the human's agreement.
- This supersedes D-010 (direction deferred) and D-019 (tooling inert).

## D-022 · Outreach intelligence is the long-term direction for AI: documented, not built

_2026-10-04 · Accepted_

Reachout's future assistance is **outreach intelligence**. It uses context the user has already stored to propose one grounded outreach angle and one grounded draft for a person, with why the angle was chosen and when to follow up. That context covers:

- the person and why they matter;
- the linked opportunity and the user's goal;
- source facts and the user's notes;
- relationship history, prior outreach and the open next action;
- interpretations.

It is not "AI writes cold emails".

- **Boundary:**
  - assistive and grounded in stored context only;
  - one recommended angle and one draft, both editable;
  - explicit approval before sending;
  - no autonomous outreach, auto-send, batch generation, scraping or enrichment.
- **Model:** no new entity. The angle is an `Interpretation`; the draft is a `Draft` with `origin: "generated"` (DOMAIN.md).
- **Sequencing:** ROADMAP phase 9, after the core surfaces, accounts and persistence, Gmail, and launch preparation. It is not part of the MVP.

**Why:** it is where the product started, and it should strengthen thoughtful outreach rather than automate volume.

**Consequence:**

- No AI SDK, provider or model call is added now.
- Building it needs a further entry approved by the human: provider, handling of third-party data, and evaluation.
- This refines D-009 rather than replacing it.

## D-023 · The core visual system is approved on desktop and phone; exploration is complete

_2026-10-04 · Accepted_

The human approved these surfaces, rendered:

- Today, desktop and phone;
- People, desktop;
- onboarding, desktop and phone.

They are frozen references for the rest of the product. Visual-system exploration, which began in phase 1 and finished with the onboarding design in phase 2, is complete.

The remaining core surfaces are built with the locked system as prototypes in review: Pursuing (Opportunities), Outreach, Companies and Settings. Their rules:

- **Navigation:** Settings joins the foot of the desktop rail. On a phone, it opens from the avatar; Companies opens from an opportunity.
- **No new language:** no new colours, faces, radii or patterns.
- **Honest settings:** features that don't exist yet are marked in words, never shown as controls that do nothing.

**Why:** the remaining work is building, not exploring. Every new surface should read as one product.

**Consequence:**

- Approved surfaces change only for a shared-system bug, with the human's agreement.
- The four new surfaces need human visual approval before they move towards production.
- People on a phone is still to be designed.

## D-024 · Every surface is approved on desktop and phone; the design is frozen

_2026-10-04 · Accepted_

The human approved, rendered:

- **Surfaces:** Today, People, Onboarding, Pursuing, Outreach, Companies and Settings, on desktop and on phone.
- **Mobile navigation:**
  - the bottom bar is Today, People, Pursuing, Outreach;
  - Companies opens from an opportunity, and Settings from the avatar.

Visual-system exploration is complete. Direction C stays approved, and the rejection of A and B stands (D-021). The C prototype is the authoritative reference for implementation. This completes D-023: its surfaces in review are now approved.

**Freeze:** approved surfaces change only for a bug, an accessibility issue, a responsive defect, an implementation constraint, or an explicit human design decision. Implementation must not:

- reinterpret the palette or swap the fonts;
- replace the navigation or the mobile patterns;
- modernise layouts or convert surfaces to generic components;
- add cards or pills for convenience.

**Why:** the remaining work is building the approved product, not redesigning it.

**Consequence:**

- Production work reproduces the prototype (DESIGN.md › Design freeze).
- The favicon and app icon wait until the Reachout mark is approved for production.

## D-025 · Records live in a workspace, and the database enforces who can use it

_2026-10-06 · Accepted_

Storage is shaped for isolation, not for sharing:

- `profiles` holds the product's User; `workspaces` and `workspace_members` say who may use a workspace.
- Every account gets exactly one personal workspace, created on first sign-in, with one member: its owner.
- Every record (companies, people, opportunities, interactions, drafts, next actions, facts, interpretations) carries `workspace_id`.
- References between records are composite foreign keys on `(workspace_id, id)`, so nothing can point across workspaces.
- Row-level security on every table allows access only to members of the record's workspace.
- The domain's `userId` on a record is the workspace owner: in V1, the signed-in user.
- Durable ids are random UUIDs, generated by the application before writing, so related records can be created together. Seed and fixture ids stay as they are.

**Why:** the human asked for workspace-based isolation that can carry collaborators later, without attaching records to client-supplied user ids. The product itself stays single-user: there is no sharing, team or workspace switching, so PRODUCT.md's non-goals stand.

**Consequence:**

- Adding collaborators later needs a product decision and domain changes, not a data migration of every table.
- ARCHITECTURE.md's earlier plan of `user_id` columns and `user_id = auth.uid()` policies is replaced.

## D-026 · Sign-in is by email link, through Supabase Auth

_2026-10-06 · Accepted_

No sign-in method had been decided, so V1 uses the smallest secure one: a one-time link emailed by Supabase Auth.

- The same link signs up a new address, so the answer never reveals whether an account exists.
- There are no passwords, no social or LinkedIn sign-in, and no multi-factor UI.
- Links carry a token hash (our email template), so a link opened on another device still works. Supabase's default code link (same browser only) is also accepted.
- Sessions are httpOnly cookies set by `@supabase/ssr`. There is no browser Supabase client, so page scripts never see a token.
- The proxy refreshes sessions and makes optimistic redirects. Every read and write still verifies the JWT on the server (`getClaims`) in the data access layer.
- `REACHOUT_DEV_SEED=true` keeps the seed session for development only. Production refuses it, and an unconfigured deployment fails closed.

**Why:** it needs no password storage or reset flows, and the product already speaks email.

**Consequence:** new accounts start with the part of their address before the @ as their name, until Settings changes it. Onboarding doesn't ask for a name, and asking would change the frozen flow.

## D-027 · Writes go only through database workflow functions, run by a role that cannot bypass security

_2026-10-06 · Accepted_

The Postgres access layer is `@supabase/supabase-js` on the server, with no ORM.

- **Reads:** the Data API as the signed-in user; row-level security decides what is visible.
- **Writes:** one SQL function per workflow step (`complete_next_action`, `approve_draft`, `mark_draft_sent`, `complete_onboarding`, …).
- **No direct writes:** the Data API's roles can read tables but cannot write them.
- **The writer role:** the functions are owned by `reachout_writer`, which cannot sign in and cannot bypass row-level security, so the policies apply inside them too.
- **Rules:** they stay in `src/domain` and run first, on the server. Each function then re-checks, in one transaction, what must never be bypassed:
  - the record is visible to the caller;
  - nobody changed it since the caller read it (optimistic versioning on `updated_at`);
  - the transition is allowed: only an approved draft becomes sent, an edit always resets approval, only open actions change, onboarding completes once.
- **Constraints:** check constraints mirror the Zod schemas.
- **No service key:** the application never holds one.

**Why:** a signed-in user's token also works from the browser. Restricting writes to a few explicit, re-checked operations is what makes "draft → approval → send yourself → mark sent" hold at the database, not just in the UI.

**Consequence:** a new kind of write needs a migration adding a function, its grants, and tests in the database suite.

## D-028 · Undo is durable and exact — _Mark as sent excepted by D-030_

_2026-10-06 · Accepted_

The approved UI offers Undo after every action. With persistence, Undo puts back exactly what that action changed, provided nothing has changed those records since.

- Each write function records what it changed in `private.undo_steps`, readable only through `undo_step`. Steps are pruned after a day.
- Undo is a correction, not a lifecycle transition. Undoing "Mark as sent" returns the draft to approved, removes the message it recorded, and restores the person's status.
- A failed save says so and offers no Undo.

**Why:** keeping the approved interaction honest once changes are real.

**Consequence:** DOMAIN.md › Undo documents this as the one exception to "sent drafts are immutable" and "only open actions change".

## D-029 · `cacheComponents` stays off; signed-in pages render per request

_2026-10-06 · Accepted_

Every signed-in route reads the session and the user's records per request (`connection()`, `getRepository()`). Nothing is cached across users or requests. **Why:** per-user data and fail-closed auth are simpler to reason about without Partial Prerendering. **Consequence:** revisit with a performance budget in phase 8. This supersedes D-018.

## D-030 · Marking a message sent is final

_2026-10-06 · Accepted_

"Mark as sent" records something that happened outside Reachout, so it is no longer part of Undo.

- Marking as sent records no undo step. Undo can never remove a recorded message, or return a sent draft to approved, whatever step asks. The database refuses both (`undo_step`).
- Because it is final, it takes a deliberate second press. "Mark as sent" first says it can't be undone; "Yes, I sent it" records it. The prompt resets after eight seconds.
- A successful final action ends the session's undo history, so Undo always means "the last action".
- Complete, snooze, approve, edit and writing a draft keep their exact Undo (D-028).
- Manual marking and Gmail detection share this rule (D-031).
- If a correction is ever needed, it will be its own explicit workflow, not Undo.

**Why:** the human decided that a sent message is a real-world event, not an edit.

**Consequence:** this supersedes the part of D-028 that let Undo revert "Mark as sent".

## D-031 · Gmail is a read-only correspondence connector

_2026-10-06 · Accepted_

Gmail exists to keep relationship history accurate without manual tracking. It never sends, changes or deletes mail; manual "Mark as sent" stays as the fallback.

- **Separate from sign-in.** Supabase Auth remains Reachout's sign-in (D-026). Google OAuth only authorises Gmail access, connected from Settings.
- **Flow:**
  - Google's web-server flow, started by a Server Action;
  - PKCE (S256) and a random `state`, sealed in a ten-minute httpOnly cookie scoped to `/settings/gmail/callback`;
  - the callback requires the same state, the same signed-in user, the Gmail scope granted, and the exact registered redirect URI, and returns only to `/settings`.
- **One scope: `gmail.metadata`.**
  - Headers and labels only: no bodies, no attachments, no changes. It is the narrowest scope that can see what was sent and received.
  - `gmail.readonly` was rejected because it exposes message bodies Reachout doesn't need.
  - Like any Gmail scope, it is "restricted" and needs Google's verification before public launch.
- **Tokens:**
  - The refresh token is sealed with AES-256-GCM (Node crypto), using the server key `GMAIL_TOKEN_ENCRYPTION_KEY` and the owner as associated data, and stored in `private.gmail_credentials`, which the Data API can't reach.
  - Access tokens live only for one sync.
  - Tokens are never logged, sent to a browser, or put in an error.
  - Rotation: deploy a new key and keep the old one as `GMAIL_TOKEN_ENCRYPTION_KEY_PREVIOUS` until connections are re-sealed, or ask users to reconnect.
- **Sync:**
  - incremental, from the Gmail history cursor taken when the account was connected; earlier mail is not imported;
  - runs on entering the app (at most every ten minutes, after the page has loaded) and on "Check now" (rate-limited);
  - a database lease means one sync at a time per account;
  - each run has a 20-second budget and per-request timeouts of 8 seconds, and saves its cursor after each change;
  - no push notifications or Pub/Sub in V1.
- **Matching (`src/domain/correspondence.ts`):**
  - only an exact email address on a person the user added;
  - sent mail matches every tracked recipient; received mail matches only a tracked sender;
  - never a display name, company, subject or guess;
  - an address two people share matches nobody, and people without an address are never matched.
- **What is stored:** only matched messages, as ordinary interactions (subject and time, channel email), plus a mapping in `gmail_messages` from the provider id to that interaction. Recording is exactly once per provider message and person.
- **Reconciliation:**
  1. A sent message that matches a hand-marked message to the same person (same subject, within three days, not yet linked) is linked to it, not added again.
  2. Otherwise, exactly one approved email draft for that person with the same subject, approved before it went out, is marked sent by it.
  3. Anything uncertain records the message and changes no draft.
- **Failure:**
  - A revoked or narrowed grant marks the connection "needs reconnecting" and stops syncing.
  - Outages change nothing and retry later.
  - The rest of Reachout never waits for Gmail.
- **Disconnect** deletes the connection and credentials, keeps recorded history, and asks Google to revoke the grant (best effort; Settings says if that failed).

**Why:** it captures correspondence with the least access and no ability to act on the mailbox.

**Consequence:**

- Sending through Gmail is not built and would need its own decision.
- A user who calls the database functions directly can only add Gmail-sourced history to their own workspace, which is no more than they could record by hand.

## D-032 · Application rate limits live in Postgres

_2026-10-06 · Accepted_

Supabase sees Reachout's server rather than each student, so its per-IP auth limits would be shared by everyone. Reachout keeps its own small limits in `private.rate_limit_hits`, through `take_rate_limit`, using fixed windows:

| What                       | Limit             |
| -------------------------- | ----------------- |
| Sign-in links per address  | 5 per 15 minutes  |
| Sign-in links per client   | 30 per 15 minutes |
| Gmail connections per user | 10 per hour       |
| "Check now" per user       | 6 per 5 minutes   |

- Keys are HMAC-SHA256 values computed with `REACHOUT_RATE_LIMIT_SECRET`, which production requires. The database never holds an address, and nobody can spend another person's allowance.
- Limits are set in the database function, not by the caller.
- Sign-in fails open if the limiter itself is unreachable, because Supabase's own limits still apply. Gmail actions fail closed.
- Account-enumeration resistance stands: known, new and refused addresses get the same answer, including when sign-ups are closed.
- CAPTCHA stays a hosted configuration choice (docs/launch-checklist.md).

**Why:** durable and small, with no new infrastructure.

## D-033 · A strict Content Security Policy with per-request nonces

_2026-10-06 · Accepted_

**What the Proxy sets on every page:**

- A CSP with a fresh nonce for scripts and `strict-dynamic`. There is no `unsafe-eval` in production; development adds it for React's tooling.
- `default-src`, `connect-src` and `form-action` are `'self'`; `frame-ancestors` and `object-src` are `'none'`; `base-uri` is `'self'`.
- `upgrade-insecure-requests` is sent over https only.
- Styles allow `'unsafe-inline'`, because two components set CSS variables through `style` attributes. Scripts never allow it.

**What `next.config.ts` adds everywhere:**

- `X-Frame-Options: DENY`;
- `X-Content-Type-Options: nosniff`;
- `Referrer-Policy: strict-origin-when-cross-origin`;
- a closed `Permissions-Policy`;
- `Cross-Origin-Opener-Policy: same-origin`;
- HSTS.

`X-Powered-By` is off.

**Why:** XSS and clickjacking defences that the app's design already allows, because every page renders per request (D-029) and nothing loads third-party scripts.

**Consequence:** adding any external script, style, font or connection needs a CSP change and a reason.

## D-034 · Reachout launches with Gmail switched off

_2026-10-06 · Accepted_

V1 launches on the core loop with manual "Mark as sent". Gmail stays built but is switched off in public production until Google has verified the restricted `gmail.metadata` scope (and the security assessment that comes with it).

- **Server-only switch:** `REACHOUT_GMAIL_ENABLED` must be exactly `true`, and all four Gmail settings present (D-031). Anything else, including absent, is off.
- **When off:**
  - Settings says Gmail is coming later, with no Connect;
  - starting a connection does nothing;
  - the callback redirects to Settings without acting;
  - no sync runs, and nothing reaches Google;
  - an existing connection is left in place but not used.
- **Test environments:** a Google test-user environment (OAuth app in testing mode, named test users) may switch it on to verify the flow. That is not public approval, and is never described as such.
- The Gmail code, schema and tests stay. Enabling it publicly is a configuration change after Google approves.

**Why:** the launch shouldn't wait on an external review, and public users shouldn't be offered a flow Google hasn't approved.

## D-035 · A demo workspace, without an account

_2026-10-07 · Accepted_

Anyone can try Reachout without signing in. "Try the demo" on the landing page opens a fictional student's workspace: the seed dataset plus one recent conversation (`createDemoDataset`). It is held in the server's memory, one copy per demo.

- **Session:**
  - a random demo id and its HMAC signature, in an httpOnly, `SameSite=Lax` cookie;
  - the key is made when the server starts, so a cookie is good only for the server that issued it, until it restarts;
  - a forged, altered or foreign cookie is no session;
  - a query parameter or browser storage never decides it.
- **Boundary:**
  - the demo's user is always the fictional student;
  - the demo id only chooses a copy of fictional records, and never names a user or workspace;
  - `getRepository()` returns that copy and never constructs a Supabase client;
  - Gmail is unavailable, and there is no onboarding.
- **Changes:** they work for the visit and are never written anywhere durable. Reset demo starts again; Exit demo forgets the copy and clears the cookie. A copy idle for two hours, or past 200 at once, starts afresh.
- **Precedence:** the demo comes first while it is chosen. A real sign-in ends it.
- **Separate from `REACHOUT_DEV_SEED`:** that remains development-only and is refused in production. The demo needs no configuration and is safe in production because it reaches no real data.

**Why:** the project should be explorable from GitHub in one click, without email, Supabase or setup, and without weakening real accounts.

**Consequence:** on a host with several server instances, a demo's changes last only while requests reach the same instance; elsewhere it starts afresh. That is acceptable for a demo.
