import { useMemo, useState } from "react"
import {
  Flame,
  Plus,
  Repeat,
  Trash2,
  Wallet,
  PiggyBank,
  Receipt,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { usePrefs } from "@/lib/prefs"
import { useSavingsData } from "@/lib/savings-data"
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
} from "@/lib/finance"
import { cn } from "@/lib/utils"
import { ProgressRing, NetLine, CategoryBars, FlowBars } from "@/components/Charts"
import { MonthCalendar, DayEventList } from "@/components/MonthCalendar"
import { adjustPaydayIso, marksForDate } from "@/lib/calendar-events"

export default function DashboardView() {
  const { t, lang, hidden } = usePrefs()
  const { goals, txs, settings, loading, api } = useSavingsData()
  const { openTopUp, openNewGoal } = useSheetActions()
  const today = todayISO()

  const [skip, setSkip] = useState(1)
  const [habitIdx, setHabitIdx] = useState(0)
  const [cutGoalId, setCutGoalId] = useState<string | null>(null)
  const [purchaseAmount, setPurchaseAmount] = useState("")
  const [calSelected, setCalSelected] = useState(today)
  const [calYear, setCalYear] = useState(() => new Date().getFullYear())
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth())

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
          a.date !== b.date ? (a.date < b.date ? 1 : -1) : (b.created_at ?? "").localeCompare(a.created_at ?? ""),
        )
        .slice(0, 8),
    [txs],
  )

  const totalSaved = s.totalSaved
  const habit = habits[Math.min(habitIdx, habits.length - 1)]
  const openJars = goals.filter((g) => goalSaved(g.id, txs) < g.target)
  const cutGoal = goals.find((g) => g.id === cutGoalId) ?? openJars[0] ?? goals[0] ?? null
  const cut = habit ? cutBack({ perWeek: skip, unitCost: habit.avg, txs, today, goal: cutGoal }) : null

  const forecast = useMemo(() => {
    const totalIncome = txs.filter((tx) => tx.kind === "income").reduce((n, tx) => n + tx.amount, 0)
    const totalOut = txs.filter((tx) => tx.kind !== "income").reduce((n, tx) => n + tx.amount, 0)
    const recentExpense = txs
      .filter((tx) => tx.kind === "expense" && tx.date >= addDays(today, -30) && tx.date <= today && !tx.recurring)
      .reduce((n, tx) => n + tx.amount, 0)
    const nextMonth = new Date(`${today.slice(0, 7)}-01T00:00:00`)
    nextMonth.setMonth(nextMonth.getMonth() + 1)
    const payday = adjustPaydayIso(todayISO(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1)))
    const billDate = todayISO(new Date(new Date(today).getFullYear(), new Date(today).getMonth(), 25))
    const nextBill = billDate > today ? billDate : addDays(billDate, 31)
    const events = [
      { date: payday, title: "Payday", amount: settings?.monthly_income ?? 0, kind: "income" as const },
      {
        date: nextBill,
        title: "Rent & bills",
        amount: (settings?.rent ?? 0) + (settings?.utilities ?? 0),
        kind: "expense" as const,
      },
    ].filter((event) => event.amount > 0)
    return cashFlowForecast({
      startDate: today,
      days: 30,
      startingBalance: Math.max(0, totalIncome - totalOut),
      dailySpend: recentExpense / 30,
      safetyBuffer: 1000,
      events,
    })
  }, [settings, today, txs])

  const purchase = Math.max(0, Number(purchaseAmount.replace(/,/g, "")) || 0)
  const purchaseForecast = useMemo(
    () =>
      purchase > 0
        ? cashFlowForecast({
            startDate: today,
            days: 30,
            startingBalance: Math.max(
              0,
              txs.filter((tx) => tx.kind === "income").reduce((n, tx) => n + tx.amount, 0) -
                txs.filter((tx) => tx.kind !== "income").reduce((n, tx) => n + tx.amount, 0),
            ),
            dailySpend:
              txs
                .filter(
                  (tx) => tx.kind === "expense" && tx.date >= addDays(today, -30) && tx.date <= today && !tx.recurring,
                )
                .reduce((n, tx) => n + tx.amount, 0) / 30,
            safetyBuffer: 1000,
            events: [{ date: today, title: "Planned purchase", amount: purchase, kind: "expense" as const }],
          })
        : null,
    [purchase, today, txs],
  )

  const monthLabel = (key: string) =>
    new Date(`${key}-01T00:00:00`).toLocaleString(lang === "zh" ? "zh-HK" : "en", { month: "short" })

  function dayLabel(iso: string) {
    if (iso === today) return t.today
    if (iso === addOne(today, -1)) return t.yesterday
    return iso.slice(5)
  }

  if (loading && goals.length === 0 && txs.length === 0) {
    return null
  }

  return (
    <div className="flex flex-col gap-5">
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

      <Card id="home-calendar" className="gap-4 p-5">
        <div>
          <h2 className="text-base font-semibold">{t.calendarTitle}</h2>
          <p className="text-xs text-muted-foreground">{t.calendarSectionHint}</p>
        </div>
        <MonthCalendar
          goals={goals}
          txs={txs}
          settings={settings}
          selected={calSelected}
          onSelect={setCalSelected}
          year={calYear}
          monthIndex0={calMonth}
          onMonthChange={(y, m) => {
            setCalYear(y)
            setCalMonth(m)
          }}
        />
        <DayEventList marks={marksForDate(calSelected, goals, txs, settings, lang)} />
        <p className="text-[10px] text-muted-foreground">{t.calendarHolidaySource}</p>
      </Card>

      <Card className="gap-4 border-primary/20 p-5">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-2xl",
              forecast.firstDangerDate ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary",
            )}
          >
            {forecast.firstDangerDate ? <AlertTriangle className="size-5" /> : <CheckCircle2 className="size-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold">{t.forecastTitle}</h2>
            <p className="mt-1 text-sm">
              {forecast.firstDangerDate
                ? format(t.forecastDanger, { date: forecast.firstDangerDate.slice(5) })
                : t.forecastSafe}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{t.forecastHint}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">{t.forecastLow}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{money(forecast.lowestBalance, hidden)}</p>
          </div>
          <div className="rounded-2xl bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">{t.forecastBuffer}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{money(1000, hidden)}</p>
          </div>
        </div>
        <div className="flex h-12 items-end gap-1" role="img" aria-label={t.forecastTitle}>
          {forecast.days.map((day) => (
            <div
              key={day.date}
              title={`${day.date}: ${money(day.balance, hidden)}`}
              className={cn(
                "min-w-0 flex-1 rounded-t-sm",
                day.status === "danger"
                  ? "bg-destructive"
                  : day.status === "watch"
                    ? "bg-accent-foreground/50"
                    : "bg-primary",
              )}
              style={{
                height: `${Math.max(10, Math.min(100, (day.balance / Math.max(1, forecast.days[0]?.balance ?? 1)) * 100))}%`,
              }}
            />
          ))}
        </div>
        <div className="border-t pt-4">
          <p className="mb-2 text-sm font-medium">{t.forecastPurchase}</p>
          <div className="grid grid-cols-[1fr_8rem] gap-2">
            <Input placeholder={t.forecastPurchasePlaceholder} aria-label={t.forecastPurchasePlaceholder} />
            <Input
              inputMode="decimal"
              value={purchaseAmount}
              onChange={(e) => setPurchaseAmount(e.target.value)}
              placeholder="680"
              aria-label={t.forecastImpact}
            />
          </div>
          {purchaseForecast && (
            <div
              className={cn(
                "mt-3 rounded-2xl p-3 text-sm",
                purchaseForecast.firstDangerDate ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary",
              )}
            >
              <p className="font-medium">
                {purchaseForecast.firstDangerDate ? t.forecastBuyDanger : t.forecastBuySafe}
              </p>
              {purchaseForecast.firstDangerDate && (
                <p className="mt-1 text-xs">{format(t.forecastRecommendation, { amount: Math.ceil(purchase / 14) })}</p>
              )}
            </div>
          )}
        </div>
      </Card>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-base font-semibold">{t.goalsTitle}</h2>
            {goals.length > 0 && <p className="text-xs text-muted-foreground">{t.goalsHint}</p>}
          </div>
          <Button variant="outline" size="sm" onClick={openNewGoal} className="h-9 shrink-0 gap-1">
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
          <CategoryBars
            hidden={hidden}
            rows={cats.filter((c) => c.value > 0).map((c) => ({ label: t.cats[c.key], value: c.value }))}
          />
        )}
      </Card>

      <Card className="gap-3 p-5">
        <h2 className="text-base font-semibold">{t.recentTitle}</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.noTx}</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {recent.map((tx) => {
              const plus = tx.kind !== "expense"
              return (
                <li key={tx.id} className="flex items-center gap-3 py-3">
                  <div
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-full",
                      plus ? "bg-primary/15" : "bg-muted",
                    )}
                  >
                    {tx.kind === "saving" ? (
                      <PiggyBank className="size-4" />
                    ) : tx.kind === "income" ? (
                      <Wallet className="size-4" />
                    ) : (
                      <Receipt className="size-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{tx.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {dayLabel(tx.date)} · {t.cats[tx.category]} · {t.channels[tx.channel]}
                    </p>
                  </div>
                  <p className={cn("shrink-0 text-sm font-semibold tabular-nums", plus && "text-primary")}>
                    {plus ? "+" : "−"}
                    {money(tx.amount, hidden)}
                  </p>
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
                  <label htmlFor="skip" className="font-medium">
                    {t.skipPerWeek}
                  </label>
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
                            cutGoal?.id === g.id
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-background",
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

function addOne(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number)
  return todayISO(new Date(y, m - 1, d + n))
}