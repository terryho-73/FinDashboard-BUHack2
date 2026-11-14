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

---

## 20. Five-person team split (suggested ownership)

Use this as the default work breakdown for BUHack2. One person = **one primary stream**; everyone reviews PRs that touch `schema.ts`, `finance.ts`, or `vite.config.ts`.

**Integration rule:** merge to `main` only when `npm run dev`, `npm run build`, and `npm run lint` pass. Do not run `npm audit fix --force`.

| Person | Role | Primary folders / files | Deliverables (MVP) | Depends on |
|--------|------|---------------------------|--------------------|------------|
| **P1 — Platform & data** | Backend / persistence | `schema.ts`, `vite.config.ts`, `package.json`, `server/local-*.ts`, `src/db.generated.ts`, `functions/` | ✅ Dev persistence via `server/vite-local-api-plugin` + `.data/pocketgoals.sqlite`; README `/api/*`; `GET /api/export` backup; deploy notes (static build + Phase B for prod API) | — |
| **P2 — Dashboard & navigation** | Core UI shell | `src/App.tsx`, `src/components/Charts.tsx`, `src/routes/*`, `index.html`, `public/icons/*` | Multi-section polish; optional TanStack routes (Activity, Goals list); demo-data banner; loading/empty/error states; piggy icon/branding consistency | P1 for live collections |
| **P3 — Forms & money entry** | Input flows | `src/components/QuickSheets.tsx`, `src/components/ui/sheet.tsx`, related `ui/*` | Expense / top-up / payday / new jar / settings flows; validation & busy states; round-up UX; delete confirmations; no dead buttons | P1, P4 for field rules |
| **P4 — Finance & insights** | Domain logic | `src/lib/finance.ts`, `src/lib/seed.ts` | Correct `summary`, forecast, cut-back, streak; Vitest on key functions; UI copy for assumptions (estimate, not guarantee); category/channel enums aligned with `schema.ts` | P1 schema enums |
| **P5 — Language, quality & release** | i18n, a11y, QA | `src/lib/i18n.ts`, `src/lib/prefs.tsx`, `README.md`, `PLAN.md` (checklists), ESLint/Playwright setup | Full EN + 繁 for new strings; privacy mode on charts/tooltips/a11y labels; smoke E2E script for demo flow; final README + submission/demo script | P2–P4 UI stable |

### Suggested week order (parallel)

```text
Week 1
  P1: persistence works on every dev machine (priority)
  P2 + P3: polish existing dashboard and sheets
  P4: tests + finance edge cases
  P5: i18n gaps + README accuracy

Week 2 (before judging)
  P1: export + auth spike OR Phase B decision doc
  P2: optional CSV/import route shell (UI only) if P3 not doing import
  P3: CSV import MVP (Papa Parse) OR hand off to P1 if server validation needed
  P4: tie insights numbers to tested helpers
  P5: E2E demo path + presentation deck / video
```

### Clear “not duplicate” boundaries

| Topic | Owner | Others |
|-------|--------|--------|
| Change `schema.ts` fields | **P1** proposes; team agrees in chat | P3/P4 update types & forms after merge |
| Change safe-to-spend formula | **P4** | P2 displays; P5 documents in UI strings |
| New bottom sheets / forms | **P3** | Follow `AGENTS.md` |
| New routes / layout | **P2** | — |
| Copy EN/繁 | **P5** writes or reviews | P2/P3 add keys only with both locales |
| `package.json` / shadcn pin | **P1** only | Everyone else files issues, no ad-hoc bumps |

### Per-person definition of done

- **P1:** Fresh clone → `npm install` → `npm run dev` → create jar → refresh → data still present in `.data/pocketgoals.sqlite`; README backend section updated; Settings → JSON export works.
- **P2:** Mobile + desktop usable; bottom nav does not cover content; demo banner if using seed.
- **P3:** Every primary button in sheets submits or shows validation error; round-up path tested manually.
- **P4:** `npm run test` (once added) passes for `finance.ts`; forecast/summary match manual spreadsheet spot-check.
- **P5:** Demo checklist in README runs in &lt;5 min; hide amounts + 繁 in demo; no missing `dict` keys in console.

### Optional sixth backlog (pick any owner)

- CSV import (P3 + P1)
- JSON export in Settings (P1 + P3)
- Express + PostgreSQL Phase B (P1 leads, freeze scope early)

Rename roles in your team chat (e.g. 志恒 = P4) but keep **one owner per row** to avoid merge conflicts.

---

## 21. Implementation progress (per person)

**Legend:** `[x]` done in repo · `[ ]` not started or incomplete · `[-]` in progress (owner marks when started)

**Last reviewed:** 2026-11-14 · **Overall demo:** ~65% (local save/load works on `npm run dev`)

Update checkboxes in PRs that belong to that owner. Do not tick another person’s items without their review.

### P1 — Platform & data

