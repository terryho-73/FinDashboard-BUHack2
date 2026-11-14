# PocketGoals HK — Implementation Plan

**Audience:** Contributors, reviewers, and coding agents building this repository.  
**Status:** Application code not scaffolded; this document is the authoritative build specification.  
**Companion:** [`README.md`](README.md) for onboarding summary; this file contains execution detail.

Treat every feature as **proposed until implemented**. Do not claim tests passed, APIs work, or integrations exist unless verified locally.

---

## 1. Product summary

### 1.1 Purpose

PocketGoals HK (香港青年儲蓄助手) is a bilingual, mobile-first savings dashboard for university students, fresh graduates, and young professionals in Hong Kong.

It answers:

1. How much have I set aside?
2. How much can I spend before my next income arrives?
3. What small changes would help me reach my goals sooner?

### 1.2 Audience

- University students and fresh graduates first.
- Income patterns: allowances, part-time, scholarships, salary (regular or irregular).
- Living situations: family, halls, rented—no fixed monthly payday required.

### 1.3 Product boundaries

| In scope | Out of scope (initially) |
|----------|---------------------------|
| Personal finance tracker | Bank or wallet holding customer funds |
| Budgeting and savings planner | Real money transfers (Octopus, FPS, banks) |
| Virtual goal allocations | Investment advice or trading |
| Optional AI explanations (post-MVP) | Auto-sync every HK financial account |

**Recording savings ≠ moving money.** MVP uses virtual buckets and simulated rules only.

### 1.4 Tone and UX principles

- Encouragement over guilt (e.g. 儲少少，都係進步).
- Touch targets ≥ 44×44 CSS px; keyboard navigation; accessible icon names.
- Do not rely on color alone for status; chart text summaries; `prefers-reduced-motion`.
- Loading, empty, error, success, validation (preserve form data on error).
- Mobile bottom nav must not cover content.

### 1.5 Defaults

- Currency: **HKD** (MVP totals reject unsupported currencies).
- Timezone: **Asia/Hong_Kong**.
- Locales: **English** + **Traditional Chinese** (`en-HK`, `zh-HK`).

---

## 2. Technology stack (mandatory)

| Layer | Technology | Notes |
|-------|------------|--------|
| Language | **TypeScript** | App code in `.ts` / `lang="ts"`; strict mode recommended |
| UI | Vue 3, Composition API, `<script setup>` | |
| Build | Vite | `vite.config.ts` when using TypeScript |
| Styling | Bootstrap 5.3 CSS + custom tokens | **No Bootstrap JS** in Vue-controlled widgets |
| Routing / state | Vue Router, Pinia | |
| i18n | Vue I18n | |
| Charts | Chart.js | Text summaries required |
| CSV | Papa Parse | Client preview; server revalidation |
| API client | Shared `apiRequest` helper | Credentials + CSRF header |
| Backend | Node.js, Express, ESM | |
| DB | PostgreSQL, `pg`, SQL migrations | Parameterized queries |
| Validation | Zod | Request bodies |
| Shared logic | `shared/*.ts` pure functions | Imported by client (bundled) and server |
| Tests | Vitest (unit), Playwright (e2e), Supertest (HTTP) | |

**Do not introduce** (unless explicitly approved): React, Next.js, Tailwind, microservices, vector DB, multi-agent AI frameworks.

### TypeScript conventions

- **Client:** Run `npm create vue@latest client` with **TypeScript: Yes**. Use `<script setup lang="ts">` in SFCs. Prefer typed Pinia stores and typed `apiRequest` responses.
- **Server:** Add `typescript`, `tsx` (or `ts-node` + ESM loader), and `@types/*` for Express. Entry points under `server/src/**/*.ts`; compile or run via `tsx` in development.
- **Shared:** Financial modules (`money`, `safeToSpend`, `roundUp`) are typed pure functions; export explicit types for minor-unit amounts (`type MoneyMinor = number` branded or documented).
- **Validation:** Define Zod schemas once; infer TypeScript types with `z.infer<typeof Schema>` for API DTOs.
- **Money types:** Use `number` minor units only after `Number.isSafeInteger` guards; avoid `any` in ledger and allocation code.
- **Locales:** JSON locale files stay `.json`; no need to type every UI string in the first milestone.

