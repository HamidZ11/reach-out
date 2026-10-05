# Devlog

Newest first. One entry per working session: what changed, why, and what is next. Durable decisions go in DECISIONS.md, not here.

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
