# Design

> **VISUAL DIRECTION: UNSETTLED**
>
> No typography, colour, density, layout, navigation appearance, component style, motion or visual motif has been chosen. Do not infer one from the current code: the route placeholders are deliberately unstyled. A dedicated design phase (roadmap phase 1) decides all of these and rewrites this document.

## Quality bar

The eventual interface must be top-tier: something students would choose over a spreadsheet and that feels made for this product, not assembled from a kit. In practice that means:

- The primary task on each screen dominates. On Today, that is acting on the next item.
- Identity is stronger than metadata. Status is legible without everything shouting.
- Repeated objects (people, opportunities, Today items) keep one stable structure across states.
- Empty, loading, error, long-content and selected states are designed, not left as defaults.
- Motion explains change or gives feedback. It is never decoration.
- It works fully on a phone. Mobile is not a degraded desktop.
- Copy is specific, warm and brief, in UK English.

## Process

Do not go straight from the product brief to production design.

1. **Understand the product:** [PRODUCT.md](PRODUCT.md), [DOMAIN.md](DOMAIN.md), the seed data.
2. **Explore** two or three _genuinely different_ concepts: different structure and density, not three colourways of one layout.
3. **Render representative screens** for each concept with realistic seed data: Today (desktop and mobile), a person with history and research context, one onboarding step.
4. **Human review** of the actual rendered output. Code review and passing tests are not visual review.
5. **Select one direction.** The human decides.
6. **Define this document fully:** typography, colour, density, layout, navigation, components, motion, motifs, and what each reference contributes.
7. **Implement production UI** against it, one product area at a time (see [ROADMAP.md](ROADMAP.md)).
8. **Critique and refine** against this document. Approved surfaces are not casually reopened.

Exploration happens in isolation, on its own branch or worktree. Only the selected direction reaches `main`. There is no design lab in this repository yet; the design phase creates one if it needs one.

### Decided by the design phase (not before)

Typography · colour · density · layout system · navigation appearance (desktop, tablet, mobile) · component styling · motion · visual motifs · iconography · whether and how a component library is used.

## Accessibility requirements

These are fixed now, whatever the visual direction:

- WCAG 2.2 AA.
- Semantic HTML and landmarks; one `h1` per page; `lang="en-GB"`.
- Every action is keyboard-operable, including acting on Today items, with a visible focus indicator.
- Status (relationship, outreach, deadlines) is never conveyed by colour alone.
- Targets are at least 24×24 CSS px; primary touch actions aim for 44×44.
- Form fields have labels; errors are tied to their fields and announced.
- Async outcomes (approve, mark sent, complete, snooze) are announced to assistive technology.
- `prefers-reduced-motion` is respected.
- Content reflows at 320 CSS px and at 200% zoom without loss of function.
- Dates are shown in an unambiguous form; relative dates ("in 3 days") always have the absolute date available.

## Responsiveness requirements

- One responsive web app for desktop, tablet and mobile. No native app.
- Works from 320 CSS px wide. No horizontal page scroll; any table scrolling stays local to the table.
- The full core loop is possible on a phone, not just viewable.
- Essential actions are never hover-only.
- How layouts adapt (for example, list and detail becoming separate views on narrow screens) is a design-phase decision.

## Tooling

These are installed in preparation for the design and build phases. **None was used to make visual decisions during the foundation.** Each has one job. Do not run several over the same surface without naming which one leads.

| Tool                          | Status                                                                                              | Invocation                                                | Responsibility                                                                                 |
| ----------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **emil-design-eng**           | Installed, user-level: `~/.claude/skills/emil-design-eng`                                           | Explicit only (`/emil-design-eng`)                        | Interaction craft, motion judgement, detailed taste                                            |
| **better-ui**                 | Installed, user-level: `~/.claude/skills/better-ui`                                                 | Explicit only (`/better-ui`)                              | Focused final polish; removing generic UI patterns                                             |
| **Impeccable** (4.5.0)        | Installed, user-level skill: `~/.claude/skills/impeccable`                                          | Explicit only (`/impeccable audit · critique · polish …`) | Critique, consistency, refinement                                                              |
| **crafted-frontend-ui**       | Installed, user-level and personal: `~/.claude/skills/crafted-frontend-ui` (with visual references) | Can trigger automatically on UI work                      | High-quality implementation of an **approved** direction                                       |
| **BoardUI** (skill 2026.10.3) | Installed, project-level: [`.claude/skills/boardui`](.claude/skills/boardui/SKILL.md)               | Explicit only (`/boardui`)                                | Reusable primitives and components where they support the approved design without dictating it |

Notes:

- **User-level skills are not in this repository.** On another machine, install better-ui (`npx skills add jakubkrehel/skills --skill better-ui -g -a claude-code`), emil-design-eng (`npx skills add emilkowalski/skills --skill emil-design-eng -g -a claude-code`) and Impeccable (`pbakaus/impeccable`). crafted-frontend-ui is personal and must be copied from its owner's source.
- **Impeccable plugin:** an older Impeccable plugin (4.4.0) is in the local plugin cache but is deliberately **not enabled** for this project. It would duplicate the user-level skill and adds hooks on every edit and at session end.
- **BoardUI is a design system with opinions:** semantic tokens, its own type utilities, `rounded-3xl` cards and a fixed motion language. Its skill tells agents to run `boardui init`, which writes `theme.css`, `typography.css` and always-on agent rules into `AGENTS.md`. For this project:
  - The skill's frontmatter was edited to `disable-model-invocation: true`, so it cannot trigger on its own. `npx boardui@latest skill --force` would undo this; re-add the line after updating.
  - Do **not** run `boardui init` or `boardui add` until the design phase decides whether BoardUI fits the approved direction.
  - If adopted, take component behaviour (React Aria accessibility, structure) and re-skin it with this project's tokens. Never adopt BoardUI's tokens, type scale or motion as Reachout's identity.
  - BoardUI assumes `@/*` maps to the repository root and expects `components/`, `styles/` and `utils/` at that root. This project maps `@/*` to `src/*`, so reconcile the paths at adoption.
  - The BoardUI MCP server is not registered.
- **crafted-frontend-ui** can trigger automatically and suggests recording a direction in DESIGN.md. In this repository, a direction is only recorded after the human selects one (step 5 above).
- Several skills say to render and screenshot screens. In this repository, **ask first** (see [CLAUDE.md](CLAUDE.md)).
- Other design-adjacent user-level skills exist, such as `prototype`, `break-ui` and `mobile-native`. `prototype` (several genuinely different versions behind a picker) is a candidate tool for step 2.
- **Never let a component library become the visual identity.**

## Banned shortcuts

- Choosing fonts, a palette, radii, shadows or a spacing scale before a direction is approved, including "temporary" ones.
- Adopting a library's default theme (BoardUI, shadcn or any other) as the look of the product.
- Decorating the route placeholders instead of replacing them with designed screens.
- A generic SaaS dashboard: KPI strip, card grid of counts, charts with no decision behind them.
- Fake numbers: relationship scores, "profile strength", streaks, progress rings.
- Lorem ipsum or joke data. Design and build with realistic domain data (the seed dataset).
- Hover-only actions; colour-only status; undesigned empty, loading or error states.
- Producing a single concept and calling it exploration.
- Treating a passing build or tests as visual approval.
- Taking screenshots without being asked.
- Inventing a visual metaphor ("desk", "inbox zero", "command centre") before the design phase.
