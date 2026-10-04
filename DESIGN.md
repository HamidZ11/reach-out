# Design

> **VISUAL DIRECTION: APPROVED — Direction C ("Focus"). Design frozen on 2026-10-04 (D-024).**
>
> The authoritative reference is the prototype in [`src/app/prototypes/_focus/`](src/app/prototypes/_focus/): view it at `/prototypes/directions?v=3`, with the Desktop/Phone switch. Production UI reproduces it; it does not reinterpret it. See **Design freeze** below.

## Status

Visual-system exploration is **complete**. Every surface is approved on desktop and phone, and so is the mobile navigation (D-024).

| Surface    | Desktop      | Phone        |
| ---------- | ------------ | ------------ |
| Today      | **Approved** | **Approved** |
| People     | **Approved** | **Approved** |
| Onboarding | **Approved** | **Approved** |
| Pursuing   | **Approved** | **Approved** |
| Outreach   | **Approved** | **Approved** |
| Companies  | **Approved** | **Approved** |
| Settings   | **Approved** | **Approved** |

## Design freeze

Approved surfaces are not redesigned during implementation. A change needs one of these:

- a bug fix;
- an accessibility issue;
- a responsive defect;
- an implementation constraint;
- an explicit design decision by the human.

Implementation must not:

- reinterpret the palette, or swap the fonts;
- replace the navigation, or the approved mobile patterns;
- "modernise" layouts, or convert surfaces to generic shadcn;
- add cards or pills because they are convenient.

When production code and the prototype disagree, the prototype wins unless the human decides otherwise.

**Deferred:** the favicon and app icon wait until the Reachout mark is approved for production. Until then, the development 404 for `/favicon.ico` is expected.

## Principles

- **Focus first.** Every screen has one dominant thing to do. On Today, that is the current item.
- **Relationship first.** People are understood through _why they matter_ and what has happened between you, not through fields.
- **Hierarchy from layout, not containers.** One white sheet, quiet side panels, hairline dividers. Add a contained surface only for something independently actionable.
- **Restraint.** Colour, pills, icons and motion are spent where they carry meaning.
- **Personal and professional.** Warm and calm, never a CRM, a reading app or an enterprise console.

## Colour

Two kinds of colour, never mixed.

| Role            | Token                                                      | Value                           | Use                                                                                                                                                 |
| --------------- | ---------------------------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canvas          | `--canvas`                                                 | `#ECEBE7`                       | Outer warm neutral; holds the rail and frames the sheet                                                                                             |
| Sheet           | `--sheet`                                                  | `#FFFFFF`                       | Primary application surface                                                                                                                         |
| Tint            | `--tint`                                                   | `#F6F5F2`                       | Secondary panels (Your day, People list), quiet modules                                                                                             |
| Paper           | `--paper`                                                  | `#F8F5ED`                       | The user's own words: notes, letters                                                                                                                |
| Lines           | `--line`, `--line-strong`                                  | `#E7E5E0`, `#D4D1CA`            | Dividers, form fields                                                                                                                               |
| Ink             | `--ink`, `--ink-2`, `--ink-3`                              | `#19181B`, `#48474C`, `#66656B` | Text roles; ink is also the primary button                                                                                                          |
| **Brand**       | `--brand` (+ `-strong`, `-ink`, `-wash`, `-soft`, `-line`) | `#2753A8`                       | Where you are and what you chose: active navigation, the current item, the selected person, opportunities, "why they matter", progress, focus rings |
| Needs attention | `--attn` (+ `-wash`, `-ink`)                               | `#F2B23B`                       | Status only: your turn, waiting for your approval                                                                                                   |
| Overdue         | `--late` (+ `-wash`)                                       | `#B5381B`                       | Status only                                                                                                                                         |
| In conversation | `--good` (+ `-wash`)                                       | `#1D6B4A`                       | Status only: replied, approved                                                                                                                      |

- Brand never signals status, and status colours never decorate.
- Status always pairs colour with words. Marigold is never used as text colour; text on its wash uses `--attn-ink`.
- Body and metadata text meet WCAG AA on every surface they appear on.

## Typography