### Bootstrap + Vue

- Vue owns modal visibility, dropdowns, form submit.
- Bootstrap supplies layout/utilities CSS only.
- Optional later: BootstrapVueNext—not in MVP unless team agrees.

---

## 3. Architecture

```text
┌─────────────────────────────────────┐
│ Vue frontend                        │
│ Bootstrap CSS / Pinia / Router / I18n │
└──────────────────┬──────────────────┘
                   │ HTTPS / JSON
                   ▼
┌─────────────────────────────────────┐
│ Express API                         │
│ Auth · validation · rate limits     │
│ Financial services · imports · AI   │
└──────────┬─────────────────┬────────┘
           ▼                 ▼
    PostgreSQL         External adapters
                       (HKMA, AI provider)
```

### Rules

1. No SQL or business rules inside Vue SFCs beyond display formatting.
2. Financial formulas live in `shared/`; server recalculates for persisted data.
3. External APIs only through adapters (validate, cache, stale handling).
4. AI calls allowlisted application functions—never raw SQL or arbitrary URLs.
5. **Demo mode** and **account mode** are separate code paths; never silent fallback to demo on API failure.

### Development modes

| Mode | `VITE_DEMO_MODE` | Behavior |
|------|------------------|----------|
| Demo | `true` | `client/src/mocks/*`, visible “Demo data” label, no credentials |
| Account | `false` | Session cookies, PostgreSQL, ownership on every row |

---

## 4. Repository layout (target)

Create this structure at repo root (names may use `pocketgoals-hk/` as monorepo root = BUHack2 root).

```text
├── README.md
├── PLAN.md
├── .gitignore
├── docs/                          # Split when PLAN grows; optional at M1
│   ├── api-contract.md
│   ├── data-model.md
│   ├── financial-rules.md
│   ├── threat-model.md
│   └── ai-evaluation.md
├── client/
├── server/
├── shared/
└── tests/
    ├── unit/
    └── e2e/
```

### 4.1 Client (`client/`)

```text
client/
├── package.json
├── .env.example
├── vite.config.ts
├── tsconfig.json
├── tsconfig.app.json
├── index.html
└── src/
    ├── main.ts
    ├── App.vue
    ├── assets/styles/{tokens.css,main.css}
    ├── router/index.ts
    ├── layouts/{AppLayout,AuthLayout}.vue
    ├── views/
    │   DashboardView, GoalsView, GoalDetailView, TransactionsView,
    │   ImportView, BudgetView, InsightsView, CoachView, SettingsView,
    │   LoginView, OnboardingView
    ├── components/
    │   common/{MoneyValue,AppModal,EmptyState,ErrorNotice}.vue
    │   navigation/{AppHeader,SidebarNav,BottomNav}.vue
    │   dashboard/{SavingsSummary,SafeToSpendCard,CashFlowChart,CategoryChart}.vue
    │   goals/{GoalCard,GoalForm,AllocationForm}.vue
    │   transactions/{TransactionForm,TransactionList,ImportPreview}.vue
    ├── stores/{auth,preferences,goals,transactions}.ts
    ├── composables/{useMoney,usePrivacy}.ts
    ├── services/{api,goals.api,transactions.api,coach.api}.ts
    ├── types/                    # API DTOs, domain enums
    ├── locales/{en-HK.json,zh-HK.json}
    └── mocks/{seed.ts,repository.ts}
```

### 4.2 Server (`server/`)

