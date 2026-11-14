import { useEffect, useMemo, useState } from "react"
import { useCollection } from "@omg-dev/sdk"
import { Flame, PiggyBank, Plus, Repeat, Receipt, Trash2, Wallet, AlertTriangle, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { usePrefs } from "@/lib/prefs-context"
import { useSheetActions } from "@/components/AppLayout"
import { format } from "@/lib/i18n"
import {
  categoryTotals,
  cutBack,
  goalSaved,
  invisibleSpend,
  monthlySeries,
  money,
  savingsStreak,
  subscriptions,
  summary,
  todayISO,
  addDays,
  cashFlowForecast,
  JAR_HEX,
  savingPacePerDay,
  goalDelayDays,
  formatDays,
  type Goal,
  type Settings,
  type Tx,
} from "@/lib/finance"
import { cn } from "@/lib/utils"
import { useNavigate } from "@tanstack/react-router"
import { ProgressRing, NetLine, CategoryBars, FlowBars } from "@/components/Charts"
import { type Api } from "@/components/QuickSheets"
import { WeeklyChallenge } from "@/components/WeeklyChallenge"

const SAFETY_BUFFER = 1000

export default function App() {
  const { t, lang, hidden } = usePrefs()
  const { openTopUp, openNewGoal, openPayday } = useSheetActions()
  const navigate = useNavigate()
  const goalsQ = useCollection<Goal>({ collection: "goals", api: "/api/goals" })
  const txQ = useCollection<Tx>({ collection: "transactions", api: "/api/transactions" })
  const settingsQ = useCollection<Settings>({ collection: "settings", api: "/api/settings" })

  // Writes are echoed into local state right away, so the screen updates even
  // before the live collection pushes the change back.
  const [localTx, setLocalTx] = useState<Record<string, Tx>>({})
  const [removedTx, setRemovedTx] = useState<Record<string, true>>({})
  const [localGoals, setLocalGoals] = useState<Record<string, Goal>>({})
  const [removedGoals, setRemovedGoals] = useState<Record<string, true>>({})
  const [localSettings, setLocalSettings] = useState<Settings | null>(null)
  const [settingsGone, setSettingsGone] = useState(false)

  const goals = useMemo(() => mergeRows(goalsQ.data, localGoals, removedGoals), [goalsQ.data, localGoals, removedGoals])
  const txs = useMemo(() => mergeRows(txQ.data, localTx, removedTx), [txQ.data, localTx, removedTx])
  const settings = settingsGone ? null : (localSettings ?? settingsQ.data[0] ?? null)
  const today = todayISO()

  const [skip, setSkip] = useState(1)
  const [habitIdx, setHabitIdx] = useState(0)
  const [cutGoalId, setCutGoalId] = useState<string | null>(null)

  const api: Api = {
    goals,
    settings,
    addTx: async (row) => {
      const r = (await txQ.create(row as never)) as Tx
      if (r?.id) setLocalTx((m) => ({ ...m, [r.id]: r }))
      return r
    },
    addGoal: async (row) => {
      const r = (await goalsQ.create(row as never)) as Goal
      if (r?.id) setLocalGoals((m) => ({ ...m, [r.id]: r }))
      return r
    },
    removeGoal: async (id) => {
      await goalsQ.remove(id)
      setRemovedGoals((m) => ({ ...m, [id]: true }))
    },
    removeTx: async (id) => {
      await txQ.remove(id)
      setRemovedTx((m) => ({ ...m, [id]: true }))
    },
    saveSettings: async (row) => {
      const r = (settings
        ? await settingsQ.update(settings.id, row as never)
        : await settingsQ.create(row as never)) as Settings
      setLocalSettings(r)
      setSettingsGone(false)
      return r
    },
  }

  const s = useMemo(() => summary(txs, settings, today), [txs, settings, today])
  const streak = useMemo(() => savingsStreak(txs, today), [txs, today])
  const cats = useMemo(() => categoryTotals(txs, today), [txs, today])
  const series = useMemo(() => monthlySeries(txs, today), [txs, today])
  const habits = useMemo(() => invisibleSpend(txs, today), [txs, today])
  const subs = useMemo(() => subscriptions(txs), [txs])
  const recent = useMemo(
    () =>
      [...txs]
        .sort((a, b) =>
          a.date !== b.date
            ? a.date < b.date ? 1 : -1
            : (b.created_at ?? "").localeCompare(a.created_at ?? ""),
        )
        .slice(0, 8),
    [txs],
  )

  const totalSaved = s.totalSaved
  const loading = goalsQ.loading || txQ.loading || settingsQ.loading
  // Brand-new user = nothing saved at all. Someone who only set a budget in
  // onboarding has settings and must stay on the dashboard, not loop back.
  const empty = !loading && goals.length === 0 && txs.length === 0 && !settings
  const isDemo = txs.some((tx) => tx.source === "demo")
  useEffect(() => {
    if (empty) void navigate({ to: "/onboarding", replace: true })
  }, [empty, navigate])
  const habit = habits[Math.min(habitIdx, habits.length - 1)]
  const openJars = goals.filter((g) => goalSaved(g.id, txs) < g.target)
  const cutGoal = goals.find((g) => g.id === cutGoalId) ?? openJars[0] ?? goals[0] ?? null
  // Goal cost (#2): every spend is shown as days of delay for the first open jar.
  const focusGoal = openJars[0] ?? null
  const pace = useMemo(() => savingPacePerDay(txs, settings, today), [txs, settings, today])
  const delayLabel = (amount: number) => {
    const d = goalDelayDays(amount, pace)
    return focusGoal && d !== null ? formatDays(d, lang) : null
  }
  const cut = habit
    ? cutBack({ perWeek: skip, unitCost: habit.avg, txs, today, goal: cutGoal })
    : null

  // One set of forecast inputs, shared by the baseline and the "test a
  // purchase" what-if so both project the same payday and bills.
  const forecastInputs = useMemo(() => {
    const totalIncome = txs.filter((t) => t.kind === "income").reduce((n, t) => n + t.amount, 0)
    const totalOut = txs.filter((t) => t.kind !== "income").reduce((n, t) => n + t.amount, 0)
    const recentExpense = txs
      .filter((t) => t.kind === "expense" && t.date >= addDays(today, -30) && t.date <= today && !t.recurring)
      .reduce((n, t) => n + t.amount, 0)
    const [y, m, d] = today.split("-").map(Number)
    const payday = todayISO(new Date(y, m, 1)) // 1st of next month
    // Rent & bills on the 25th: this month if still ahead, else next month.
    const nextBill = todayISO(new Date(y, d < 25 ? m - 1 : m, 25))
    const events = [
      { date: payday, title: "Payday", amount: settings?.monthly_income ?? 0, kind: "income" as const },
      { date: nextBill, title: "Rent & bills", amount: (settings?.rent ?? 0) + (settings?.utilities ?? 0), kind: "expense" as const },
    ].filter((event) => event.amount > 0)
    return {
      startDate: today,
      days: 30,
      startingBalance: Math.max(0, totalIncome - totalOut),
      dailySpend: recentExpense / 30,
      safetyBuffer: SAFETY_BUFFER,
      events,
    }
  }, [settings, today, txs])
  const forecast = useMemo(() => cashFlowForecast(forecastInputs), [forecastInputs])
  // Without any recorded income the projection starts from HK$0 and would
  // flag "danger" on day one, so ask for a payday first instead.
  const hasIncome = txs.some((tx) => tx.kind === "income")
  const forecastPeak = Math.max(1, ...forecast.days.map((day) => day.balance))
  const [purchaseAmount, setPurchaseAmount] = useState("")
  const purchase = Math.max(0, Number(purchaseAmount.replace(/,/g, "")) || 0)
  const purchaseForecast = useMemo(
    () => purchase > 0
      ? cashFlowForecast({
          ...forecastInputs,
          events: [
            ...forecastInputs.events,
            { date: today, title: "Planned purchase", amount: purchase, kind: "expense" as const },
          ],
        })
      : null,
    [forecastInputs, purchase, today],
  )
  // How much less to spend per day (until the lowest point) to stay above the buffer.
  const purchaseCutPerDay = purchaseForecast?.firstDangerDate
    ? Math.ceil(
        (SAFETY_BUFFER - purchaseForecast.lowestBalance) /
          Math.max(1, purchaseForecast.days.findIndex((day) => day.date === purchaseForecast.lowestDate) + 1),
      )
    : 0

  const monthLabel = (key: string) =>
    new Date(`${key}-01T00:00:00`).toLocaleString(lang === "zh" ? "zh-HK" : "en", { month: "short" })

  function dayLabel(iso: string) {
    if (iso === today) return t.today
    if (iso === addOne(today, -1)) return t.yesterday
    return iso.slice(5)
  }

  return (
    <div className="flex flex-col gap-5">
        {loading && goals.length === 0 && txs.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">{t.emptyLoading}</p>
        )}

        {isDemo && (
          <div className="flex justify-center">
            <Badge variant="secondary">{t.demoBadge}</Badge>
          </div>
        )}

        {/* 1. Hero status: total saved + safe-to-spend */}
        <section className="rounded-3xl bg-primary p-5 text-primary-foreground shadow-sm">
          <p className="text-sm opacity-80">{t.heroSaved}</p>
          <p className="mt-1 text-4xl font-semibold tracking-tight tabular-nums break-words">
            {money(totalSaved, hidden)}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="min-w-0 rounded-2xl bg-primary-foreground/10 p-3">
              <p className="text-xs opacity-80">{t.heroSafeToday}</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums break-words">
                {money(s.perDay, hidden)}
                <span className="block text-xs font-normal opacity-80">{t.perDay}</span>
              </p>
            </div>
            <div className="min-w-0 rounded-2xl bg-primary-foreground/10 p-3">
              <p className="text-xs opacity-80">{t.heroSafeWeek}</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums break-words">
                {money(s.perWeek, hidden)}
                <span className="block text-xs font-normal opacity-80">{t.perWeek}</span>
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/15 px-2.5 py-1">
              <Flame className="size-3.5" aria-hidden="true" />
              {streak > 0 ? `${streak} ${t.streak}` : t.streakZero}
            </span>
            <span className="opacity-80">
              {t.heroLeftMonth}: <span className="font-medium opacity-100">{money(s.remaining, hidden)}</span>
            </span>
          </div>
        </section>

        <Card className="gap-4 border-primary/20 p-5">
          <div className="flex items-start gap-3">
            <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-2xl", hasIncome && forecast.firstDangerDate ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary")}>
              {hasIncome && forecast.firstDangerDate ? <AlertTriangle className="size-5" /> : <CheckCircle2 className="size-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold">{t.forecastTitle}</h2>
              <p className="mt-1 text-sm">
                {!hasIncome
                  ? t.forecastEmpty
                  : forecast.firstDangerDate
                    ? format(t.forecastDanger, { date: forecast.firstDangerDate.slice(5) })
                    : t.forecastSafe}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{t.forecastHint}</p>
            </div>
          </div>
          {!hasIncome ? (
            <Button variant="secondary" onClick={() => openPayday()} className="h-10 gap-2">
              {t.payday}
            </Button>
          ) : (
          <>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">{t.forecastLow}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{money(forecast.lowestBalance, hidden)}</p>
            </div>
            <div className="rounded-2xl bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">{t.forecastBuffer}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{money(SAFETY_BUFFER, hidden)}</p>
            </div>
          </div>
          <div className="flex h-12 items-end gap-1" role="img" aria-label={t.forecastTitle}>
            {forecast.days.map((day) => (
              <div
                key={day.date}
                title={`${day.date}: ${money(day.balance, hidden)}`}
                className={cn(
                  "min-w-0 flex-1 rounded-t-sm",
                  day.status === "danger" ? "bg-destructive" : day.status === "watch" ? "bg-accent-foreground/50" : "bg-primary",
                )}
                style={{ height: `${Math.max(10, Math.min(100, (day.balance / forecastPeak) * 100))}%` }}
              />
            ))}
          </div>
          <div className="border-t pt-4">
            <p className="mb-2 text-sm font-medium">{t.forecastPurchase}</p>
            <div className="grid grid-cols-[1fr_8rem] gap-2">
              <Input placeholder={t.forecastPurchasePlaceholder} aria-label={t.forecastPurchasePlaceholder} />
              <Input inputMode="decimal" value={purchaseAmount} onChange={(e) => setPurchaseAmount(e.target.value)} placeholder="680" aria-label={t.forecastImpact} />
            </div>
            {purchaseForecast && (
              <div className={cn("mt-3 rounded-2xl p-3 text-sm", purchaseForecast.firstDangerDate ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary")}>
                <p className="font-medium">{purchaseForecast.firstDangerDate ? t.forecastBuyDanger : t.forecastBuySafe}</p>
                {purchaseForecast.firstDangerDate && (
                  <p className="mt-1 text-xs">{format(t.forecastRecommendation, { amount: money(purchaseCutPerDay, hidden) })}</p>
                )}
                {focusGoal && delayLabel(purchase) && (
                  <p className="mt-1 text-xs text-foreground">
                    {focusGoal.emoji} {format(t.goalCostPush, { goal: focusGoal.name, days: delayLabel(purchase)! })}
                  </p>
                )}
              </div>
            )}
          </div>
          </>
          )}
        </Card>

        {/* 2. Progress: saving jars (swipeable) */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-base font-semibold">{t.goalsTitle}</h2>
              {goals.length > 0 && <p className="text-xs text-muted-foreground">{t.goalsHint}</p>}
            </div>
            <Button variant="outline" size="sm" onClick={() => openNewGoal()} className="h-9 shrink-0 gap-1">
              <Plus className="size-4" /> {t.newGoal}
            </Button>
          </div>
          {goals.length === 0 && !loading ? (
            <p className="rounded-2xl border border-dashed p-4 text-center text-sm text-muted-foreground">{t.noGoals}</p>
          ) : (
            <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {goals.map((g) => {
                const saved = goalSaved(g.id, txs)
                const pct = g.target > 0 ? saved / g.target : 0
                const done = pct >= 1
                return (
                  <article
                    key={g.id}
                    className="flex w-[80%] max-w-72 shrink-0 snap-start flex-col gap-4 rounded-3xl border bg-card p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative">
                        <ProgressRing value={pct} color={g.color} />
                        <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold tabular-nums">
                          {Math.min(100, Math.round(pct * 100))}%
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          <span className="mr-1">{g.emoji}</span>
                          {g.name}
                        </p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {money(saved, hidden)} / {money(g.target, hidden)}
                        </p>
                        <p className="mt-1 text-xs font-medium" style={{ color: JAR_HEX[g.color] }}>
                          {done ? t.goalDone : `${money(Math.max(0, g.target - saved), hidden)} ${t.left}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <Button size="sm" variant="secondary" onClick={() => openTopUp(g.id)} className="h-8">
                        <Plus className="size-3.5" /> {t.topUp}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        aria-label={t.delete}
                        onClick={() => window.confirm(t.confirmDelete) && api.removeGoal(g.id)}
                      >
                        <Trash2 className="size-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        {/* Weekly challenge + shareable recap (#3) */}
        <WeeklyChallenge txs={txs} today={today} habits={habits} streak={streak} focusGoal={focusGoal} />

        {/* 3. Change: cash flow + net growth + categories */}
        <Card className="gap-5 p-5">
          <h2 className="text-base font-semibold">{t.cashflowTitle}</h2>
          <FlowBars
            hidden={hidden}
            rows={[
              { label: t.income, value: s.income, color: "#0ea5e9" },
              { label: t.expenses, value: s.expenses, color: "#f43f5e" },
              { label: t.saved, value: s.savedMonth, color: "#10b981" },
            ]}
          />
          <div className="border-t pt-5">
            <div className="mb-3">
              <h3 className="text-sm font-semibold">{t.netGrowth}</h3>
              <p className="text-xs text-muted-foreground">{t.netGrowthHint}</p>
            </div>
            <NetLine
              hidden={hidden}
              points={series.map((p) => p.cumulative)}
              labels={series.map((p) => monthLabel(p.key))}
            />
          </div>
        </Card>

        <Card className="gap-4 p-5">
          <h2 className="text-base font-semibold">{t.categoryTitle}</h2>
          {cats.every((c) => c.value === 0) ? (
            <p className="text-sm text-muted-foreground">{t.noTx}</p>
          ) : (
            <CategoryBars hidden={hidden} rows={cats.filter((c) => c.value > 0).map((c) => ({ label: t.cats[c.key], value: c.value }))} />
          )}
        </Card>

        {/* 4. Action & details: recent transactions */}
        <Card className="gap-3 p-5">
          <div>
            <h2 className="text-base font-semibold">{t.recentTitle}</h2>
            {focusGoal && pace > 0 && (
              <p className="text-xs text-muted-foreground">{format(t.goalCostHint, { goal: `${focusGoal.emoji} ${focusGoal.name}` })}</p>
            )}
          </div>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.noTx}</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {recent.map((tx) => {
                const plus = tx.kind !== "expense"
                return (
                  <li key={tx.id} className="flex items-center gap-3 py-3">
                    <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", plus ? "bg-primary/15" : "bg-muted")}>
                      {tx.kind === "saving" ? <PiggyBank className="size-4" /> : tx.kind === "income" ? <Wallet className="size-4" /> : <Receipt className="size-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{tx.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {dayLabel(tx.date)} · {t.cats[tx.category]} · {t.channels[tx.channel]}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={cn("text-sm font-semibold tabular-nums", plus && "text-primary")}>
                        {plus ? "+" : "−"}
                        {money(tx.amount, hidden)}
                      </p>
                      {!plus && focusGoal && delayLabel(tx.amount) && (
                        <p className="text-xs tabular-nums text-muted-foreground" title={format(t.goalCostPush, { goal: focusGoal.name, days: delayLabel(tx.amount)! })}>
                          {focusGoal.emoji} +{delayLabel(tx.amount)}
                        </p>
                      )}
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8 shrink-0"
                      aria-label={t.delete}
                      onClick={() => window.confirm(t.confirmDelete) && api.removeTx(tx.id)}
                    >
                      <Trash2 className="size-3.5 text-muted-foreground" />
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        {/* Insights: invisible spend, subscriptions, cut-back calculator */}
        <section className="flex flex-col gap-4">
          <h2 className="text-base font-semibold">{t.insightsTitle}</h2>

          <Card className="gap-3 p-5">
            <div>
              <h3 className="text-sm font-semibold">{t.invisibleTitle}</h3>
              <p className="text-xs text-muted-foreground">{t.invisibleHint}</p>
            </div>
            {habits.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.noInsights}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {habits.map((h) => (
                  <li key={h.title} className="flex items-center justify-between gap-3 rounded-2xl bg-muted/50 px-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{h.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {h.count} {t.timesPerMonth} · {t.avgEach} {money(h.avg, hidden)}
                      </p>
                      {focusGoal && delayLabel(h.total) && (
                        <p className="text-xs font-medium" style={{ color: JAR_HEX[focusGoal.color] }}>
                          {focusGoal.emoji} {format(t.habitGoalCost, { goal: focusGoal.name, days: delayLabel(h.total)! })}
                        </p>
                      )}
                    </div>
                    <p className="shrink-0 font-semibold tabular-nums">{money(h.total, hidden)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="gap-3 p-5">
            <div className="flex items-center gap-2">
              <Repeat className="size-4 text-muted-foreground" aria-hidden="true" />
              <div>
                <h3 className="text-sm font-semibold">{t.subsTitle}</h3>
                <p className="text-xs text-muted-foreground">{t.subsHint}</p>
              </div>
            </div>
            {subs.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t.noInsights}</p>
            ) : (
              <ul className="flex flex-col divide-y">
                {subs.map((sub) => (
                  <li key={sub.title} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{sub.title}</p>
                      <p className="text-xs text-muted-foreground">{t.channels[sub.channel as keyof typeof t.channels]}</p>
                    </div>
                    <p className="shrink-0 tabular-nums">
                      {money(sub.amount, hidden)} <span className="text-xs text-muted-foreground">{t.perMonth}</span>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="gap-4 p-5">
            <div>
              <h3 className="text-sm font-semibold">{t.cutBackTitle}</h3>
              <p className="text-xs text-muted-foreground">{t.cutBackHint}</p>
            </div>
            {!habit ? (
              <p className="text-sm text-muted-foreground">{t.noInsights}</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {habits.map((h, i) => (
                    <button
                      key={h.title}
                      type="button"
                      aria-pressed={i === habitIdx}
                      onClick={() => setHabitIdx(i)}
                      className={cn(
                        "max-w-full truncate rounded-full border px-3 py-1.5 text-xs",
                        i === habitIdx ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted/50",
                      )}
                    >
                      {h.title}
                    </button>
                  ))}
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-sm">
                    <label htmlFor="skip" className="font-medium">{t.skipPerWeek}</label>
                    <span className="tabular-nums font-semibold">{skip}×</span>
                  </div>
                  <input
                    id="skip"
                    type="range"
                    min={0}
                    max={7}
                    step={1}
                    value={skip}
                    onChange={(e) => setSkip(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
                {cut && (
                  <div className="rounded-2xl bg-primary/10 p-4 text-sm">
                    <p className="font-semibold">{format(t.cutBackResult, { amount: money(cut.monthlySaving, hidden) })}</p>
                    {goals.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {goals.map((g) => (
                          <button
                            key={g.id}
                            type="button"
                            aria-pressed={cutGoal?.id === g.id}
                            onClick={() => setCutGoalId(g.id)}
                            className={cn(
                              "rounded-full border px-2.5 py-1 text-xs",
                              cutGoal?.id === g.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background",
                            )}
                          >
                            {g.emoji} {g.name}
                          </button>
                        ))}
                      </div>
                    )}
                    <p className="mt-2 text-muted-foreground">
                      {cut.daysSooner && cut.daysSooner > 0 && cutGoal
                        ? format(t.cutBackSooner, { goal: cutGoal.name, days: cut.daysSooner })
                        : t.cutBackNoGoal}
                    </p>
                  </div>
                )}
              </>
            )}
          </Card>
        </section>

        <p className="text-center text-xs text-muted-foreground">{t.footnote}</p>
    </div>
  )
}

function mergeRows<T extends { id: string }>(
  base: T[],
  local: Record<string, T>,
  removed: Record<string, true>,
): T[] {
  const m = new Map<string, T>()
  for (const r of base) m.set(r.id, r)
  for (const r of Object.values(local)) m.set(r.id, r)
  for (const id of Object.keys(removed)) m.delete(id)
  return [...m.values()]
}

function addOne(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number)
  return todayISO(new Date(y, m - 1, d + n))
}