| Role                  | Face                | Size / weight                 | Notes                                    |
| --------------------- | ------------------- | ----------------------------- | ---------------------------------------- |
| Current item headline | Bricolage Grotesque | 34 / 600, `font-stretch: 90%` | Desktop Today; 22 on mobile              |
| Person name           | Bricolage Grotesque | 38 / 600                      | People; 24 in the mobile sheet           |
| Page title            | Bricolage Grotesque | 26 / 600                      | 32 on mobile                             |
| "Why X matters"       | Bricolage Grotesque | 26 / 500                      | The signature statement; 17–19 on mobile |
| Section heading       | Bricolage Grotesque | 16 / 600                      |                                          |
| Body                  | Hanken Grotesk      | 15 / 400, line-height 1.55    |                                          |
| Secondary             | Hanken Grotesk      | 14                            |                                          |
| Metadata, labels      | Hanken Grotesk      | 12.5 / 650 for labels         |                                          |
| Micro (tiles, nav)    | Hanken Grotesk      | 10–11.5 / 700                 | Uppercase only in date tiles             |

- Bricolage carries identity: names, the thing to do, titles. Hanken carries everything operational.
- Tabular numerals for dates and counts. Inputs are 16px or larger.

## Surfaces, spacing and density

- **Radii, concentric where surfaces nest:** 8 (small marks), 12 (controls, tiles), 16 (rows), 22 (sheet, modules), 26 (mobile cards).
- **Depth** comes from layered transparent shadows (`--shadow-border`, `--shadow-lift`). Borders are only for dividers and form fields.
- **Density is medium.** The main column is about 800px; side panels are 300–368px. The largest gaps go between tasks; the smallest within an object.
- **Pills are rare:** active navigation, mobile tabs, and nothing else by default. A person's state is a sentence, not chips.

## Navigation

- **Desktop:** an 84px labelled rail on the canvas.
  - Each item has an outline icon and its label.
  - The active item's icon is filled white on a brand pill.
  - A marigold dot on Today means something needs you.
  - Content sits on one white sheet beside the rail.
- **Settings** sits at the foot of the rail, above your avatar.
- **Mobile:** a bottom tab bar with labels, holding the four places you go daily: Today, People, Pursuing, Outreach.
  - The active tab is a filled icon on a brand pill, with safe-area padding.
  - **Companies** stays contextual. It opens from an opportunity and goes Back to it, with Pursuing still marked in the bar, never from a fifth tab.
  - **Settings** opens from your avatar in the top bar.
  - These two rarely start a session, and a six-tab bar would be cramped.
- **Drilling in on a phone:**
  - a list opens one item at a time, under a "Back to …" control;
  - people met inside another surface open in the person sheet, so you keep your place;
  - history shows the newest few moments, with "Show earlier" for the rest.

## Date tile

A functional timing device: weekday over day number, coloured by meaning (late, needs attention, in conversation, neutral).

- **Use it only where time matters:** the current Today item, Today's list, a person's next step, deadlines, onboarding's first step and deadline.
- **Never** in history (which uses a typographic date column), on people, on headers, or as decoration.

## Today

- The current item dominates the main column:
  - date tile and headline;
  - status in words with the absolute date;
  - the person (linked to People);
  - one band of context: why they matter, what happened last, what it's for;
  - one primary action.
- "Your day" is a quieter tinted panel grouped by tier. The current row is outlined in the brand.
- "Then" previews what comes next. There are no metrics, KPI cards or charts.
- Every action is announced, with Undo.

## People

- An opportunity-grouped list beside the selected person. The selected row gets a brand wash and a ringed avatar.
- The person reads top to bottom:
  1. name, role at company, and standing as a sentence, with round contact buttons;
  2. **"Why X matters"** as the central statement;
  3. the next step;
  4. **Between you**: a dated history, newest first, ending with how you found them;
  5. what you know, beside it.
- **Three kinds of knowledge, three treatments:**
  - **Source facts** are numbered, each with its source icon and link.
  - **Your notes** sit on warm paper, in your words.
  - **Generated interpretation** has a dashed outline, is labelled "generated, not fact", and cites facts by number.

## Pursuing, Outreach, Companies, Settings

- **Pursuing:**
  - grouped by timing: closing soon, in progress, closed;
  - each opportunity shows where you are (a sentence and a quiet stage path), what happens next, who you know there and what has happened;
  - never a pipeline, kanban or funnel.
- **Outreach:**
  - one track per person, grouped by action state: to write, to approve, to send, waiting, closed;
  - each state has a coloured mark;
  - you act where the item sits;
  - "How a message moves" explains the approval path and stays secondary;
  - never an inbox: no folders, unread counts or bulk controls.
- **Companies:**
  - derived and light;
  - "Why X matters" is worded from the records;
  - then what you're pursuing there, who you know, and what has happened.