```text
server/
├── package.json
├── .env.example
├── migrations/001_initial_schema.sql
├── tsconfig.json
├── scripts/{migrate.ts,seed.ts}
└── src/
    ├── app.ts, server.ts
    ├── config/env.ts
    ├── db/pool.ts
    ├── middleware/{authenticate,csrf,validate,errorHandler}.ts
    ├── modules/{auth,accounts,transactions,goals,budgets,imports,insights}/
    ├── integrations/{hkma.adapter,banking.adapter}.ts
    ├── ai/{provider,coach.service,tools,policies}.ts
    └── tests/ (or top-level server/tests)
```

**Per-module pattern** (combine controller+service in early milestones if needed):

```text
goals/
├── goals.routes.ts
├── goals.controller.ts
├── goals.service.ts
├── goals.repository.ts
└── goals.schema.ts
```

### 4.3 Shared (`shared/`)

| File | Responsibility |
|------|----------------|
| `money.ts` | minor units parse/format, safe integer checks |
| `safeToSpend.ts` | discretionary balance + daily allowance |
| `roundUp.ts` | virtual round-up suggestion |
| `schemas.ts` | Shared Zod schemas and inferred types |

---

## 5. UI specification

### 5.1 Desktop dashboard (wireframe)

```text
┌────────────────────────────────────────────────────────────────┐
│ PocketGoals HK             EN / 繁    Theme    Hide $    Profile │
├────────────┬───────────────────────────────────────────────────┤
│ Dashboard  │ Set Aside │ Safe-to-Spend │ data freshness          │
│ Goals      │ Goal cards + progress bars                         │
│ Activity   │ Cash-flow chart │ Category chart                     │
│ Budget     │ Quick actions │ Recent transactions                │
│ Insights   │                                                   │
│ Settings   │                                                   │
└────────────┴───────────────────────────────────────────────────┘
```

### 5.2 Mobile order

1. Compact header  
2. Set-aside + safe-to-spend  
3. Freshness / missing-data warning  
4. Horizontal goal cards  
5. Quick actions  
6. Spending chart  
7. Recent transactions  
8. Bottom nav: `Home | Goals | + Add | Activity | More`

### 5.3 Bilingual labels (minimum set)

| English | Traditional Chinese |
|---------|---------------------|
| Saving Goals | 儲蓄目標 |
| Set Aside | 已預留儲蓄 |
| Estimated Safe-to-Spend | 預計可用金額 |
| Log Expense | 記低開支 |
| Allocate to Goal | 為目標預留金額 |
| Hide Amounts | 隱藏金額 |
| Small steps still count | 儲少少，都係進步 |

### 5.4 Privacy mode

- Central `MoneyValue.vue` + `usePrivacy` composable.
- Hide amounts in cards, lists, charts, tooltips, **and accessible names** (no blur-only).

---

## 6. Data model

### 6.1 MVP entities

| Table | Key fields |
|-------|------------|
| `users` | `id`, `email`, `password_hash`, `locale`, `timezone`, `created_at` |
| `accounts` | `user_id`, `name`, `type`, `currency`, `opening_balance_minor`, `balance_as_of` |
| `transactions` | `user_id`, `type`, `amount_minor`, `currency`, `occurred_at`, `category_id`, `description`, `payment_method` |
| `transaction_entries` | `transaction_id`, `account_id`, `signed_amount_minor` (double-entry) |
| `goals` | `user_id`, `name`, `target_minor`, `target_date`, `status` |
| `goal_allocations` | `goal_id`, `account_id`, `amount_minor`, `direction`, `created_at` |
| `budget_periods` | `user_id`, `start_date`, `end_date`, `savings_target_minor` |
| `obligations` | `user_id`, `amount_minor`, `due_date`, `status`, `kind` |
| `import_batches` | `user_id`, `source`, `status`, `created_at` |
| `import_rows` | `batch_id`, `normalized_data`, `validation_errors`, `fingerprint` |