- [x] `schema.ts` — goals, transactions, settings collections defined
- [x] Node dev backend — `server/local-db.ts`, `server/local-api.ts`, `server/vite-local-api-plugin.ts`
- [x] `vite.config.ts` — `localApiPlugin()` when `NODE_RUNTIME=node`
- [x] SQLite path `.data/pocketgoals.sqlite` (gitignored)
- [x] REST: `GET/POST/PATCH/DELETE` on `/api/goals`, `/api/transactions`, `/api/settings`
- [x] `GET /api/export` JSON backup
- [x] Minimal `__vibes_sub` WebSocket + `__vibes_events` keepalive for SDK
- [x] README backend + architecture updated
- [x] `package.json` deps: `node:sqlite` (built-in), `ws`
- [ ] `@omg-dev/auth` / multi-user (optional MVP)
- [ ] Phase B Express + PostgreSQL decision or spike doc
- [ ] Production API strategy (static `dist/` + separate host)

**P1 sign-off check:** `npm install` → `npm run dev` → see `[pocketgoals]` log → create jar → refresh → jar persists.

---

### P2 — Dashboard & navigation

- [x] Main dashboard in `src/App.tsx` (hero, forecast, jars, charts, insights)
- [x] TanStack Router shell — `src/routes/__root.tsx`, `src/routes/index.tsx` → `/`
- [x] Header controls (lang, privacy, theme, settings)
- [x] Fixed bottom action bar (expense, top-up, payday)
- [x] `src/components/Charts.tsx` — rings, bars, line
- [x] App title + favicons (`index.html`, `public/*`, piggy source)
- [x] Demo-data banner when `source: "demo"` rows present
- [x] Explicit loading / error UI when `useCollection` returns `error` (not only “Loading…”)
- [x] Optional routes: `/activity`, `/goals`, `/import` (file-based routes)
- [x] Bottom nav safe-area / overlap QA on small phones

**P2 sign-off check:** Scroll full page on mobile width; jars swipe; no content hidden behind bottom bar.

---

### P3 — Forms & money entry

- [x] `QuickSheets.tsx` — expense, top-up, payday, new jar, settings
- [x] Validation (disabled submit until amount/title rules met)
- [x] Round-up chips when settings allow
- [x] Delete confirmations for jar / transaction
- [x] Settings → JSON export button (opens `/api/export`)
- [x] Clear all data flow
- [ ] User-visible error toast/message when `POST /api/*` fails (network down)
- [ ] CSV import sheet + file picker (schema `source: "csv"`)
- [ ] Busy state blocks double-submit on all sheets (audit payday/top-up)
- [ ] Manual QA script: one path each for expense, top-up, payday, new jar

**P3 sign-off check:** With backend up, every bottom-bar and sheet primary button completes or shows validation.

---

### P4 — Finance & insights

- [x] `src/lib/finance.ts` — summary, safe-to-spend, forecast, streak, insights, cut-back
- [x] `src/lib/seed.ts` — demo dataset (parallel writes; needs stable API)
- [x] Types/enums aligned with `schema.ts` (categories, channels, jar colors)
- [x] UI wiring in `App.tsx` for forecast “what if purchase”, invisible spend, subscriptions
- [ ] Vitest (`npm run test`) for `summary`, `cashFlowForecast`, `cutBack`, `savingsStreak`
- [ ] Spreadsheet spot-check doc or test vectors (sample month of txs)
- [ ] Footnote copy reviewed (“estimate, not guarantee”) EN + 繁
- [ ] Minor-unit / decimal policy documented if rubric requires it

**P4 sign-off check:** Numbers on dashboard match hand calculation for one fixed fixture (in test or doc).

---

### P5 — Language, quality & release

- [x] `src/lib/i18n.ts` — EN + 繁 for core UI and sheets
- [x] `src/lib/prefs.tsx` — lang, dark, hide amounts (localStorage)
- [x] `exportBackup` string (EN + 繁)
- [x] `README.md` — run, features, backend, repo tree, gaps
- [x] `PLAN.md` — team split + this progress section
- [ ] ESLint clean run documented (`npm run lint`) in README/PR template
- [ ] Playwright (or similar) smoke: load → demo → log expense → refresh
- [ ] &lt;5 min demo checklist for judges (step list in README)
- [ ] a11y pass: sheet labels, `aria-label` on icon buttons, charts with privacy mode
- [ ] Submission assets (deck / video / poster) — outside repo

**P5 sign-off check:** Switch 繁 + hide amounts during demo; no missing i18n keys in console.

---

### Cross-team integration (everyone)

- [x] Single command `npm run dev` serves UI + API
- [x] `npm run build` succeeds
- [ ] `npm run lint` passes with zero new errors (run before merge)
- [ ] No `npm audit fix --force`
- [ ] Team agrees who owns next: CSV import vs Phase B vs auth

### Quick status snapshot

| Person | Progress (approx.) | Blocker / next step |
|--------|-------------------|---------------------|
| **P1** | **~90%** | Auth/production optional |
| **P2** | **~95%** | Polish only (CSV route shell until P3) |
| **P3** | **~75%** | API error UX, CSV |
| **P4** | **~60%** | Vitest + fixture checks |
| **P5** | **~65%** | E2E smoke + demo script |