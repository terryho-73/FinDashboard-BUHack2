export type Goal = {
  id: string
  name: string
  target: number
  emoji: string
  color: "rose" | "amber" | "sky" | "emerald" | "violet"
}

export type Tx = {
  id: string
  title: string
  amount: number
  kind: "expense" | "income" | "saving"
  category: "food" | "transport" | "shopping" | "entertainment" | "bills" | "subscription" | "other" | "income" | "saving"
  channel: "octopus" | "payme" | "alipayhk" | "fps" | "credit" | "cash" | "bank" | "other"
  date: string
  goal_id: string
  recurring: boolean
  source: "manual" | "csv" | "roundup" | "payday" | "topup" | "demo"
  created_at?: string
}

export type Settings = {
  id: string
  monthly_income: number
  rent: number
  utilities: number
  mpf: number
  save_pct: number
  round_to: number
  roundup_on: boolean
}

export type ForecastEvent = {
  date: string
  title: string
  amount: number
  kind: "income" | "expense"
}

export type ForecastDay = {
  date: string
  balance: number
  event?: ForecastEvent
  status: "safe" | "watch" | "danger"
}

export type CashFlowForecast = {
  days: ForecastDay[]
  lowestBalance: number
  lowestDate: string
  firstDangerDate: string | null
}

export const EXPENSE_CATS = ["food", "transport", "shopping", "entertainment", "bills", "subscription", "other"] as const
export const CHANNELS = ["octopus", "payme", "alipayhk", "fps", "credit", "cash", "bank", "other"] as const
export const JAR_EMOJIS = ["✈️", "🏠", "🛟", "🎫", "💰", "🎓", "💻", "🍜"]
export const JAR_COLORS: Goal["color"][] = ["rose", "amber", "sky", "emerald", "violet"]

// Tailwind-safe token mapping: only semantic tokens exist in this design system,
// so jar colours use chart tokens + opacity via inline styles.
export const JAR_HEX: Record<Goal["color"], string> = {
  rose: "#f43f5e",
  amber: "#f59e0b",
  sky: "#0ea5e9",
  emerald: "#10b981",
  violet: "#8b5cf6",
}

export function todayISO(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function addDays(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number)
  const dt = new Date(y, m - 1, d + n)
  return todayISO(dt)
}

export function money(n: number, hidden = false) {
  if (hidden) return "HK$ ••••"
  return `HK$${Math.round(n).toLocaleString("en-HK")}`
}

// Hong Kong mandatory employee MPF: 5% of relevant monthly income, with
// the statutory HK$7,100 lower threshold and HK$30,000 upper cap.
export function calculateMPF(monthlyIncome: number) {
  const relevantIncome = Math.min(Math.max(0, monthlyIncome), 30_000)
  if (relevantIncome < 7_100) return 0
  return Math.round(relevantIncome * 0.05 * 100) / 100
}

export function cashFlowForecast(opts: {
  startDate: string
  days: number
  startingBalance: number
  dailySpend: number
  safetyBuffer: number
  events: ForecastEvent[]
}): CashFlowForecast {
  const events = new Map<string, ForecastEvent[]>()
  for (const event of opts.events) {
    const list = events.get(event.date) ?? []
    list.push(event)
    events.set(event.date, list)
  }

  let balance = opts.startingBalance
  const days: ForecastDay[] = []
  for (let i = 0; i < opts.days; i++) {
    const date = addDays(opts.startDate, i)
    const todayEvents = events.get(date) ?? []
    balance -= opts.dailySpend
    for (const event of todayEvents) {
      balance += event.kind === "income" ? event.amount : -event.amount
    }
    const event = todayEvents[0]
    days.push({
      date,
      balance,
      event,
      status: balance < opts.safetyBuffer ? "danger" : balance < opts.safetyBuffer * 1.5 ? "watch" : "safe",
    })
  }

  const lowest = days.reduce(
    (result, day) => (day.balance < result.balance ? day : result),
    days[0] ?? { date: opts.startDate, balance: opts.startingBalance, status: "safe" as const },
  )
  return {
    days,
    lowestBalance: lowest.balance,
    lowestDate: lowest.date,
    firstDangerDate: days.find((day) => day.status === "danger")?.date ?? null,
  }
}

