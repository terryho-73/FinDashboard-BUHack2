# PocketGoals HK — 香港青年儲蓄助手

Bilingual, mobile-first savings dashboard for university students, fresh graduates, and young professionals in Hong Kong.

**Repository status:** Specification and agent guidance live here; application code (`client/`, `server/`, `shared/`, `tests/`) is **not yet scaffolded**.

**Build specification:** [`PLAN.md`](PLAN.md) — milestones, API, data model, financial rules, testing, and contributor workflow.

## What this app does

PocketGoals HK helps users answer:

1. **How much have I set aside?**
2. **How much can I spend before my next income arrives?**
3. **What small changes would help me reach my goals sooner?**

It tracks manually entered or imported transactions, organizes savings into **virtual goal buckets**, and explains spending in a friendly, non-judgmental way.

### Product boundaries

| In scope (MVP) | Out of scope (initially) |
|----------------|---------------------------|
| Personal finance tracker | Bank or payment wallet |
| Budgeting and savings planner | Real money transfers (Octopus, FPS, bank) |
| Virtual goal allocations | Investment advice |
| Optional AI explanations (later) | Auto-access to every HK financial account |

**Recording savings is not moving money.** The first version uses simulated rules and virtual buckets—not claims of transferring funds through Octopus, FPS, or banks.

## Technology stack

| Layer | Choice |
|-------|--------|
| Frontend | React, **TypeScript**, Vite Plus, TanStack Router, Tailwind CSS v4, shadcn/ui, Lucide React |
| Backend | Vite Plus with `@omg-dev/vite-plugin` and `@omg-dev/server`, local SQLite database |
| Data access | `@omg-dev/sdk` collections, Drizzle ORM, Better Drizzle |
| Shared | Typed pure finance and preference modules in `src/lib/` |
| Validation | ESLint and Vite Plus production build |
| Defaults | HKD, `Asia/Hong_Kong`, English + Traditional Chinese |

Use the Vibes development plugin for local API routes, database access, and realtime collection updates. The current prototype runs in credential-free Demo mode with fictional local data.

## Planned repository layout

```text
├── README.md
├── PLAN.md
├── client/
├── server/
├── shared/
├── docs/
└── tests/
```

Full tree and module conventions: see [`PLAN.md` §4](PLAN.md).

## MVP features

- Mobile-first dashboard with savings summary and **safe-to-spend** estimate
- Virtual saving jars with targets, progress, top-ups, and deletion
- Expense logging with categories, payment channels, recurring charges, and round-up savings
- Payday income logging with automatic savings split across jars
- Cash-flow forecast with planned-purchase impact preview
- Spending charts, recent activity, subscription detection, and cut-back insights
- Budget settings for income, rent, utilities, MPF, savings percentage, and round-up amount
- Privacy toggle for hiding balances, bilingual English/Traditional Chinese UI, and light/dark theme
- Demo seed data with local SQLite persistence and realtime collection updates

## Architecture (summary)

```text
React (Tailwind / TanStack Router) ──SDK collections──► Vite Plus + Vibes API ──► SQLite
                                                        └──► Local realtime updates
```

Rules:

1. No database logic in React components; use SDK collections and the Vibes API.
2. Financial formulas live in **typed pure modules** under `src/lib/`; keep display logic separate from data access.
3. The current prototype runs in **Demo mode** with local SQLite persistence and no credentials. Account mode is not implemented yet.
4. AI (when added) uses an allowlisted tool set only—no unrestricted SQL or transfers.

## Money and ledger rules (critical)

- Store amounts as **integer minor units** (e.g. HK$38.50 → `3850`).
- Distinguish income, expense, refund, **transfer between owned accounts**, card repayment, and **goal allocation**.
- Payment method (Octopus, FPS, etc.) does **not** define transaction meaning.
- Goal allocation moves tracked balance into a bucket—it is not income and not a bank transfer.

Safe-to-spend (MVP): balance-based discretionary allowance divided by remaining days in the planning period, with explicit warnings for missing or stale data. Details in [`PLAN.md` §7](PLAN.md).

## Development modes

| Mode | Behavior |
|------|----------|
| Demo | Fictional seed data, no credentials, full UI flow, visible “Demo data” label |
| Account | Session auth, PostgreSQL, ownership checks on every record |

## Suggested build order

See [`PLAN.md` §14](PLAN.md) for milestones 0–6 (UI prototype → financial logic → persistence → import → integrations → production).

Do **not** block early milestones on bank aggregation.

## Initial setup (when scaffolding)

**Client:**

```bash
npm create vue@latest client
# TypeScript: Yes, Router, Pinia, unit tests, Playwright if offered
cd client && npm install
npm install bootstrap@5.3 bootstrap-icons vue-i18n chart.js papaparse
npm run dev
```

**Server:**

```bash
mkdir server && cd server
npm init -y && npm pkg set type=module
npm install express pg zod helmet express-rate-limit dotenv
npm install -D typescript tsx @types/express @types/node
```

Configure `tsconfig.json` and run the API with `tsx` in development (see [`PLAN.md` §2](PLAN.md) TypeScript conventions).

Environment examples are documented in [`PLAN.md` §10.2](PLAN.md). Never put private API keys in `VITE_*` variables.

## Working with Cursor

Project skill for implementers and agents: [`.cursor/skills/pocketgoals-hk/SKILL.md`](.cursor/skills/pocketgoals-hk/SKILL.md).

## Hackathon / course context

This repo (**BUHack2**) is the home for **PocketGoals HK** implementation work.

## License

TBD—add before public distribution.
