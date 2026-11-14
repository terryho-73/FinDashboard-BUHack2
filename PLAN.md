# PocketGoals HK — Implementation Plan

**Audience:** Contributors, reviewers, and coding agents building this repository.  
**Status:** **Active app** in repo root — React + TypeScript, Vite+, collections API, dev persistence via `@omg-dev`.  
**UI product name:** *Savings Jars HK* (bilingual). **Spec name:** PocketGoals HK (香港青年儲蓄助手).  
**Companion:** [`README.md`](README.md) for onboarding; [`AGENTS.md`](AGENTS.md) for UI/design-system rules in this stack.

Treat features as **implemented only when verifiable in the repo**; sections marked **Target** describe the next evolution (optional custom backend).

**Estimated progress (demo track):** ~**60%** of a competition-ready product; ~**35%** of the original full-stack PLAN MVP (auth, CSV, multi-account ledger, PostgreSQL).

---

## 1. Product summary

### 1.1 Purpose

PocketGoals HK helps Hong Kong students and young professionals answer:

1. How much have I set aside?
2. How much can I spend before my next income arrives?
3. What small changes would help me reach my goals sooner?

### 1.2 Boundaries

| In scope | Out of scope (initially) |
|----------|---------------------------|
| Personal finance tracker | Holding or moving real customer funds |
| Virtual saving jars / buckets | Bank transfers (Octopus, FPS, banks) |
| Budget hints and insights | Investment advice |
| Optional AI later | Auto-sync every HK account |

**Recording savings ≠ moving money.**

### 1.3 Tone and UX

Encouragement over guilt (儲少少，都係進步); touch targets ≥ 44px; chart/accessibility text; `prefers-reduced-motion`; preserve form state on errors; bottom actions must not cover content.

### 1.4 Defaults

- **HKD**, timezone **Asia/Hong_Kong**
- **English + Traditional Chinese** (`src/lib/i18n.ts`, `en` / `zh`)

---

## 2. Technology stack (current — mandatory for this repo)

| Layer | Technology | Notes |
|-------|------------|--------|
| Language | **TypeScript** | `.ts` / `.tsx` |
| UI | **React 19** | Function components |
| Build | **Vite+** (`vite-plus`) | `vite.config.ts`, `@omg-dev/vite-plugin` |
| Routing | **TanStack Router** | File routes under `src/routes/` |
| Styling | **Tailwind v4 + shadcn** | See `AGENTS.md`; semantic tokens in `src/index.css` |
| Persistence | **`@omg-dev/schema` + SDK** | `schema.ts`; `useCollection` → `/api/*` |
| DB (dev) | **SQLite via Drizzle proxy** | `server/db.ts`, `@omg-dev/server` |
| Icons | **lucide-react** | |
| Package manager | **npm** (lockfile tracked) | Pin **`shadcn` to `4.23.0`** — never `1.0.0` (wrong package) |

**Dependency rule:** Do **not** run `npm audit fix --force` — it downgrades `shadcn` and breaks `shadcn/tailwind.css`.

**Do not introduce** (unless explicitly approved): a second UI framework, Next.js, duplicate routers, microservices, multi-agent AI.

### Phase B — optional later (not current default)

Express + PostgreSQL + `shared/` money modules per §8.3. Use only if rubric or production requires a self-owned API. See §14 milestone **B3**.

---

## 3. Architecture (current)

```text
┌─────────────────────────────────────────────┐
│ React SPA (src/App.tsx, QuickSheets, Charts) │
│ TanStack Router · PrefsProvider (i18n/theme) │
└────────────────────┬────────────────────────┘
                     │ JSON /api/*
                     ▼
┌─────────────────────────────────────────────┐
│ @omg-dev server (Vite dev plugin)           │
│ Collections: goals, transactions, settings  │
└────────────────────┬────────────────────────┘
                     ▼
              SQLite (dev persistence)
```

### Rules

1. **Domain logic** lives in `src/lib/finance.ts` (calculations) and `schema.ts` (persistence shape).
2. **Do not** hand-edit vendored files in `src/components/ui/` (see `AGENTS.md`).
3. **Financial display** uses `money()` + `hidden` from `usePrefs()` — privacy must cover visible and assistive text.
4. **Seed demo** via `src/lib/seed.ts` — explicit user action, not silent fallback.
5. Optional **Phase B**: server recomputes safe-to-spend; client does not own authoritative ledger.

### Run locally

```bash
npm install
npm run dev    # http://localhost:5173
```

Pin `shadcn@4.23.0` before install if `package.json` was altered by audit.

---

## 4. Repository layout (actual)

