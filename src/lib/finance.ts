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
  const fixed = (s?.rent ?? 0) + (s?.utilities ?? 0) + (s?.mpf ?? 0)
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
  let running = 0
  // cumulative starts from all savings made before the window
  const firstKey = monthKeyOffset(y, m, -5)
  running = txs.filter((t) => t.kind === "saving" && t.date.slice(0, 7) < firstKey).reduce((s, t) => s + t.amount, 0)
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

function weekStart(iso: string) {
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
