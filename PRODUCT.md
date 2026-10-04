# Product

**Reachout** is a working name. Do not spend time on naming or branding.

## Thesis

Students and recent graduates get many of their best opportunities through people, not job boards. The work behind that is unstructured and easy to drop: finding the right people, understanding why each one matters, writing something worth replying to, and following up at the right moment. Reachout is a personal outreach operating system. It helps one person run a small number of thoughtful conversations well, and turn them into interviews and lasting professional relationships.

## Target user

University students, final-year students and recent graduates (up to about two years out) aiming at software engineering, technology, startups, finance, consulting or research. Typically they have 5–40 people in play at once and a handful of live opportunities. They have no recruiter and no CRM habit, and their confidence writing cold messages varies.

## Problem

- They don't know who to contact, or why that particular person.
- Context is scattered across LinkedIn, browser tabs, notes apps and inboxes.
- Messages are generic, so they go unanswered.
- Follow-ups are forgotten, or sent at the wrong time.
- Replies get lost and warm contacts go cold.
- Deadlines pass before the outreach happens.
- The tools that exist push volume (sequences, bulk send), which hurts reputation and reply rates.

## Primary outcome

**Real interviews and opportunities, created through thoughtful outreach.** In the longer term, a professional network the user actually maintains.

## Core loop

**Find → Research → Understand → Draft → Approve → Send → Follow up → Track relationship**

| Step       | What the product does                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------- |
| Find       | The user adds a person by hand, with where they found them (required); a LinkedIn URL is optional |
| Research   | The user records source facts, each with where it came from                                       |
| Understand | The user says why the person is relevant; later, labelled AI interpretations can suggest angles   |
| Draft      | A message to a person, usually tied to an opportunity                                             |
| Approve    | Explicit human approval. Editing an approved draft requires approval again                        |
| Send       | V1: the user sends from their own email or LinkedIn and marks it sent. Later: Gmail               |
| Follow up  | A next action on the person, surfaced in Today when it is due                                     |
| Track      | Interaction history and a qualitative relationship status                                         |

### Principles

- **Quality over volume.** No bulk sending, sequences or mail merge.
- **Human controlled.** Nothing is sent without approval, and nothing is sent automatically.
- **Relationship aware.** People have a history and a status. They are not leads.
- **Opportunity oriented.** Outreach serves concrete things the user is pursuing.
- **Useful without AI.** Deterministic rules run the core; AI is optional assistance.

Reachout is **not** Apollo or Instantly for students, a spam cannon, a generic CRM, LinkedIn automation, a scraping product, a bulk cold-email platform, or an AI message generator with a CRM attached.

## Information architecture (V1)

| Area          | Question it answers                                      |
| ------------- | -------------------------------------------------------- |
| **Today**     | What needs my attention today? The centre of gravity.    |
| People        | Who do I know, and where does each relationship stand?   |
| Opportunities | What am I pursuing, and how far along is each?           |
| Outreach      | What have I drafted, sent and heard back?                |
| Companies     | Who and what do I have at each organisation?             |
| Settings      | What am I aiming for, and how should the product behave? |

Onboarding sits outside the main area. Navigation appearance is defined in [DESIGN.md](DESIGN.md).

### Today

Today is derived from records on every read and is never a separate task list. It is ranked in this order:

1. Overdue follow-ups
2. Replies waiting for the user's response
3. Opportunity deadlines in the next 7 days (before applying)
4. Drafts awaiting approval, then approved drafts not yet sent
5. Next actions due in the next 3 days