```text
BUHack2/
├── README.md
├── PLAN.md
├── AGENTS.md
├── package.json
├── package-lock.json
├── schema.ts              # @omg-dev collection definitions
├── vite.config.ts
├── index.html
├── server/
│   └── db.ts              # Drizzle read client for dev
├── src/
│   ├── main.tsx
│   ├── App.tsx            # Main dashboard (single route)
│   ├── index.css
│   ├── routes/            # TanStack file routes (__root, index)
│   ├── components/
│   │   ├── Charts.tsx
│   │   ├── QuickSheets.tsx
│   │   └── ui/            # shadcn + vendored primitives
│   └── lib/
│       ├── finance.ts     # Types, summary, insights, cut-back
│       ├── i18n.ts
│       ├── prefs.tsx
│       ├── seed.ts
│       └── utils.ts
├── public/                # favicon, PWA icons
└── docs/                  # optional split later
```

---

## 5. UI specification (implemented vs target)

### 5.1 Implemented (M1+)

| Area | Implementation |
|------|----------------|
| Header | EN/繁, hide balances, dark mode, settings |
| Hero | Total saved, safe today/week, streak, left this month |
| Forecast | 30-day cash-flow bar, purchase “what-if” |
| Jars | Horizontal cards, progress, top-up, delete |
| Charts | Month flow, 6-month net savings, categories |
| Recent txs | List + delete |
| Insights | Invisible spend, subscriptions, cut-back slider |
| Actions | Bottom: log expense, top up, payday split |
| Sheets | Expense, top-up, payday, new jar, settings |

### 5.2 Mobile content order

Matches original intent: summary → jars → charts → recent → insights → fixed quick actions.

### 5.3 Bilingual copy

Maintained in `src/lib/i18n.ts` (`dict.en` / `dict.zh`). Extend both when adding strings.

### 5.4 Privacy

`PrefsProvider` `hidden` flag; all amounts via `money(n, hidden)`.

### 5.5 Target UI gaps

- Dedicated routes: Goals list, Activity, Import, Onboarding
- Explicit **“Demo data”** banner when using seed
- CSV import screen
- Export download

---

## 6. Data model

### 6.1 Implemented collections (`schema.ts`)

| Collection | Fields (summary) |
|------------|------------------|
| **goals** | `name`, `target`, `emoji`, `color` |
| **transactions** | `title`, `amount`, `kind` (`expense` \| `income` \| `saving`), `category`, `channel`, `date`, `goal_id`, `recurring`, `source` |
| **settings** | `monthly_income`, `rent`, `utilities`, `mpf`, `save_pct`, `round_to`, `roundup_on` |

**Saved amount per jar** = sum of `saving` transactions with matching `goal_id` (not a separate balance column).

**API paths:** `/api/goals`, `/api/transactions`, `/api/settings` (`useCollection` in `App.tsx`).

### 6.2 Target model (Phase B — multi-user ledger)

Users, accounts, double-entry transactions, goal_allocations, budget_periods, import_batches — see prior relational design if migrating to PostgreSQL. Map current three collections first, then add accounts/transfers.

### 6.3 Money (current vs target)

| | Current | Target (Phase B) |
|---|---------|------------------|
| Storage | HKD **whole dollars** (numbers) | **Minor units** (integer cents) |
| Types | `expense`, `income`, `saving` | + refund, transfer, card_repayment, allocation |
| Channel | Metadata (`octopus`, `fps`, …) | Does not imply transaction type |

---

## 7. Financial calculations

### 7.1 Implemented (`finance.ts`)

- **`summary()`** — monthly income, fixed (rent+utilities+mpf), savings target %, expenses, per-day and per-week “safe” remainder for the calendar month.
- **`spareChange()` / round-up** on expense sheet when `roundup_on` (virtual `saving` tx).
- **`savingsStreak()`**, **`categoryTotals()`**, **`monthlySeries()`**, **`invisibleSpend()`**, **`subscriptions()`**, **`cutBack()`**, **`cashFlowForecast()`** (in App forecast cards).
- **`goalSaved()`** — jar progress from transactions.

Label outputs as **estimates**, not guarantees.

### 7.2 Target safe-to-spend (Phase B)

Balance-based discretionary allowance over a user-defined planning period, minor units, explicit assumptions and missing-data warnings — port from `summary()` incrementally, with unit tests.

### 7.3 Round-up formula (target reference)

```text
roundUp = (increment - (amount % increment)) % increment
```

Current app uses `spareChange()` on decimal HKD; align with minor units when hardening.

---

## 8. API

### 8.1 Implemented (collections)

CRUD via `@omg-dev/sdk` `useCollection` — create, update, remove, list. No custom Express routes in repo.

### 8.2 Target envelopes (Phase B)

```json
{ "data": { }, "meta": { "timezone": "Asia/Hong_Kong", "isEstimate": true } }
```

```json
{ "error": { "code": "INVALID_AMOUNT", "message": "...", "fields": {} } }
```

### 8.3 Phase B REST sketch

Auth (`/api/auth/*`), `/api/dashboard`, paginated `/api/transactions`, `/api/goals/:id/allocations`, `/api/imports/*`, `/api/exports/*`. Session auth, ownership on every row, Zod validation, CSRF on mutations.

---

## 9. CSV import (target)

Canonical CSV template, Papa Parse preview, server revalidation, idempotent confirm — **not implemented** (`source: "csv"` reserved on transactions).

---

## 10. Development

### 10.1 Scripts (`package.json`)