// Round a spend up to the next multiple of `to`, return the spare change.
export function spareChange(amount: number, to: number) {
  if (to <= 0 || amount <= 0) return 0
  const up = Math.ceil(amount / to) * to
  return Math.round((up - amount) * 100) / 100
}

export function goalSaved(goalId: string, txs: Tx[]) {
  return txs
    .filter((t) => t.kind === "saving" && t.goal_id === goalId)
    .reduce((s, t) => s + t.amount, 0)
}

export function summary(txs: Tx[], settings: Settings | null, today: string) {
  const month = today.slice(0, 7)
  const thisMonth = txs.filter((t) => t.date.startsWith(month))
  const income = sumKind(thisMonth, "income")
  const expenses = sumKind(thisMonth, "expense")
  const savedMonth = sumKind(thisMonth, "saving")
  const totalSaved = sumKind(txs, "saving")

  const s = settings
  // monthly_income is take-home pay, which already has employee MPF deducted,
  // so MPF is informational only and not subtracted again here.
  const fixed = (s?.rent ?? 0) + (s?.utilities ?? 0)
  const pct = s?.save_pct ?? 0
  const target = ((s?.monthly_income || income) * pct) / 100
  // Savings already moved this month count toward the target, never double-counted.
  const reserved = Math.max(target, savedMonth)
  const remaining = (s?.monthly_income || income) - fixed - reserved - expenses

  const [y, m, d] = today.split("-").map(Number)
  const daysInMonth = new Date(y, m, 0).getDate()
  const daysLeft = daysInMonth - d + 1
  const perDay = Math.max(0, remaining / daysLeft)
  const perWeek = Math.min(Math.max(0, remaining), perDay * 7)

  return { income, expenses, savedMonth, totalSaved, fixed, target, remaining, perDay, perWeek, daysLeft }
}

function sumKind(list: Tx[], kind: Tx["kind"]) {
  return list.filter((t) => t.kind === kind).reduce((s, t) => s + t.amount, 0)
}

export function categoryTotals(txs: Tx[], today: string) {
  const month = today.slice(0, 7)
  const map: Record<string, number> = {}
  for (const t of txs) {
    if (t.kind !== "expense" || !t.date.startsWith(month)) continue
    map[t.category] = (map[t.category] ?? 0) + t.amount
  }
  return EXPENSE_CATS.map((c) => ({ key: c, value: map[c] ?? 0 })).sort((a, b) => b.value - a.value)
}

// Last 6 months: monthly flow and cumulative saved (net savings growth).
export function monthlySeries(txs: Tx[], today: string) {
  const [y, m] = today.split("-").map(Number)
  const out: { key: string; income: number; expenses: number; saved: number; cumulative: number }[] = []
  // cumulative starts from all savings made before the window
  const firstKey = monthKeyOffset(y, m, -5)
  let running = txs.filter((t) => t.kind === "saving" && t.date.slice(0, 7) < firstKey).reduce((s, t) => s + t.amount, 0)
  for (let i = -5; i <= 0; i++) {
    const key = monthKeyOffset(y, m, i)
    const inMonth = txs.filter((t) => t.date.startsWith(key))
    const saved = sumKind(inMonth, "saving")
    running += saved
    out.push({
      key,
      income: sumKind(inMonth, "income"),
      expenses: sumKind(inMonth, "expense"),
      saved,
      cumulative: running,
    })
  }
  return out
}