Today is never empty while an open next action exists. From it the user can complete, snooze or reschedule. Exact rules are in [DOMAIN.md](DOMAIN.md#today-derived).

## Onboarding

Onboarding is first-class product functionality. It is part of the product, not a tour. Its information flow is:

1. **What are you trying to get?** Internship, graduate role, startup role, research opportunity, mentorship, or other.
2. **Target roles**
3. **Target industries / sectors**
4. **Target locations**
5. **First opportunity**: title and organisation; optional deadline and link.
6. **First relevant person**: name, role or organisation, and where the user found them.
7. **First next action**: what and when (default: today).

**Outcome:** the user's goals are saved, and one opportunity, one person and one next action exist. The user lands on a Today that already shows the first next action, plus the deadline if it falls within the window. Nobody finishes onboarding on an empty dashboard. Goals stay editable in Settings.

**Quality reference:** JobAssist, for onboarding clarity, pacing, low-friction questions, onboarding that feels like part of the product, and a personalised workspace at the end. Use it as a reference for product quality only; do not copy its UI or identity.

## MVP (V1)

- **Onboarding**, as above.
- **Today:** derived, with complete, snooze and reschedule.
- **People:** add and edit; source; facts; notes; relationship status; history.
- **Opportunities:** add and edit; stages; deadline; linked people.
- **Outreach:** drafts with approval; manual "mark as sent"; logging replies, meetings and notes; follow-ups; closing outreach.
- **Companies:** an aggregated view of people, opportunities and facts per organisation.
- **Settings:** goals, profile, time zone.
- Accounts and persistent storage.
- Responsive web for desktop, tablet and mobile.

Gmail is the first integration after the core is complete.

## Non-goals (V1)

- Bulk or sequenced sending, mail merge, open and click tracking.
- LinkedIn scraping, automated LinkedIn messaging, browser automation.
- Contact enrichment or email finding from third-party databases.
- Teams, workspaces, sharing, or recruiter-side features.
- Numeric relationship or lead scores, streaks and gamification.
- Native mobile apps.
- Job-board aggregation.
- Billing.

## Future capabilities (not commitments)

- Gmail, then Outlook: send approved drafts and detect replies.
- Outreach intelligence (below): one grounded angle and one grounded draft, built from what the user has already stored.
- User-initiated import, such as a CSV or the user's own LinkedIn data export file.
- Calendar awareness for meetings.

## Future direction: outreach intelligence

Reachout began as a way to help someone write strong cold outreach to useful people. Once the core product, accounts, persistence and email foundations exist, the context already stored in Reachout should help the user decide **who is worth contacting, why they are relevant, which angle is strongest, what to send, and when to follow up.**

The idea is not "AI writes cold emails". Reachout understands the person, the opportunity, the user's goal, the source facts, the user's notes and the relationship so far. From that it proposes **one grounded outreach angle and one grounded draft.**

- **Inputs, all already stored:**
  - the person's role and company, and why they matter;
  - the linked opportunity and the user's goal;
  - source facts and the user's notes;
  - relationship history, prior outreach and the open next action;
  - existing interpretations.
- **Output:** one recommended angle, with why it was chosen and the facts it rests on, and one draft built on that angle. Specific, contextual and concise; never generic or spammy.
- **Boundary:**
  - assistive only: the user edits the draft and explicitly approves it before anything is sent;
  - no autonomous outreach, auto-send, batch generation, scraping or enrichment;
  - nothing beyond what the user has stored.
- **Model:** it fits the existing records. The angle is an `Interpretation`; the draft is a `Draft` with `origin: "generated"` ([DOMAIN.md](DOMAIN.md#research-context-facts-notes-interpretation)).

It is scheduled after launch preparation (ROADMAP phase 9) and is not part of the MVP (D-022).

## Product risks

| Risk                                                   | Guard                                                                                |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Drift into a volume tool ("send this to 50 people")    | No bulk operations in the domain or the UI                                           |
| Too much data entry before any value                   | Onboarding ends with a useful Today; capture must be fast                            |
| AI produces generic messages that undermine the thesis | Facts and interpretation kept separate; generated content cites facts; approval gate |
| Usage is seasonal, following recruiting cycles         | Relationship tracking gives value between cycles                                     |
| Friction of manual sending before Gmail                | "Mark as sent" is a single step                                                      |
| LinkedIn is a main channel but cannot be integrated    | Manual channels are first-class, not a fallback                                      |
| Users store information about third parties            | Minimal fields, user-owned data, no enrichment, no scraping                          |

## Success

**Primary:** users get interviews, opportunities and meaningful conversations that began with outreach they tracked in Reachout.

Indicators used for product evaluation, never shown to users as scores:

- Share of users who finish onboarding with a useful Today.
- Weekly use of Today during recruiting season.
- Reply rate on the user's sent outreach.
- Follow-ups completed on time.
- Opportunities reaching applied or interviewing with a linked person.

The number of messages sent is **not** a success measure.