| Script | Purpose |
|--------|---------|
| `npm run dev` | Dev server + platform API |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run preview` | Preview `dist/` |

### 10.2 Critical dependencies

- `shadcn`: **4.23.0** (provides `shadcn/tailwind.css`)
- Overrides: `minimatch` (^10.2.1) for audit hygiene — avoid `npm audit fix --force`

### 10.3 UI changes

Follow **`AGENTS.md`**: semantic Tailwind tokens only; use `src/components/ui/*`; new routes = new files under `src/routes/`.

---

## 11. Security and privacy (targets)

| Area | Current | Target |
|------|---------|--------|
| Auth | None (single-tenant dev) | Sessions + `@omg-dev/auth` or Phase B |
| Multi-user isolation | N/A | `user_id` on all rows |
| Export / delete | Clear all in settings | Export file + account deletion policy |
| HTTPS | Dev only | Production host |
| Secrets | None in client | Never in `VITE_*` |

Privacy mode implemented client-side; backend must not leak amounts in APIs when hidden.

---

## 12. External integrations (future)

HKMA reference rates, AI coach via `@omg-dev/ai`, bank Open API — **not MVP**. Manual entry + optional CSV first. Octopus auto-sync: unsupported until verified.

---

## 13. AI coach (future)

Read-only tools over app data (`getSpendingSummary`, `getGoalProgress`, `getSafeToSpend`, `simulateCutBack`); no transfers or unrestricted SQL. Optional after core MVP stable.

---

## 14. Milestones and progress

### M0 — Tooling ✅ Done

Vite+, React, TS, TanStack Router, Tailwind/shadcn, ESLint, `schema.ts`, dev server.

### M1 — Dashboard UX ✅ Mostly done

Single-page dashboard, sheets, charts, EN/繁, dark, hide amounts, demo seed, bottom actions.

**Gaps:** multi-route nav; demo banner; rename consistency PocketGoals vs Savings Jars.

### M2 — Financial logic 🟡 Partial

`finance.ts` powers UI; no Vitest suite; simplified monthly model (not full ledger).

**Next:** unit tests for `spareChange`, `summary`, `cutBack`; document assumptions in UI copy.

### M3 — Persistence 🟡 Partial (platform)

Collections persist in dev via omg/SQLite. No auth, no Postgres, no export.

**Next:** enable platform auth if available; JSON/CSV export; hosted deploy docs.

### M4 — Import & hardening ⬜ Not done

CSV UI, duplicate review, data export endpoint.

**Partial credit:** insights (subscriptions, invisible spend, cut-back) already in UI.

### M5–M6 — Integrations & production ⬜ Not done

HKMA, AI coach, a11y audit, threat model, monitoring.

### Phase B3 — Custom Express + PostgreSQL (optional)

Only if required: add `server/src` Express app, replace `useCollection` with typed `fetch` client, migrate schema, auth, ownership. Keep React UI; port `finance.ts` to `shared/` for server parity.

---

## 15. Testing (target)

| Layer | Status |
|-------|--------|
| `npm run lint` | Available |
| Vitest on `finance.ts` | Not set up |
| Playwright E2E | Not set up |
| Security / import tests | Phase B |

**E2E acceptance (demo):** seed → log expense → top-up jar → payday → toggle 繁 → hide amounts → clear all.

---

## 16. Contributor workflow

1. Read `README.md`, this `PLAN.md`, and `AGENTS.md` before UI work.
2. Pick a milestone gap (§14); one PR = one concern.
3. Update **both** `dict.en` and `dict.zh` for new copy.
4. Do not run `npm audit fix --force`.
5. PR notes: how to run `npm run dev`, what remains incomplete.

**Review focus:** transaction `kind` correctness, privacy + a11y, no dead buttons, `shadcn` version pinned.

---

## 17. Assistant brief

```text
Build PocketGoals HK / Savings Jars HK per PLAN.md.
Stack: React 19 + TypeScript + Vite+ + TanStack Router + shadcn/Tailwind + @omg-dev collections.
Data: schema.ts (goals, transactions, settings). Logic: src/lib/finance.ts.
Follow AGENTS.md for UI. Pin shadcn@4.23.0. No npm audit fix --force.
Virtual savings only — no real money movement.
Implement §14 gaps; state what is target vs done.
```

---

## 18. Roadmap

| Version | Status |
|---------|--------|
| **Current** | Jars, txs, budget summary, forecast, round-up, insights, bilingual, privacy |
| **v1.1** | CSV import, export, demo label, Vitest on finance |
| **v1.2** | Auth + multi-user (platform or Phase B) |
| **v2** | Streak polish, group challenges, HKMA widget, AI coach |
| **v3** | Bank integrations (conditional) |

---

## 19. Release direction

> **Reliable mobile-first savings jars app** with manual tracking, virtual allocations, transparent monthly budgeting, and HK-specific payment channels — persisted in dev via collections API, ready to harden with auth, export, and optional PostgreSQL backend.

Bank aggregation and real money movement remain **out of scope** until explicitly designed and approved.