function monthKeyOffset(y: number, m: number, offset: number) {
  const d = new Date(y, m - 1 + offset, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

export function weekStart(iso: string) {
  const [y, m, d] = iso.split("-").map(Number)
  const dt = new Date(y, m - 1, d)
  const dow = (dt.getDay() + 6) % 7 // Monday = 0
  return addDays(iso, -dow)
}

// Consecutive weeks (Mon–Sun) with at least one saving. The current week only
// counts once it has a saving; until then the streak carries from last week.
export function savingsStreak(txs: Tx[], today: string) {
  const weeks = new Set(txs.filter((t) => t.kind === "saving").map((t) => weekStart(t.date)))
  let cursor = weekStart(today)
  if (!weeks.has(cursor)) cursor = addDays(cursor, -7)
  let count = 0
  while (weeks.has(cursor)) {
    count++
    cursor = addDays(cursor, -7)
  }
  return count
}

export type Habit = { title: string; count: number; avg: number; total: number; category: string }

// Frequent small expenses in the last 30 days (≤ HK$100 each, 3+ times).
export function invisibleSpend(txs: Tx[], today: string): Habit[] {
  const from = addDays(today, -30)
  const groups = new Map<string, { title: string; count: number; total: number; category: string }>()
  for (const t of txs) {
    if (t.kind !== "expense" || t.recurring || t.amount > 100) continue
    if (t.date < from || t.date > today) continue
    const key = t.title.trim().toLowerCase()
    const g = groups.get(key) ?? { title: t.title.trim(), count: 0, total: 0, category: t.category }
    g.count++
    g.total += t.amount
    groups.set(key, g)
  }
  return [...groups.values()]
    .filter((g) => g.count >= 3)
    .map((g) => ({ ...g, avg: g.total / g.count }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)
}

export type Sub = { title: string; amount: number; channel: string }

// Recurring-flagged charges, one row per merchant (latest amount).
export function subscriptions(txs: Tx[]): Sub[] {
  const seen = new Map<string, Tx>()
  const sorted = [...txs].sort((a, b) => (a.date < b.date ? 1 : -1))
  for (const t of sorted) {
    if (t.kind !== "expense" || !(t.recurring || t.category === "subscription")) continue
    const key = t.title.trim().toLowerCase()
    if (!seen.has(key)) seen.set(key, t)
  }
  return [...seen.values()].map((t) => ({ title: t.title, amount: t.amount, channel: t.channel }))
}

// Cut-back: skipping `perWeek` purchases of `unitCost` each week.
export function cutBack(opts: { perWeek: number; unitCost: number; txs: Tx[]; today: string; goal: Goal | null }) {
  const monthlySaving = opts.perWeek * 4.33 * opts.unitCost
  const from = addDays(opts.today, -90)
  const savedRecent = opts.txs
    .filter((t) => t.kind === "saving" && t.date >= from && t.date <= opts.today)
    .reduce((s, t) => s + t.amount, 0)
  const pace = savedRecent / 3 // average saved per month, last 3 months
  let daysSooner: number | null = null
  if (opts.goal && pace > 0) {
    const remaining = Math.max(0, opts.goal.target - goalSaved(opts.goal.id, opts.txs))
    if (remaining > 0) {
      const now = remaining / (pace / 30)
      const next = remaining / ((pace + monthlySaving) / 30)
      daysSooner = Math.round(now - next)
    }
  }
  return { monthlySaving, daysSooner }
}

// ── Goal cost: how many days a spend delays a jar ───────────────────────────
// Saving pace per day: the last 90 days of actual savings, or, before there is
// any history, the monthly target from settings.
export function savingPacePerDay(txs: Tx[], settings: Settings | null, today: string) {
  const from = addDays(today, -90)
  const recent = txs
    .filter((t) => t.kind === "saving" && t.date >= from && t.date <= today)
    .reduce((s, t) => s + t.amount, 0)
  if (recent > 0) return recent / 90
  const target = ((settings?.monthly_income ?? 0) * (settings?.save_pct ?? 0)) / 100
  return target / 30
}

/** Days a jar is pushed back by spending `amount` instead of saving it. */
export function goalDelayDays(amount: number, pacePerDay: number) {
  if (pacePerDay <= 0 || amount <= 0) return null
  return amount / pacePerDay
}

export function formatDays(days: number, lang: "en" | "zh") {
  if (days < 0.1) return lang === "zh" ? "少於 0.1 日" : "<0.1 day"
  const n = days < 10 ? Math.round(days * 10) / 10 : Math.round(days)
  return lang === "zh" ? `${n} 日` : `${n} ${n === 1 ? "day" : "days"}`
}

// ── Weekly challenges ───────────────────────────────────────────────────────
export const CHALLENGES = ["no_shopping", "food_cut", "save3", "habit_half"] as const
export type ChallengeId = (typeof CHALLENGES)[number]

export type ChallengeStatus = {
  id: ChallengeId
  /** 0..1 toward finishing the week successfully */
  progress: number
  state: "on_track" | "done" | "failed"
  /** current value vs limit/target, for display */
  value: number
  limit: number
  /** HK$ kept vs a normal week (spend challenges only) */
  kept: number
  habit?: string
}

function sumWhere(txs: Tx[], from: string, to: string, pred: (t: Tx) => boolean) {
  return txs.filter((t) => t.date >= from && t.date <= to && pred(t)).reduce((s, t) => s + t.amount, 0)
}

/** Average per week over the 4 full weeks before `start`. */
function weeklyBaseline(txs: Tx[], start: string, pred: (t: Tx) => boolean) {
  return sumWhere(txs, addDays(start, -28), addDays(start, -1), pred) / 4
}

export function challengeStatus(id: ChallengeId, txs: Tx[], today: string, habits: Habit[]): ChallengeStatus {
  const start = weekStart(today)
  const end = addDays(start, 6)
  const dayIdx = Math.round((Date.parse(today) - Date.parse(start)) / 86_400_000) // 0..6
  const elapsed = (dayIdx + 1) / 7
  const weekOver = today >= end
  const finish = (ok: boolean, progress: number): ChallengeStatus["state"] =>
    !ok ? "failed" : weekOver ? "done" : progress >= 1 ? "done" : "on_track"

  if (id === "no_shopping") {
    const isShop = (t: Tx) => t.kind === "expense" && t.category === "shopping"
    const spent = sumWhere(txs, start, today, isShop)
    const base = weeklyBaseline(txs, start, isShop)
    const ok = spent === 0
    return { id, progress: ok ? elapsed : 1, state: finish(ok, ok ? elapsed : 0), value: spent, limit: 0, kept: Math.max(0, base * elapsed - spent) }
  }
  if (id === "food_cut") {
    const isFood = (t: Tx) => t.kind === "expense" && t.category === "food"
    const base = weeklyBaseline(txs, start, isFood)
    // Floor at HK$100 so a thin history doesn't set an impossible limit.
    const limit = Math.max(100, Math.round(base * 0.8))
    const spent = sumWhere(txs, start, today, isFood)
    const ok = spent <= limit
    return { id, progress: Math.min(1, spent / limit), state: finish(ok, ok ? elapsed : 0), value: spent, limit, kept: Math.max(0, base * elapsed - spent) }
  }
  if (id === "save3") {
    const n = txs.filter((t) => t.kind === "saving" && t.date >= start && t.date <= today).length
    return { id, progress: Math.min(1, n / 3), state: n >= 3 ? "done" : weekOver ? "failed" : "on_track", value: n, limit: 3, kept: 0 }
  }
  // habit_half: buy your top small habit at most half as often as usual
  const habit = habits[0]
  if (!habit) return { id, progress: 0, state: "on_track", value: 0, limit: 0, kept: 0 }
  const key = habit.title.trim().toLowerCase()
  const match = (t: Tx) => t.kind === "expense" && t.title.trim().toLowerCase() === key
  const n = txs.filter((t) => t.date >= start && t.date <= today && match(t)).length
  const limit = Math.max(1, Math.floor((habit.count / 4.3) / 2))
  const ok = n <= limit
  const baseCount = habit.count / 4.3
  return {
    id, progress: Math.min(1, n / limit), state: finish(ok, ok ? elapsed : 0), value: n, limit,
    kept: Math.max(0, (baseCount * elapsed - n) * habit.avg), habit: habit.title,
  }
}

/** This week's numbers for the shareable recap card. */
export function weekRecap(txs: Tx[], today: string) {
  const start = weekStart(today)
  const isExp = (t: Tx) => t.kind === "expense"
  const saved = sumWhere(txs, start, today, (t) => t.kind === "saving")
  const spent = sumWhere(txs, start, today, isExp)
  const dayIdx = Math.round((Date.parse(today) - Date.parse(start)) / 86_400_000)
  const usual = weeklyBaseline(txs, start, isExp) * ((dayIdx + 1) / 7)
  return { start, saved, spent, vsUsual: usual - spent }
}