### 6.2 Post-MVP entities (design only until needed)

`saving_rules`, `subscription_candidates`, `group_challenges`, `challenge_members`, `ai_suggestions`, `consent_records`, `audit_events`, `rate_snapshots`.

### 6.3 Money rules

- Store **integer minor units** (HK$38.50 → `3850`).
- Validate `Number.isSafeInteger` on inputs.
- Currency explicit on every row; reject mixed-currency MVP totals.

### 6.4 Transaction semantics

| Type | Meaning |
|------|---------|
| `income` | Money in (take-home if user enters net—do not double-subtract deductions) |
| `expense` | Spending |
| `refund` | Reverses spending effect |
| `transfer` | Between **owned** tracked accounts (e.g. bank → Octopus top-up) |
| `card_repayment` | Paying card bill—not a second expense |
| `goal_allocation` | Virtual bucket move—not income, not bank transfer |

**Payment method does not determine type** (Octopus, FPS, bank_transfer are metadata).

### 6.5 Goal allocations

- Cannot exceed account unallocated eligible balance.
- Use DB transaction + row locks to prevent concurrent double allocation.

---

## 7. Financial calculations

### 7.1 Safe-to-spend (MVP)

```text
discretionary
  = eligible_liquid_balance
    − protected_goal_allocations
    − unpaid_obligations (planning period)
    − savings_still_to_reserve
    − safety_buffer

daily_allowance = max(0, discretionary) ÷ remaining_calendar_days_in_period
```

- Round displayed daily allowance **down** to nearest cent.
- Show assumptions, stale/missing account warnings, shortfall if negative underlying.
- Do not subtract expenses already in balances; do not count future salary; not credit limits.
- Irregular income: user-chosen planning period end.
- Label as estimate, not guarantee.

### 7.2 Round-up (virtual)

```text
roundUp = (increment - (amount % increment)) % increment
```

Default increment HK$10 → minor `1000`. Implement in `shared/roundUp.ts` with unit tests (HK$38 → 200 minor, HK$40 → 0).

### 7.3 Cut-back simulator (Milestone 4 / v2)

Deterministic: state time assumptions; use `simulateCutBack` service; never label 4-week total as “exact month”.

---

## 8. REST API

Base path: `/api`. Session auth; derive `user_id` from session only.

### 8.1 Auth and profile

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/auth/register` | Register |
| POST | `/auth/login` | Session start |
| POST | `/auth/logout` | Session end |
| GET | `/me` | Current user |
| PATCH | `/me/preferences` | Locale, theme, privacy defaults |

### 8.2 Core finance

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/dashboard` | Aggregated dashboard |
| GET/POST | `/accounts` | List / create |
| GET/POST/PATCH/DELETE | `/transactions` | CRUD + filters + pagination |
| GET/POST/PATCH | `/goals` | Goals CRUD |
| POST | `/goals/:id/allocations` | Allocate or release |
| GET | `/budget/safe-to-spend` | Current allowance + meta |
| POST | `/imports/preview` | Validate upload |
| POST | `/imports/:id/confirm` | Idempotent commit |
| GET | `/exports/transactions` | Export user data |

### 8.3 Optional (Milestone 5+)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/reference/exchange-rates` | HKMA adapter |
| GET | `/reference/deposit-rates` | Curated products |
| GET | `/insights/subscriptions` | Recurring candidates |
| POST | `/simulations/cut-back` | Scenario |
| POST | `/coach/messages` | AI coach |
| POST | `/coach/suggestions/:id/confirm` | Confirmed draft write |

### 8.4 Response envelopes

Success:

```json
{
  "data": { },
  "meta": {
    "timezone": "Asia/Hong_Kong",
    "isEstimate": true,
    "dataStatus": "complete"
  }
}
```

Error:

```json
{
  "error": {
    "code": "INVALID_AMOUNT",
    "message": "Amount must be greater than zero.",
    "fields": { "amountMinor": "Enter a positive amount." }
  }
}
```

