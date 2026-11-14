# Savings Jars HK / PocketGoals HK — 香港青年儲蓄助手

Bilingual, mobile-first **savings jar** dashboard for Hong Kong students and young professionals.  
**Spec & roadmap:** [`PLAN.md`](PLAN.md) · **UI rules:** [`AGENTS.md`](AGENTS.md)

## Demo video

[![Watch the 3-minute demo](docs/demo/thumbnail.jpg)](docs/demo/savings-jars-demo.mp4)

▶️ **[Watch the 3-minute demo](docs/demo/savings-jars-demo.mp4)**: onboarding, safe-to-spend, the cash-flow forecast, savings jars, AI Quick log, goal cost, weekly challenges, insights, and privacy, language and dark mode.

The video is generated with [Remotion](https://www.remotion.dev/) from a scripted recording of the real app. See [`demo-video/`](demo-video/README.md) to re-record or re-render it.

**Repository status:** Specification and agent guidance live here; application code (`client/`, `server/`, `shared/`, `tests/`) is **not yet scaffolded**.

---

## Key features (what the app does today)

| Area | What you get |
|------|----------------|
| **Saving jars** | Named goals (emoji, target HK$), progress rings, top-up, delete |
| **Transactions** | Log **expense**, **income** (payday), **saving** (jar allocations) |
| **Safe to spend** | Estimated **per day** and **per week** from income, rent/MPF, savings %, and this month’s spending |
| **Cash-flow forecast** | 30-day balance chart, low-balance warning, “what if I buy X?” |
| **Charts** | Month income vs expenses vs saved; 6-month net savings; spending by category |
| **Insights** | “Invisible” small repeat spends, subscription-style recurring charges, cut-back simulator |
| **Round-up** | Optional virtual spare change into a jar when logging expenses (HK$10 / HK$50) |
| **Payday split** | Log salary and auto-split a % across all jars |
| **Privacy** | Hide all HK$ amounts (header eye icon) |
| **Language** | English ↔ 繁體 (header toggle) |
| **Theme** | Light / dark mode |
| **Demo data** | One-tap sample jars and transactions when the app is empty |

**HK payment channels** on expenses: Octopus, FPS, PayMe, Alipay HK, credit, cash, bank, other.

---

## How to use the app

### Run locally

```bash
cd "/path/to/BUHack2"
npm install          # requires shadcn@4.23.0 in package.json
npm run dev
```

Open **http://localhost:5173** (or the Network URL shown in the terminal on your phone).

| Layer | Choice |
|-------|--------|
| Frontend | React, **TypeScript**, Vite Plus, TanStack Router, Tailwind CSS v4, shadcn/ui, Lucide React |
| Backend | Vite Plus with `@omg-dev/vite-plugin` and `@omg-dev/server`, local SQLite database |
| Data access | `@omg-dev/sdk` collections, Drizzle ORM, Better Drizzle |
| Shared | Typed pure finance and preference modules in `src/lib/` |
| Validation | ESLint and Vite Plus production build |
| Defaults | HKD, `Asia/Hong_Kong`, English + Traditional Chinese |

Use the Vibes development plugin for local API routes, database access, and realtime collection updates. The current prototype runs in credential-free Demo mode with fictional local data.

1. If the screen is empty, tap **Load demo data** (seeds jars, settings, and sample transactions).
2. Or open **Settings** (gear) and enter monthly income, rent, utilities, MPF, and savings %.

### Header

| Control | Action |
|---------|--------|
| **EN / 中** | Switch language |
| **Eye** | Hide or show all money amounts |
| **Sun / Moon** | Dark mode |
| **Gear** | Budget settings, round-up, **Clear all data** |

### Bottom bar (main actions)

- Mobile-first dashboard with savings summary and **safe-to-spend** estimate
- Virtual saving jars with targets, progress, top-ups, and deletion
- Expense logging with categories, payment channels, recurring charges, and round-up savings
- Payday income logging with automatic savings split across jars
- Cash-flow forecast with planned-purchase impact preview
- Spending charts, recent activity, subscription detection, and cut-back insights
- Budget settings for income, rent, utilities, MPF, savings percentage, and round-up amount
- Privacy toggle for hiding balances, bilingual English/Traditional Chinese UI, and light/dark theme
- Demo seed data with local SQLite persistence and realtime collection updates

### Dashboard (scroll)

- **Total saved** and safe-to-spend today / this week  
- **Savings streak** (weeks with at least one save)  
- **Forecast** card and purchase simulator  
- **Jar cards** — swipe horizontally; **+ New jar**  
- **Charts** and **recent activity** (delete rows with trash icon)  
- **Insights** — habits, subscriptions, cut-back slider  
```text
React (Tailwind / TanStack Router) ──SDK collections──► Vite Plus + Vibes API ──► SQLite
                                                        └──► Local realtime updates
```

### Typical flow

1. No database logic in React components; use SDK collections and the Vibes API.
2. Financial formulas live in **typed pure modules** under `src/lib/`; keep display logic separate from data access.
3. The current prototype runs in **Demo mode** with local SQLite persistence and no credentials. Account mode is not implemented yet.
4. AI (when added) uses an allowlisted tool set only—no unrestricted SQL or transfers.

---

## Is the backend working?

**Short answer (local dev):** **Yes.** `npm run dev` mounts a **Node + SQLite** collection API that matches what `useCollection` expects. Data lives in **`.data/pocketgoals.sqlite`** (gitignored).

| Layer | Status | Notes |
|-------|--------|--------|
| **Local dev API** | **Active** | `server/vite-local-api-plugin.ts` when `NODE_RUNTIME=node` |
| **REST** | **Active in dev** | `GET/POST /api/goals`, `/api/transactions`, `/api/settings` (+ `GET /api/export` JSON backup) |
| **Realtime** | **Minimal in dev** | WebSocket ` /__vibes_sub` sends snapshots; SSE keepalive at `/__vibes_events` |
| **Custom Express + PostgreSQL** | **Not implemented** | Optional “Phase B” in `PLAN.md` |
| **Full `@omg-dev/vite-plugin`** | **Optional** | Used when **not** on Node runtime (e.g. hosted Vibes/Bun builds) |

**Smoke test:** Add a jar → refresh the page → the jar is still there. In DevTools Network, `POST /api/goals` should return **200** and JSON with an `id`.

**Export:** Settings → **Download JSON backup** (or open `/api/export`).
### Local SQLite testing

The Vite plugin already provides a local SQLite database for development. Run
the SQLite-backed mode with Bun:

```bash
bun run dev:sqlite
```

By default, the database is stored at `.vibes/data.db` and uses local auth.
Override the path with `VIBES_DB`, for example:

```bash
VIBES_DB=.vibes/test.db bun run dev:sqlite
```

`bun run dev` runs Vite under Bun with the vibes plugin (local auth). Without
Bun, use `npm run dev:sqlite`: the vibes plugin is Bun-only, so under Node the
local SQLite plugin serves `/api/*` instead.

### Demo walkthrough

1. Open `/` on an empty database — you are redirected to `/onboarding`.
2. **Try demo** seeds four jars, six months of paydays and a month of
   spending, then opens the dashboard with a **Demo data** badge in the header.
   (Or **Set up budget** to start from your own numbers; saving lands you on
   the dashboard.)
3. On the dashboard: hero safe-to-spend, the 30-day cash-flow forecast (type a
   large amount into **Test a purchase** to see a danger zone), jars, cash
   flow, categories, and insights (invisible spend, subscriptions, cut-back).
4. Use the bottom bar to log an expense (with round-up), top up a jar or record
   a payday split.
5. **Settings → Clear all data** returns you to onboarding for the next run.

## Suggested build order

**Production `npm run build`:** Outputs static SPA only; pair with Phase B or a hosted Omg deploy for server-backed persistence.

**Deploy note (BUHack demo):** Run `npm run dev` on a laptop or VM for judges (API + SQLite). For static hosting, add Phase B Express or reverse-proxy to a machine running the dev stack until a production API ships.

---

## Program structure (repository)

```text
BUHack2/
├── README.md                 # This file — usage, backend status, gaps
├── PLAN.md                   # Roadmap, milestones, Phase B (Express/Postgres)
├── AGENTS.md                 # shadcn / Tailwind UI rules (do not break)
├── package.json
├── package-lock.json         # Commit this; pin shadcn@4.23.0
├── schema.ts                 # Data model: goals, transactions, settings
├── vite.config.ts            # Vite+, React, Tailwind, TanStack Router, vibes plugin
├── index.html
├── icons/
│   └── piggyBank.jpg         # Source for app icons
├── public/
│   ├── favicon-32.png
│   ├── favicon-192.png
│   └── icons/                # PWA / apple-touch icons (from piggyBank)
├── server/
│   ├── db.ts                 # Drizzle read helper for @omg-dev platform builds
│   ├── local-db.ts           # SQLite schema + CRUD (dev)
│   ├── local-api.ts          # REST handlers (/api/*)
│   └── vite-local-api-plugin.ts  # Vite middleware (enabled under NODE_RUNTIME=node)
├── src/
│   ├── main.tsx              # React entry
│   ├── App.tsx               # Main dashboard UI
│   ├── index.css             # Tailwind + design tokens
│   ├── routeTree.gen.ts      # Generated — do not edit
│   ├── routes/
│   │   ├── __root.tsx        # PrefsProvider (lang, theme, privacy)
│   │   └── index.tsx         # Route "/" → App
│   ├── components/
│   │   ├── Charts.tsx
│   │   ├── QuickSheets.tsx   # Expense, top-up, payday, goal, settings sheets
│   │   └── ui/               # shadcn primitives (vendored — do not hand-edit)
│   ├── lib/
│   │   ├── finance.ts        # Budget math, insights, types
│   │   ├── i18n.ts           # EN / 繁 strings
│   │   ├── prefs.tsx         # Client preferences + localStorage
│   │   ├── seed.ts           # Demo data loader
│   │   └── utils.ts
│   ├── db.generated.ts         # Collection bindings → /api/*
│   └── db.drizzle.ts
├── functions/                # Placeholder for serverless hooks
└── dist/                     # Build output (gitignored)
```

**Ignored locally (not in git):** `node_modules/`, `.cursor/`, `.vibes/`, `dist/`, `.env*`

---

## Technology stack (actual)

| Layer | Choice |
|-------|--------|
| Frontend | React 19, TypeScript, Vite+, TanStack Router |
| Styling | Tailwind v4, shadcn 4.23.0 |
| Data client | `@omg-dev/sdk` (`useCollection`) |
| Schema | `@omg-dev/schema` (`schema.ts`) |
| Dev persistence | Local SQLite via `server/*` (`node:sqlite`, Node **22+**) or `@omg-dev/vite-plugin` on Bun/Vibes hosts |
| Lint | ESLint |

---

## What’s implemented vs missing

### Implemented (~60% competition demo)

- [x] Single-page savings dashboard  
- [x] Jars, expenses, payday, top-up, settings  
- [x] Safe-to-spend (monthly model), forecast, insights  
- [x] Bilingual UI, dark mode, hide amounts  
- [x] Demo seed  
- [x] App icons from `icons/piggyBank.jpg`  
- [x] `npm run dev` / `npm run build` (with correct `shadcn` version)  

### Missing or incomplete (priority fixes)

| Item | Severity | Notes |
|------|----------|--------|
| **Reliable local `/api` in dev** | **Done** | Node SQLite plugin — see [Backend](#is-the-backend-working) |
| **User accounts / login** | High | No multi-user auth (`@omg-dev/auth` not wired) |
| **CSV import UI** | Medium | `source: "csv"` exists in schema only |
| **Export data (JSON/CSV)** | Medium | Only “Clear all” in settings |
| **Separate routes** (Goals, Activity, Import) | Low | Only `/` today |
| **Express + PostgreSQL (Phase B)** | Optional | Per `PLAN.md` if rubric requires it |
| **Automated tests** | Medium | No Vitest/Playwright scripts in `package.json` |
| **Minor-unit ledger rules** | Medium | Whole HKD amounts; no transfer/refund types |
| **Production deploy docs** | Medium | Omg/Vibes or custom host TBD |
| **README/PLAN sync** | Done | This README matches current code |

### Dependency hygiene

| Issue | Action |
|-------|--------|
| Wrong `shadcn@1.0.0` | Keep **`"shadcn": "4.23.0"`** in `package.json` |
| `npm audit fix --force` | **Avoid** — breaks shadcn CSS import |
| `minimatch` audit noise | Dev-only ESLint chain; optional `overrides` in `package.json` |

---

## Scripts

| Command | Purpose |
|---------|---------|
| `npm install` | Install dependencies |
| `npm run dev` | Development server (port 5173) |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Serve `dist/` locally |
| `npm run lint` | ESLint |

---

## Architecture (target data flow)

```text
Browser (React)
    → useCollection → /api/goals | /api/transactions | /api/settings
    → server/vite-local-api-plugin.ts (Node dev)
    → .data/pocketgoals.sqlite
```

On Bun/Vibes hosts without `NODE_RUNTIME=node`, the same paths can be served by `@omg-dev/vite-plugin` instead.

Future **Phase B** (optional): React → your Express API → PostgreSQL — see `PLAN.md` §14.

---

## Course / hackathon

**BUHack2** — HKBU hackathon savings dashboard.  
Product name in UI: **Savings Jars HK**; documentation may still say **PocketGoals HK**.

## License

TBD.