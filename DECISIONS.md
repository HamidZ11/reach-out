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

## D-007 · Database deferred; PostgreSQL on Supabase is the likely direction

No database, hosted project, credentials, migrations or RLS in the foundation. **Why:** the domain should settle first, and Supabase pairs naturally with Supabase Auth (D-008). **Consequence:** decided for real in roadmap phase 6, including the access layer.

## D-008 · Authentication is required; the provider is deferred; unconfigured production fails closed

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

## D-018 · `cacheComponents` (Partial Prerendering) is off for now

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