### 8.5 API requirements

- Ownership check on every `account_id`, `goal_id`, `transaction_id`.
- Zod validate all bodies; stable `error.code` for i18n.
- Paginate transaction lists.
- Idempotency keys: imports confirm, goal allocations.
- CSRF token on session mutations (header `X-CSRF-Token`).

---

## 9. CSV import

### 9.1 Canonical template

```csv
date,description,type,amount,currency,account,payment_method,category
2026-10-01,Lunch,expense,38.00,HKD,Octopus,octopus,Food
2026-10-02,Part-time salary,income,2000.00,HKD,Bank,bank_transfer,Income
```

### 9.2 Pipeline

```text
Select file → source/account → column map → parse → preview
→ flag invalid/duplicate → user confirm → server validate → commit batch
```

### 9.3 Requirements

- User must resolve ambiguous dates before import.
- Decimal amounts → minor units without float error.
- File size + row limits; UTF-8 / encoding errors surfaced.
- Duplicates: heuristic only; allow legitimate repeats.
- Idempotent confirm; do not retain raw files longer than needed.
- Neutralize spreadsheet formula injection on export.

---

## 10. Frontend integration

### 10.1 `client/src/services/api.ts`

- `API_BASE = import.meta.env.VITE_API_BASE_URL || '/api'`
- `credentials: 'include'`
- Parse JSON errors; attach `status`, `code` on thrown Error.

### 10.2 Environment

```env
# client/.env.example
VITE_API_BASE_URL=/api
VITE_DEMO_MODE=true
```

```env
# server/.env.example
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/pocketgoals
SESSION_SECRET=
AI_ENABLED=false
AI_API_KEY=
AI_MODEL=
```

Never put secrets in `VITE_*`.

### 10.3 `main.ts` bootstrap

- Pinia, Router, I18n before mount.
- Import Bootstrap CSS + icons + `main.css`.
- Do not import `bootstrap/dist/js/bootstrap.bundle`.

---

## 11. Security and privacy

| Area | Requirement |
|------|-------------|
| Auth | Hashed passwords, secure session cookies, session expiry |
| CSRF | State-changing routes |
| Rate limit | Login, recovery, AI |
| SQL | Parameterized only |
| Logging | No transaction descriptions, passwords, or full AI prompts with PII |
| HTTPS | Production |
| Demo data | Separate from production DB |
| Deletion | Export + account deletion workflow in MVP |

Group challenges (v2): never send private balances to client for CSS hiding.

---

## 12. External integrations

| Integration | MVP | Approach |
|-------------|-----|----------|
| HKMA public rates | Optional M5 | `hkma.adapter.ts`, cache, stale flag, tests |
| AI provider | Optional M5 | Server-only adapter |
| Bank Open API | Not MVP | Document as unsupported until onboarded |
| Octopus auto-sync | Unverified | Manual + CSV only; label unsupported |
| FPS initiation | No | Not MVP |

HKMA example endpoint (validate schema before production):

`https://api.hkma.gov.hk/public/market-data-and-statistics/monthly-statistical-bulletin/er-ir/er-eeri-daily`

---

## 13. AI coach (post-MVP core)

**Not required for budgeting MVP.**

### Levels

1. **Structured assist:** category suggest, NL → draft expense, explain summaries (user confirms).
2. **Read-only agent:** tools `getSpendingSummary`, `getGoalProgress`, `getSafeToSpend`, `simulateCutBack`.
3. **Draft writes:** user confirms before commit.

### Prohibited

Transfers, unrestricted SQL, other users’ data, arbitrary fetch, auto-delete, model-side arithmetic authority.

### Architecture

```text
Message → auth + consent → tool allowlist → validate args
→ deterministic service → model explains → UI shows assumptions
```

One model + small toolset—no multi-agent framework by default.

---

