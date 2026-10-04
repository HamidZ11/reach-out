# Reachout

A personal outreach operating system for university students and recent graduates: find the right people, understand them, write something worth replying to, follow up, and turn conversations into opportunities. "Reachout" is a working name.

**Status:** the foundation and the design are complete. Every surface is approved and frozen, on desktop and phone. The authoritative design reference is the prototype at `/prototypes/directions?v=3` (development only, with a Desktop/Phone switch). Production routes are still placeholders.

```sh
pnpm install
pnpm dev      # http://localhost:3000 — runs as the seed user; screens are placeholders
pnpm check    # format, lint, typecheck, test, build
```

Requires Node 24+ and pnpm 11.

| Doc                                | What it covers                                    |
| ---------------------------------- | ------------------------------------------------- |
| [PRODUCT.md](PRODUCT.md)           | Thesis, users, core loop, onboarding, scope       |
| [DOMAIN.md](DOMAIN.md)             | Entities, invariants, Today and outreach rules    |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Stack, layers, data, auth, integration boundaries |
| [DESIGN.md](DESIGN.md)             | Quality bar, process, accessibility, tooling      |
| [DECISIONS.md](DECISIONS.md)       | Numbered durable decisions                        |
| [ROADMAP.md](ROADMAP.md)           | Phases and acceptance criteria                    |
| [DEVLOG.md](DEVLOG.md)             | What happened, newest first                       |
| [CLAUDE.md](CLAUDE.md)             | Rules for coding agents                           |