- **Settings:**
  - profile and what you're aiming for, validated on the field;
  - features that don't exist yet are said plainly, never shown as dead controls.

## Mobile

- Focus-first. The current item is a card with a date tile, the person (tap for a sheet with their history), a two-line "why", the last exchange, a full-width primary action, and only the secondary actions that apply.
- "Up next" gets more room than the rest of the day.
- **Rhythm:**
  - Cards sit 16px from the screen edge; headings are inset to 20px.
  - Gaps are small within an object and largest between tasks.
  - List titles wrap to two lines rather than truncating.
- **Actions read in order:** one full-width primary, at most two secondaries with readable labels, then "Skip for now" as a quiet text action.
- **Bottom bar:** bottom padding is the larger of 14px and the home-indicator inset.
- **Touch:** targets are at least 44px. Hover effects only with a mouse. Press feedback on tap. Inner scroll is contained, with safe-area insets.

## Onboarding

- **Structure:**
  - one question per step, on the same sheet as the app;
  - the footer never moves;
  - only the first, single-choice step advances on its own.
- **Desktop:** "Your workspace" fills in beside the flow, using the same tiles and brand marks as Today.
- **Phone:**
  - one column on the canvas;
  - Back in the top bar and Continue pinned within thumb reach;
  - optional detail behind a disclosure.
- **Validation:** problems show only after Continue, on the field, in the needs-attention colour, as help rather than blame.
- **It ends inside Today:** the answers become real records, with the first step in focus.

## Motion

Motion explains change and is never decoration. Most transitions are 150–260ms, using ease-out `cubic-bezier(0.23, 1, 0.32, 1)`.

- Content that changes, such as the next item or a new step, fades and rises 4–6px.
- Selection changes colour and shadow in 150ms.
- Buttons press to `scale(0.96)`.
- Sheets rise from the bottom.
- `prefers-reduced-motion` turns animation off.
- A dedicated motion pass comes later.

## Accessibility (fixed)

- **Standard:** WCAG 2.2 AA. Semantic HTML and landmarks, one `h1` per page, `lang="en-GB"`.
- **Keyboard and focus:** every action is keyboard-operable, with a visible focus ring in the brand colour.
- **Status:** never conveyed by colour alone.
- **Targets:** at least 24×24px; primary touch actions are 44–52px.
- **Forms:** fields have labels; errors are tied to their fields and written as help, not blame.
- **Announcements:** async outcomes (approve, mark sent, complete, snooze) are announced through a polite live region.
- **Reflow:** content reflows at 320px and at 200% zoom.
- **Dates:** relative dates always come with the absolute date.

## Anti-patterns

- **No CRM language or layout:** no contact tables as the primary view, no lead or pipeline vocabulary, no chip rows of fields.
- **No editorial or reading-app treatment:** no serif-led prose layouts or passive whitespace.
- **No dense enterprise or dark pro-tool treatment.**
- **No dashboard decoration:** no KPI strips, card grids of counts, decorative charts, scores or streaks.
- **No generic SaaS polish:**
  - no purple or AI gradients, glassmorphism or neon;
  - no giant illustrations, abstract art, fake testimonials or statistics;
  - no AI-assistant framing.
- **No card soup:** no huge radii everywhere, no nested cards, no eyebrow labels above headings.
- **Brand stays out of status, status colours stay out of decoration.**
- **Don't adopt BoardUI's tokens, type or motion as Reachout's identity.**

## Directions explored

| Direction     | Result                     | Why                                                                                                                             |
| ------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **C · Focus** | **Approved**, then refined | Focus-first, relationship-first, warm and calm; reads as Reachout                                                               |
| A · Briefing  | Rejected                   | Too editorial and passive; read like a reading product, not an outreach system                                                  |
| B · Triage    | Rejected visually          | Too dense, dark, enterprise and CRM-like. Some structural ideas (tier grouping, acting in context, keyboard paths) survive in C |

The exploration prototypes stay in `src/app/prototypes/` until production UI replaces them.

## Tooling

| Tool                | Role from now on                                                                                      |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| crafted-frontend-ui | Design authority when implementing this system                                                        |
| better-ui           | Focused polish against this system                                                                    |
| Impeccable          | Critique and audits against this document                                                             |
| emil-design-eng     | The later motion pass                                                                                 |
| BoardUI             | Optional behavioural primitives only, re-skinned with these tokens; `boardui init` is not run (D-021) |

- User-level skills live in `~/.claude/skills`.
- Ask before taking screenshots (CLAUDE.md).
