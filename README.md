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
| Frontend | Vue 3, JavaScript, Vite, Bootstrap 5.3, Vue Router, Pinia, Vue I18n, Chart.js, Papa Parse |
| Backend | Node.js, Express, PostgreSQL (`pg` + SQL migrations), Zod |
| Shared | Pure JS financial helpers (`money`, `safeToSpend`, `roundUp`) |
| Tests | Vitest (unit), Playwright (e2e) |
| Defaults | HKD, `Asia/Hong_Kong`, English + Traditional Chinese |

Use **Bootstrap CSS with Vue-controlled interactions** (avoid loading Bootstrap’s JS bundle alongside Vue-driven modals/dropdowns).

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

- Onboarding, dashboard, saving buckets, expense logging
- CSV import (preview, validate, confirm)
- Accounts, categories, budget planner
- Estimated **safe-to-spend** (with assumptions shown)
- Privacy toggle (hide amounts), bilingual UI, light/dark theme
- Export and account deletion

## Architecture (summary)

```text
Vue (Bootstrap / Pinia / Router) ──HTTPS/JSON──► Express API ──► PostgreSQL
                                                      └──► HKMA reference, optional AI (server-side)
```

Rules:

1. No database logic in Vue components.
2. Financial formulas in **shared pure functions**; backend authoritative for persisted calculations.
3. **Demo mode** (labeled fictional data) vs **account mode** (auth + PostgreSQL)—never silently fall back to demo on API failure.
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
# JavaScript, Router, Pinia, unit tests, Playwright if offered
cd client && npm install
npm install bootstrap@5.3 bootstrap-icons vue-i18n chart.js papaparse
npm run dev
```

**Server:**

```bash
mkdir server && cd server
npm init -y && npm pkg set type=module
npm install express pg zod helmet express-rate-limit dotenv
```

Environment examples are documented in [`PLAN.md` §10.2](PLAN.md). Never put private API keys in `VITE_*` variables.

## Working with Cursor

Project skill for implementers and agents: [`.cursor/skills/pocketgoals-hk/SKILL.md`](.cursor/skills/pocketgoals-hk/SKILL.md).

## Hackathon / course context

This repo (**BUHack2**) is the home for **PocketGoals HK** implementation work.

## License

TBD—add before public distribution.