## 14. Implementation milestones

Work in order. Each milestone ends with **runnable verification steps** and a short “remaining gaps” note.

### Milestone 0 — Tooling (0.5 day)

**Scope:** Monorepo folders, root scripts optional, env examples, shared package import path in Vite.

| Task | Deliverable |
|------|-------------|
| `npm create vue@latest client` | **TypeScript: Yes**, Router, Pinia, Vitest, Playwright, ESLint |
| Bootstrap + vue-i18n + chart.js + papaparse | `package.json` deps |
| `server/` TypeScript + Express | `app.ts` health route; `tsx` dev script |
| `shared/` + Vite alias | Import `money.ts` from client |
| `.env.example` files | Both packages |

**Verify:** `client` dev server loads; `GET /api/health` returns OK.

---

### Milestone 1 — Interface prototype (demo mode)

**Scope:** Full navigation shell, dashboard layout, mock data, i18n, theme, privacy toggle. No real backend.

| Area | Files / work |
|------|----------------|
| Layouts | `AppLayout`, `AuthLayout`, responsive sidebar vs bottom nav |
| Views | `DashboardView`, `GoalsView`, `TransactionsView`, `SettingsView`, stub others |
| Dashboard components | `SavingsSummary`, `SafeToSpendCard`, `GoalCard`, charts with static/mock series |
| Forms | `GoalForm`, `TransactionForm` → update Pinia mock store |
| Mocks | `mocks/seed.ts`, `mocks/repository.ts`; banner “Demo data” |
| Preferences | `preferences` store: locale, theme, hide amounts |
| Router | Auth guards stubbed for demo |

**Acceptance:**

- [ ] Mobile + desktop layouts match section 5 wireframe intent  
- [ ] EN/繁 switch updates copy  
- [ ] Privacy hides all monetary UI including a11y text  
- [ ] No button without behavior on touched screens  
- [ ] `VITE_DEMO_MODE=true` only path (no silent mock on failed fetch later)

---

### Milestone 2 — Financial logic

**Scope:** `shared/` implementations + Vitest; client uses shared for display; no DB yet.

| File | Tests |
|------|-------|
| `money.ts` | parse/format HKD, reject unsafe integers |
| `roundUp.ts` | §7.2 cases |
| `safeToSpend.ts` | buffers, obligations, edge cases §16 |
| Mock ledger service | Classify transfers vs expenses in memory |

**Acceptance:**

- [ ] All financial unit tests in §16.1 passing  
- [ ] Dashboard numbers computed from mock ledger via shared functions

---

### Milestone 3 — Persistence and auth

**Scope:** PostgreSQL schema, migrations, session auth, CRUD APIs, ownership.

| Task | Detail |
|------|--------|
| `001_initial_schema.sql` | Tables §6.1 |
| Auth module | register/login/logout, bcrypt, session store |
| CSRF | Token endpoint + middleware |
| Modules | accounts, transactions, goals, allocations, budget safe-to-spend |
| Client | Wire services to API; `VITE_DEMO_MODE=false` path |
| Export/delete | `/exports/transactions`, account deletion policy |

**Acceptance:**

- [ ] E2E flow §16 (without import) on account mode  
- [ ] Security tests §16.3 for ownership and forged `userId`  
- [ ] API errors use stable codes

---

### Milestone 4 — Import and insights

**Scope:** CSV UI + server preview/confirm; spending summaries; subscription candidates (basic); cut-back API.

| Task | Detail |
|------|--------|
| `ImportView` + `ImportPreview` | Papa Parse + column mapper |
| `imports` module | preview, fingerprint duplicates, idempotent confirm |
| Insights | Category totals, recurring heuristics |
| `POST /simulations/cut-back` | Deterministic |

**Acceptance:**

- [ ] Import tests §16.2  
- [ ] Chinese descriptions and ambiguous dates handled

---

### Milestone 5 — Optional integrations

