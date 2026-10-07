# Devlog

Newest first. One entry per working session: what changed, why, and what is next. Durable decisions go in DECISIONS.md, not here.

## 2026-10-07 · V1 complete: landing page and demo workspace

On `feat/final-demo`, from `main`. The final pass: a public landing page, and a demo anyone can open without an account. No product features, and no changes to approved surfaces beyond Settings' demo rows.

- **Landing page (`/`):**
  - public, and reads no session;
  - a hero with "Try the demo" and "Sign in", "How it works" (seven steps, with approving and sending in the user's hands), three short points, and a closing call;
  - built from the approved system only.
  - Signing in now returns to `/today` by default, since `/` is no longer the app's entry.
- **Demo workspace (D-035):**
  - **Entry:** "Try the demo" sets a server-signed httpOnly cookie and lands on Today.
  - **Records:** each demo gets its own in-memory copy of `createDemoDataset`: the seed, plus one recent conversation so Outreach's "In conversation" has someone. The seed is unchanged.
  - **Boundary:** the demo never reaches Supabase, has no onboarding, and can't use Gmail.
  - **Settings:** says "Demo workspace", with Reset demo and Exit demo.
  - **Real sessions:** a real sign-in still uses Supabase, and signing in ends the demo.
- **Docs:**
  - README rewritten for GitHub visitors, with the demo first;
  - ARCHITECTURE, DESIGN, ROADMAP (V1 COMPLETE) and CLAUDE updated.

**Verified:**

- **Static checks:** `pnpm format:check`, `lint`, `typecheck` and `test` (367 tests).
- **Database:** `pnpm test:db` (41) and `pnpm db:test` (15).
- **Also:** `pnpm build`, `pnpm audit --prod` and `git diff --check`.
- **Production builds, headless DOM checks (no screenshots):**
  - one with no Supabase configured: 53/53. Landing at 4 widths, every demo surface at 1440, 1024, 390 and 320, changes, reset, exit, a forged cookie, Gmail unavailable;
  - one with the local Supabase: 62/62. The same, plus real sign-in, the landing staying public when signed in, demo and real records never mixing, and sign-out.
  - No overflow, and no console errors outside the deliberately fail-closed pages.

**Not done:** deployment (not wanted for V1), and the human's visual review of the landing page and the demo's Settings rows.

## 2026-10-07 · Release preparation: Gmail launch gate; hosted setup blocked on the human

On `feat/gmail-launch`. The final release pass prepared everything that engineering alone can do. The hosted steps stopped where they need the human.

- **Gmail launch gate (D-034):**
  - Gmail is off unless `REACHOUT_GMAIL_ENABLED=true` and all four settings are present;
  - when off, Settings says "Coming later" with no Connect, connecting refuses, the callback does nothing, and no sync runs;
  - the implementation stays, and is tested both on and off.
- **Review preparation:**
  - the human review states and how to reach them are in docs/launch-checklist.md;
  - local fixture accounts exist for the Outreach two-step and the Gmail connected and reconnect states.
- **Hosted setup, stopped for the human:**
  - Supabase: the organisation is on the free plan with its two active projects in use, so a preview and a production project need the Pro plan or another project paused;
  - Vercel: the repository isn't connected and there is no token;
  - there are no SMTP credentials and no production domain.
- **Not done, because hosted setup isn't:** no preview or production deployment, no real email, no hosted isolation test, and no merge to `main`.
- **Ancestry:** `main` (`ae383f6`) is an ancestor of `feat/gmail-launch`, and the history is one straight line through every feature branch. Once launch checks pass, `main` fast-forwards with nothing lost.

**Verified:**

- `pnpm check`, `pnpm test:db`, `pnpm db:test`, `git diff --check` and `pnpm audit --prod`;
- DOM walks on a production build with Gmail on (56 journey, 5 Gmail states and rate limit, 32 width checks);
- on the dev server with Gmail off (the 2 gate checks and 32 width checks);
- no console errors.

## 2026-10-06 · Gmail correspondence tracking, final mark-sent, launch hardening

On `feat/gmail-launch`. Gmail now keeps relationship history accurate without manual tracking, and the app is hardened for launch. No AI was added, nothing was deployed, and approved surfaces weren't redesigned. The few new states await visual review (DESIGN.md).

- **Marking a message sent is final (D-030):**
  - no undo step, in the database, both repositories or the UI;
  - Undo can never remove a recorded message or bring a sent draft back;
  - "Mark as sent" takes a deliberate second press ("Yes, I sent it");
  - complete, snooze, approve, edit and writing a draft keep Undo.
- **Gmail, read-only (D-031):**
  - connected from Settings with Google's web-server OAuth: PKCE, a sealed state cookie bound to the user, an exact callback, and one scope, `gmail.metadata` (headers only);
  - refresh tokens sealed with AES-256-GCM in `private.gmail_credentials`;
  - incremental history sync on entering the app (at most every ten minutes, after load) and on "Check now", with a database lease, a time budget and request timeouts;
  - exact-address matching, each message recorded once per person as an ordinary interaction, and reconciliation with approved drafts and hand-marked messages;
  - revocation leads to "Reconnect needed"; disconnect removes the credentials and revokes the grant, and history stays;
  - Gmail never sends, changes or deletes mail.
- **Screens follow fresh server reads:** after a change or a Gmail check, the page takes in the refreshed records, so a reply Gmail found appears without a reload.
- **Hardening:**
  - Postgres rate limits with HMAC'd keys (D-032) for sign-in links (per address and per client), Gmail connections and "Check now";
  - sign-in normalises addresses and answers identically whether or not an account exists, including when sign-ups are closed;
  - a nonce-based CSP with no `unsafe-eval` in production, plus frame, MIME, referrer, permissions, opener and HSTS headers (D-033);
  - `X-Powered-By` is off;
  - a new `integrations` layer with lint boundaries.
- **Migrations, applying in order on a fresh database:** `mark_sent_is_final`, `gmail_correspondence`, `rate_limits`.
- **Docs:** decisions D-030 to D-033; DOMAIN's Undo and mailbox rules; ARCHITECTURE's Gmail and Security sections; and the launch checklist rewritten with the exact Supabase, Auth, Google Cloud and environment steps.

**Verified:**

- `pnpm check` and `pnpm audit --prod` (no known vulnerabilities; one dev-only advisory in `eslint-config-next` → `braces`, with no patched version).
- `pnpm test:db`: 41 tests on the local Supabase:
  - the Repository and Gmail sync contracts, with Google faked;
  - two-account isolation, including Gmail connections, credentials, lease and recording;
  - rate limits.
- `pnpm db:test`: 15 pgTAP checks.
- Headless Chrome, DOM only, on a production build with Gmail configured:
  - 56 checks of the full journey, including the two-step mark-sent, Connect reaching Google's consent screen (intercepted, never contacted), and a forged callback refused;
  - 5 checks of the sign-in rate limit and the reconnect and disconnect states;
  - 32 width checks (1440, 1024, 390 and 320px) across sign-in, onboarding and every app page, and the same 32 on the dev server;
  - the database-outage check (7) again, with no slower failure than before;
  - no console errors or CSP violations.

**Not verified:** a real Google OAuth client and real Gmail, Google's verification of the restricted scope, any hosted Supabase project or deployment, real email delivery, and real phones.

## 2026-10-06 · Accounts and durable persistence

On `feat/auth-persistence`. Reachout now has real accounts and keeps what you do. Nothing was redesigned. Gmail, AI and deployment were not started.

- **Sign-in (D-026):**
  - by email link through Supabase Auth, with httpOnly session cookies and no browser Supabase client;
  - `/sign-in` and `/auth/confirm` are new; sign-out lives in Settings;
  - the proxy refreshes sessions and sends signed-out visits to sign in, remembering where they were going (only paths inside Reachout);
  - every read and write still checks the session on the server;
  - `REACHOUT_DEV_SEED=true` keeps the seed student for development; production refuses it, and unconfigured it fails closed.
- **Storage (D-025, D-027):**
  - Supabase Postgres in three migrations: accounts and workspaces, the domain's records, and the workflow functions;
  - every record lives in the account's personal workspace, with composite foreign keys, check constraints mirroring the Zod schemas, and RLS on every table;
  - the Data API can read (RLS decides what) but never write;
  - every write is one database function, run by a role that can't bypass RLS, which re-checks ownership, the caller's version and the transition;
  - durable ids are UUIDs.
- **What persists:**
  - onboarding, saved once and atomically;
  - Settings' profile, goals and time zone;
  - every action on Today, People, Pursuing and Outreach: complete, snooze, write, edit, approve and mark sent.
- **The approval gate** holds in the database: an unapproved draft can't become sent, an edit always resets approval, and marking sent twice records one message.
- **Undo (D-028):** puts back exactly what an action changed, if nothing has changed since.
- **First sign-in:** creates exactly one profile and workspace, however many requests race.
- **Honest screens:**
  - an action changes the screen only once it is saved;
  - a failure says so, without Undo;
  - Settings says "Saved.";
  - a page that can't load shows a calm error page with "Try again";
  - Supabase calls time out after 10 seconds.
- **Small UI changes, for truth only:**
  - Settings shows the email read-only (it is the sign-in address), adds an Account row with Sign out, and "Delete your account" now says "Not available yet";
  - onboarding's arrival says "You're set up";
  - the sign-in and error pages reuse onboarding's frame.
  - These all await visual review.
- **Not built:** account deletion, changing the sign-in email, rate limiting beyond Supabase's own, and Playwright.

**Verified:**

- `pnpm check`: format, lint, typecheck, 274 unit and component tests, and the build.
- `pnpm test:db`: 20 tests against the local Supabase, with accounts signed in by real email links:
  - the Repository contract (12, the same suite the in-memory repository passes);
  - two-account isolation through the Data API (reads, reads by id, every write function, direct writes to all 13 tables, signed out);
  - racing first sign-ins and onboarding submissions.
- `pnpm db:test`: 12 pgTAP checks inside Postgres.
- Headless Chrome, DOM only, on a production build and on the dev server against the local stack: 49 checks each. They covered:
  - sign-in through Mailpit, onboarding, and reload;
  - Settings saved;
  - draft → approve → edit resets → approve → mark sent, with history after reload;
  - Undo, complete and snooze;
  - deep links, including another account's id and a malformed one;
  - phone widths and the four-tab bar;
  - sign-out, and signing back in to a deep link.
- 7 more checks stopped the Data API mid-session: a save failed calmly and nothing moved; the page showed the error page, and "Try again" recovered.

**Not verified:** anything on a hosted Supabase project or a deployment (see docs/launch-checklist.md), real email delivery, and real phones.

## 2026-10-06 · Onboarding in production; every UI surface built

On `feat/production-onboarding`. `/onboarding` now runs the approved flow in place of the placeholder. It reproduces the C prototype; nothing was redesigned. Every production UI surface is now built.

- **The flow:**
  - seven questions, one per step: goal, roles, industries, places, one opportunity, one person, and a first step;
  - "Your workspace" fills in beside it on desktop;
  - on a phone, Back sits in the top bar and Continue within thumb reach;
  - problems show only after Continue, on the field, as help;
  - only the first, single-choice step moves on by itself.
- **The outcome:**
  - finishing builds real records through the domain schemas: goals, a company matched by name, an opportunity, a person and an open next action;
  - it then opens the approved Today on them, inside the app shell, saying "You're set up for this session. This is your Today."
- **Auth and data, honestly:**
  - the route reads the signed-in user through `getRepository()`, so production still fails closed;
  - development runs as the seed user;
  - the records last for the session only: leaving Today or reloading shows the Repository's records again, until the first write path.
- **Shared, not copied:**
  - Today gained an optional `welcome` and the shell an optional `current` section, for arriving at Today from `/onboarding`; both default to the old behaviour;
  - the objective labels come from `features/workspace/goals.ts`;
  - the unused route placeholder was removed.
- **Status:**
  - approved: Today, People, Pursuing, Outreach, Companies and Settings;
  - implemented: Onboarding;
  - next: authentication and durable persistence. Gmail and AI come later.

**Verified:** `pnpm check` (241 tests), plus headless Chrome (DOM only) walking the whole flow at 1440, 390 and 320px: no errors or hydration warnings, no overflow, nothing under the tab bar.

## 2026-10-06 · Settings in production

On `feat/production-settings`. `/settings` now shows the approved Settings page in place of the placeholder. It reproduces the C prototype without visual change, so it is recorded as approved.

- **Profile and what you're aiming for:** read from the signed-in user's record and validated on the field with the domain's schemas. Saving says "Saved for this session.": nothing is persisted until accounts arrive, and a reload shows the stored profile.
- **Said plainly:**
  - notifications are "Not available yet"; Gmail is "Later" and will only ever send what you approved;
  - LinkedIn is never connected; deleting your account "Arrives with accounts";
  - none of these are shown as controls.
- **Navigation:** at the foot of the desktop rail; on a phone it opens from your avatar, with Back to Today, and is never a tab.
- **Implementation:** both layouts render, as elsewhere, so form ids carry a per-layout prefix and the saved profile is shared. The objective labels moved to `features/workspace/goals.ts` for Onboarding to reuse.

**Verified:** `pnpm check`, plus headless Chrome (DOM only) at 1440, 1024, 390 and 320px: no errors or hydration warnings, no overflow, nothing under the tab bar.

## 2026-10-06 · Companies in production

Approved at desktop, ~1024px and phone widths, including the shell keeping Pursuing marked for a company opened from an opportunity. Settings is next.

On `feat/production-companies`. `/companies` now shows the approved Companies experience in place of the placeholder. It reproduces the C prototype; nothing was redesigned.

- **Derived, never maintained (D-012):** each company gathers its opportunities, its people, their history and pending drafts from the records. Nothing is entered, edited, stored or scored.
- **Desktop:**
  - the companies beside the selected one: closing soon first, then what Today asks soonest, then the most recent contact;
  - each company shows its standing in words and "Why X matters", worded from the records;
  - then what you're pursuing there, who you know there, what has happened, and your notes and sourced facts.
- **Phone:** the list, then one company: why it matters, what you're pursuing there, who you know (opening the person sheet), the latest history with Show earlier, and what you know. Companies has no tab.
- **Links:**
  - the company is in the URL by id (`/companies?company=<id>`);
  - opportunities link to `/opportunities?opportunity=<id>`, people to `/people?person=<id>`;
  - the approved design shows outreach in words only, so there are no Outreach links.
- **Return context:** opened from an opportunity on a phone (`&from=<opportunity-id>`), Back returns to that exact opportunity and the tab bar keeps Pursuing marked (DESIGN.md › Navigation). An unknown `from`, or one for another company's opportunity, is ignored.
- **Shell:** the phone tab bar reads `from` to keep Pursuing marked. No tab was added.
- **Shared, not copied:** `useUrlSelection`, Pursuing's person lines, activity, wording and folds, People's facts and styles, Today's tiles, history and person sheet.
- **Not built:** Settings and Onboarding in production; auth, persistence, Supabase, Gmail and AI.

**Verified:**

- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (212 tests) and `pnpm build`.
- Headless Chrome, DOM measurements only:
  - Companies at 1440, 1024 and 900px wide, and at 390, 320 and 700px on a phone;
  - every route on desktop and phone.
- No errors or hydration warnings, no overflow, and nothing under the tab bar. Today, People, Pursuing and Outreach are unchanged.

## 2026-10-05 · Outreach in production

Approved at desktop, ~1024px and phone widths. Companies is next.

On `feat/production-outreach`. `/outreach` now shows the approved Outreach experience in place of the placeholder. It reproduces the C prototype; nothing was redesigned. The brief described a desktop list with a selected detail; the human chose the approved act-in-place composition instead.

- **Desktop:**
  - one track per person (D-014), grouped by action state: To write, Waiting for your approval, Approved and ready to send, In conversation, Sent and waiting; Not contacted yet and Closed are folded;
  - each track shows who it is, what it responds to (their reply, what you sent, why they matter), the draft, and Today's verbs in place;
  - "How a message moves" sits beside it, with how many are at each step.
- **Phone:**
  - the list by action state, then one person at a time under Back;
  - the page shows what to do (the item's card, with the draft in full), what it's for, the history between you, and a link to everything about them.
- **Approval:** the domain's draft rules decide every step.
  - A draft waiting for approval offers Approve and Edit, never Mark as sent.
  - Approving makes it ready to send; editing it sends it back for approval.
  - Mark as sent records what you sent yourself, and the message joins the history. Nothing is sent from Reachout, and actions last for the session only.
- **Links:**
  - the open track is in the URL by person id (`/outreach?person=<id>`): it opens the phone page, and on desktop scrolls to and marks the track;
  - people link to `/people?person=<id>`, opportunities to `/opportunities?opportunity=<id>`.
- **Data:** read through `getRepository()`. Tracks derive from the domain's outreach state and Today's items; nothing is stored or scored.
- **Shared, not copied:** `useUrlSelection`; Today's actions, history and stage frame; People's phone header and cards; Pursuing's phone action card (now with the prototype's full variant) and folds.
- **Accessibility fix:** acting on a desktop track can move it to another group; focus now follows the person instead of falling to the top of the page.
- **Not built:** Companies, Settings and Onboarding in production; Gmail, AI, auth and persistence.

**Verified:**

- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (194 tests) and `pnpm build`.
- Headless Chrome, DOM measurements only:
  - Outreach at 1440, 1024 and 900px wide, and at 390, 320 and 700px on a phone;
  - every route on desktop and phone.
- No errors or hydration warnings, no overflow, and nothing under the tab bar. Today, People and Pursuing are unchanged.

## 2026-10-05 · Pursuing in production

Approved at desktop, ~1024px and phone widths. Outreach is next.

On `feat/production-pursuing`. `/opportunities` now shows the approved Pursuing experience in place of the placeholder; the route keeps its name and the product calls it Pursuing. It reproduces the C prototype; nothing was redesigned.

- **Desktop:**
  - the opportunities grouped by timing: closing soon, in progress, and closed (folded);
  - each row shows its company, stage, people and what needs you, with a date tile only for a live deadline;
  - beside it, the selected opportunity: header with company, deadline, priority and people; where you are; what happens next; who you know there; what has happened; and what you know.
- **Where you are:** a sentence ("You're reaching out · 3 of 6") and a quiet path over the domain's stages: small done dots and one brand marker. No bars or funnels.
- **Phone:**
  - the list by timing;
  - one opportunity at a time under Back: what happens next as a card, a compact stage path, people (opening the person sheet), history with Show earlier, notes, and the company.
- **Links:**
  - the opportunity is in the URL by id (`/opportunities?opportunity=<id>`);
  - people link to `/people?person=<id>`;
  - People's "For" rows now open the exact opportunity;
  - the company links to the Companies placeholder, carrying the opportunity a phone came from.
- **Data:** read through `getRepository()` with research context. Grouping, activity and wording are pure functions over the records and the domain's stages; status comes from Today's items.
- **Actions:** Today's verbs, applied by the domain rules to the session only. Nothing is persisted; a reload resets to the Repository's records.
- **Shared, not copied:**
  - People's URL selection became `useUrlSelection`, used by both surfaces;
  - deadline helpers moved beside the date tile, and phone button labels to the shared actions;
  - Pursuing reuses People's next-step blocks, facts and styles, and Today's history pieces and person sheet.
- **Copy:** "Nothing planned yet." (as on People) replaces the prototype's "Add a next step…", which promised a control that doesn't exist.
- **Fixes:**
  - a screen-reader-only deadline phrase pushed phone rows 43px wide at 320px; it now sits outside the truncated line;
  - between 900 and 1180px the list slims to People's 296px, as Today's day panel slims, so the opportunity keeps room.
- **No shortcuts:** the prototype's arrow-key list movement was not carried over.
- **Not built:** Outreach, Companies, Settings and Onboarding in production; adding or editing opportunities.

**Verified:**

- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (175 tests) and `pnpm build`.
- Headless Chrome, DOM measurements only:
  - Pursuing at 1440, 1280, 1024 and 900px wide, and at 390, 320 and 700px on a phone;
  - every route on desktop and phone.
- No errors or hydration warnings, no overflow, and nothing under the tab bar. Today and People are unchanged.

## 2026-10-05 · People: functional cleanup

This pass changed behaviour only, with no visual change. People is now approved at desktop, ~1024px and phone widths.

- **The person is in the URL:** `/people?person=<id>`, an id never a name.
  - Desktop selection replaces the history entry. Opening a person on a phone pushes one, so Back returns to the list.
  - A refresh keeps the person. The People tab returns to the list. Unknown or malformed ids fall back to the default person.
- **Today → People:** Today's person link opens that exact person.
- **Read all:** shows only when the why is actually cut off. It is measured before paint and again when the width changes; the old 110-character rule is gone.
- **Copy:** "Nothing planned yet." replaces wording that promised a way to add a next step.
- **Still no arrow-key or single-key navigation.**

**Verified:** `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build`, plus headless Chrome (DOM only) at desktop, ~1024px and phone widths.

## 2026-10-05 · People in production

On `feat/production-people`. `/people` now shows the approved People experience in place of the placeholder. It reproduces the C prototype; nothing was redesigned.

- **Desktop:**
  - a list grouped by opportunity, with search, status in words and the brand selected row;
  - beside it, the person: header and standing, "Why X matters", Next, Between you, and what you know.
  - What you know keeps sourced facts, your notes and generated interpretation visibly apart.
- **Phone:**
  - the list: count and who needs you, search, opportunity groups, and one-line name and status;
  - one person at a time under Back: the compact header, why first with Read all, a compact Next card, what it's for, dense history with Show earlier, open notes, and facts and the suggested angle behind disclosures.
- **Data:** read through `getRepository()` with research context. Grouping and search are pure functions in `features/people/groups.ts`; status comes from Today's items and the outreach state.
- **Actions:** Today's own verbs (write, approve, edit, mark sent, mark done, snooze), applied by the domain rules to the session only. Nothing is persisted.
- **Shared with Today:** People reuses Today's history, standing, contact actions, date tile, action machinery and shared styles. History gained an opt-in phone mode (newest few, Show earlier, denser spacing); Today's person sheet is unchanged.
- **Keyboard:** no shortcuts. The prototype's arrow-key list movement was not carried over: Tab, Enter and Space operate every control. Back returns focus to the row you opened.
- **Responsive adaptation (approved):** between 900 and 1280px, "What you know" moves under the story instead of squeezing the history column. Up to 1180px the person's padding tightens, as on Today.
- **Not built:** adding and editing people, and Pursuing, Outreach, Companies, Settings and Onboarding in production.

**Verified:**

- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (139 tests) and `pnpm build`.
- Headless Chrome, DOM measurements only:
  - People at 1440, 1280, 1180, 1024 and 900px wide, and at 390, 320 and 700px on a phone;
  - every route on desktop and phone.
- No errors or hydration warnings, no overflow, and nothing under the tab bar. Today is unchanged.

## 2026-10-04 · Today: keyboard shortcuts removed

The human removed Today's single-key shortcuts (J/K/E/S/A) and their legend, which were too easy to trigger by accident.

- Every Today action is now an explicit click or tap.
- Buttons stay keyboard-operable (Tab with Enter or Space), and Escape still closes the person sheet.
- The rule is durable: DESIGN.md › Accessibility and CLAUDE.md forbid global single-key action shortcuts.
- The prototype keeps its old shortcuts as an obsolete reference that must not be copied.

## 2026-10-04 · Production begins: app shell and Today

On `feat/production-today`, from the design checkpoint `85149f5`.

- **Shell:** the approved labelled rail on desktop, and the four-tab bar on phones (Today, People, Pursuing, Outreach), with Settings from the avatar. Links go to the real routes.
- **Today, at `/today`:** the approved desktop composition (focus and Your day) and phone composition (focus first, up next, the rest, the person sheet).
- **Data:** read through `getRepository()` and derived by `deriveToday`.
- **Actions:** complete, snooze, approve, edit, write a draft and mark as sent run the domain rules on a session copy. Nothing is persisted until the first write path.
- **Code:**
  - tokens are on `:root` and the fonts load in `app/fonts.ts`;
  - the prototype now re-exports the production modules (dates, icons, records, session store, Today wording) instead of duplicating them;
  - a lint rule and a test keep production from importing the prototypes.
- **Not built yet:** People, Onboarding, Pursuing, Outreach, Companies and Settings (still placeholders), and any persistence, auth, Gmail or AI.

**Verified:**

- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (119 tests) and `pnpm build`.
- Every route in headless Chrome at 1440×900 and 390×844, with DOM measurements only: no errors or hydration warnings, no overflow, nothing under the tab bar.

## 2026-10-04 · Design checkpoint: everything approved and frozen

The human approved every surface on desktop and phone (Today, People, Onboarding, Pursuing, Outreach, Companies, Settings), and the mobile navigation (D-024). Visual-system exploration is complete.

- **Reference:** the C prototype is the authoritative design reference.
- **Freeze:** DESIGN.md › Design freeze sets what may change during implementation and what must not.
- **Deferred:** the favicon waits for an approved production mark.
- **Local noise:** `… 2` copies appear inside the gitignored `.next` folder while builds run under the cloud-synced `~/Documents`. They stay ignored and are never committed.

No code changed in this pass. **Next:** product implementation, phase 2, when the human starts it.

## 2026-10-04 · Two phone row fixes (in review)

People and Outreach rows took their third column (the status, the chevron) from a second stylesheet's override. When that override didn't apply, the item dropped under the avatar.

- **Both rows:** they now keep the base row's own two columns. What belongs to the person lives inside the text column, so the layout holds even if the override fails (checked by forcing it off).
- **People:** the status sits on the name's baseline.
- **Outreach:** the chevron stays at the right.
- **Search placeholder:** now "Name, role or company", which fits at phone width.

**Verified:** heights unchanged, no overflow, nothing under the tab bar, no browser or hydration errors. `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (107 tests) and `pnpm build` all pass.

## 2026-10-04 · Phone polish: People density, Outreach rows, Settings spacing

**Human review status:**

- Approved: Pursuing, Companies and Settings on desktop.
- Directionally approved: Pursuing on a phone, and Outreach on desktop and phone.
- Still in review: the phone surfaces below. The tab bar (Today, People, Pursuing, Outreach) is approved.

**People on a phone:** the same sections, set closer.

- A tighter header, with contact buttons in it.
- "Why X matters" folds to three lines, with "Read all".
- A compact Next card and a shorter composer.
- A denser "Between you", opted into by the phone surfaces only.
- Sourced facts and the suggested angle fold into rows.

**Outreach on a phone:** slightly tighter rows and section heads.

**Settings on a phone:** tighter spacing; fields stay 46px tall with 16px text.

**Companies:** opened from an opportunity, Back returns to it.

**Verified in headless Chrome, with DOM measurements and no screenshots:** on every phone surface, no sideways overflow, nothing under the tab bar, 16px inputs, no visible undersized targets, and no console or hydration errors. The dev error report is empty.

**Checks:** `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (107 tests) and `pnpm build`.

## 2026-10-04 · Phone layouts for every surface; desktop refinements

**Dev "1 Issue" badge:** a real hydration error, not tooling.

- **Cause:** dates were worded with `Intl`, and the server's ICU says "Sept" where the browser says "Sep".
- **Fix:**
  - date names now come from fixed tables in `_shared/dates.ts`, with a test;
  - the Settings time-zone list renders only on the client.

**Desktop refinements, to the human's review:**

- **Pursuing:** "Where you are" is now a sentence plus the history's hairline-and-nodes path, with one brand marker, instead of a segmented bar.
- **Outreach:**
  - each state has a coloured mark with an icon;
  - the rhythm is roomier;
  - approved letters fold to a few lines;
  - "How a message moves" is quieter.

**Phone layouts, in review:**

- **People:** a new list, then one person: why they matter, next, what it's for, Between you, what you know.
- **Pursuing, Companies:** refined.
- **Outreach:** rebuilt as a list, then one person, with one strong action.
- **Settings:** lightened.
- **Tabs:** Today, People, Pursuing, Outreach. Companies stays contextual and Settings opens from the avatar.
- **Viewport:** the prototype's viewport allows safe areas and keyboard resizing.

**Verified:** `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (107 tests) and `pnpm build`. No screenshots.

**Next:** the human reviews the phone surfaces.

## 2026-10-04 · Core system approved; remaining surfaces prototyped

**Approved and recorded (D-023):** Today on desktop and phone, People on desktop, and onboarding on desktop and phone. Visual-system exploration is complete, and these surfaces are now frozen references. DESIGN.md has a status table plus the approved mobile rhythm and onboarding rules.

**Built in the C prototype, for review:**

- **Pursuing (Opportunities):**
  - grouped by timing, as closing soon, in progress and closed;
  - the domain stages shown as a quiet track;
  - what happens next, using Today's actions;
  - who you know there, what's happened, your notes and sourced facts.
- **Outreach:**
  - one track per person, grouped by derived outreach state: to write, to approve, to send, waiting, closed;
  - you act in place;
  - a side panel shows how a message moves, and that nothing is sent for you.
- **Companies:** derived only. Why each company matters is worded from the records, followed by what you're pursuing there, who you know, and what has happened.
- **Settings:**
  - profile and what you're aiming for, validated with the domain schemas;
  - notifications, Gmail and account deletion are marked as not available yet.
- **Every surface on a phone:** the approved shell and tab bar, with lists that drill into one item at a time.
- **Navigation:**
  - the rail and the Pursuing and Outreach tabs are live, and Settings joins the rail;
  - the harness has a Desktop/Phone switch, and old phone links still work.

Nothing moved into production routes. No new domain entities, persistence, auth, AI or Gmail.

**Verified:** `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (102 tests) and `pnpm build`. No screenshots.

**Next:** the human reviews the four new surfaces on desktop and phone.

## 2026-10-04 · Mobile refinement, and outreach intelligence documented

The human approved the desktop UI (Today, People, onboarding) and the mobile direction. This pass touched only mobile Today and mobile onboarding, to reduce compression; desktop styles are unchanged.

- **Spacing:** a 16px card gutter with headings inset to 20px. Vertical rhythm is roomier: small gaps inside an object, the largest between tasks.
- **Today mobile actions:** the primary action, then at most two secondaries with readable labels, then "Skip for now" as a quiet text action.
- **Lists:** titles wrap to two lines instead of truncating, with inset hairlines between items.
- **Bottom bar:** a taller tab bar with safe-area-aware bottom padding.
- **Onboarding on a phone:** larger choice rows with more space between them, and the optional "what they do / where" fields behind a disclosure.

**Outreach intelligence** is recorded as the long-term direction for AI: one grounded angle and one grounded draft from stored context, always approved by the user.

- It is recorded in PRODUCT.md, DOMAIN.md (it maps onto `Interpretation` and generated `Draft`) and ROADMAP.md, as phase 9 after launch preparation, with D-022.
- Nothing was implemented: no SDK, provider, Gmail, scraping or enrichment.

**Verified:** `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (87 tests) and `pnpm build`. No screenshots.

**Next:** the human reviews mobile Today and mobile onboarding.

## 2026-10-04 · Design lock, and onboarding in the prototype (phase 2, designing)

**Design lock.** The human approved Direction C. DESIGN.md now records the locked system and no longer reads UNSETTLED. D-021 records the approval, the rejection of A and B, and onboarding as the next design surface; it supersedes D-010 and D-019.

**Onboarding (C prototype only).** Seven steps: goal, roles, industries, places, one opportunity, one person, and a first step. Each screen asks one question, on the same sheet as the app.

- **Desktop:** "Your workspace" fills in beside the flow.
- **Narrow containers:** one column, with Back in the top bar and Continue pinned within thumb reach. This is the new "Onboarding · mobile" surface.
- **Finishing:** the answers become real domain records, built through the schemas in `_focus/workspace.ts`. The approved Today then opens on them, with People one click away.

Not approved, not in production, nothing saved.

**Verified:** `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (86 tests) and `pnpm build`. No screenshots.

**Next:** the human reviews onboarding on desktop and in the phone frame.

## 2026-10-04 · Phase 1: Visual design exploration

Built three genuinely different directions as disposable prototypes at `/prototypes/directions` (development only; production serves 404): **A · Briefing**, **B · Triage** and **C · Focus**. Each renders Today (desktop), People (list and detail), Onboarding and Today (mobile) from seed data read through `getRepository()`. Interactions run the real domain functions locally and nothing is saved. Everything lives in `src/app/prototypes/`; no production route, domain or data code changed.

**No direction is selected.** Visual direction remains UNSETTLED until the human chooses one.

**Verified:** `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (79 tests, including 17 prototype render/interaction tests) and `pnpm build`. Every view returned 200 in development. No screenshots were taken.

**Next:** human review and selection, then DESIGN.md is written for the chosen direction.

**Update — Direction C refinement.** C (Focus) was chosen as the conceptual direction; its execution is not approved. This pass refined Today (desktop), People (desktop) and Today (mobile) inside the prototype only:

- New type and colour system.
- Labelled rail and single-sheet layout.
- Person-first day list.
- History shown as a ledger.
- Undoable, announced actions.
- Mobile person sheet.

Onboarding is frozen at the first-round styling. DESIGN.md still reads UNSETTLED until the refined C is approved. Verified with `pnpm check` (82 tests).

**Update — authored refinement of C.** Reachout ink blue now marks location, selection, opportunities and "why they matter"; marigold, red and green are kept for status only. People was rebuilt around "why", with a relationship history that ends where it began and distinct styling for facts, notes and generated readings. Mobile got its own character. Still a prototype; not approved.

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