**Scope:** HKMA adapter, read-only coach, AI disabled path, evaluation tests §13.

**Acceptance:**

- [ ] AI off → clear unavailable UI  
- [ ] Coach never executes non-allowlisted tools  
- [ ] HKMA failure → stale/cached/meta handling

---

### Milestone 6 — Production preparation

Accessibility audit, threat model review, backup/restore, monitoring hooks, deployment doc in `docs/`.

**MVP definition of done (§16):**

- Core flows mobile + desktop  
- Financial tests automated  
- Demo requires no credentials  
- Real mode never silent-fallback to mocks  
- No secrets in frontend bundle  
- Unsupported integrations labeled  

---

## 15. Testing matrix

### 15.1 Financial (unit)

HK$38 round-up; HK$40 zero; negatives rejected; transfers ≠ income; card repayment ≠ duplicate expense; allocations don’t create money; no double reserve; empty period; missing balance warning; refunds; HK date boundaries.

### 15.2 Import (integration)

Invalid/ambiguous dates; repeat upload; duplicate vs legitimate twin rows; Chinese text; oversized file; unsupported currency; formula injection in export fields.

### 15.3 Security (integration)

Cross-user goals/transactions; forged body `userId`; expired session; AI tool allowlist; AI confirm ownership.

### 15.4 E2E (Playwright)

Full flow: register → onboard → account → goal → expense → allocate → safe-to-spend assumptions → CSV import → 繁 → hide amounts → export.

---

## 16. npm scripts (target)

| Package | Script | Behavior |
|---------|--------|----------|
| client | `dev` | Vite |
| client | `build` | Production build |
| client | `test:unit` | Vitest |
| server | `dev` | Watch mode |
| server | `start` | Production |
| server | `db:migrate` | Run migrations |
| server | `db:seed` | Dev fictional data |
| server | `test` | Vitest + Supertest |

---

## 17. Contributor workflow

1. Read `README.md` then the milestone section here you are implementing.
2. Pick a milestone or sub-task; avoid starting bank aggregation before M5.
3. Branch naming: `feat/m2-safe-to-spend`, `fix/import-date-parser`, etc.
4. PR must state: milestone, files touched, how to run tests, **known incomplete** items.
5. Update `PLAN.md` checklist only when milestone acceptance items are truly done.
6. User-facing strings: update both `en-HK.json` and `zh-HK.json`.
7. Do not commit `.env` or secrets; use `.env.example` deltas.

### Code review focus

- Money as integers end-to-end  
- Transaction type correctness  
- Ownership on new routes  
- Demo vs real mode separation  
- Bootstrap JS not imported  
- Accessible privacy mode  

---

## 18. Agent / assistant brief (copy with PLAN)

Use when prompting a coding assistant:

```text
Build PocketGoals HK per PLAN.md in the repo root.
Vue 3 + TypeScript + Bootstrap CSS + Express + PostgreSQL.
MVP: virtual savings buckets only—no real transfers.
Implement current milestone only; list files; add tests; state gaps.
Follow shared/ financial rules and API envelopes exactly.
Demo mode labeled; no silent mock fallback on API errors.
```

---

## 19. Feature roadmap (post-MVP)

| Version | Features |
|---------|----------|
| v2 | Subscriptions, cut-back UI, streaks, group challenges, FX widget, deposit comparison, read-only coach |
| v3 | Approved bank/statement integrations, receipt extraction, consent notifications, confirmed AI drafts |

**Excluded until explicitly designed:** autonomous trading, auto subscription cancel, guaranteed returns.

---

## 20. First release direction

> Reliable Vue savings dashboard with manual/CSV tracking, virtual goal buckets, and transparent safe-to-spend calculations.

Optional later:

> Read-only AI coach that explains application-computed data and proposes edits for user confirmation.

Bank aggregation and real money movement remain **conditional** integrations, not MVP dependencies.
