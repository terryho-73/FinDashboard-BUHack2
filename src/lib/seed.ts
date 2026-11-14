import { addDays, calculateMPF, todayISO, type Goal, type Settings, type Tx } from "@/lib/finance"

type Api = {
  addGoal: (g: Omit<Goal, "id">) => Promise<{ id: string }>
  addTx: (t: Omit<Tx, "id" | "created_at">) => Promise<unknown>
  saveSettings: (s: Omit<Settings, "id">) => Promise<unknown>
}

// Sample jars and a few months of activity so the dashboard has something to show.
export async function seedDemo(api: Api) {
  const today = todayISO()
  const jars = [
    { name: "Japan Travel Fund", target: 15000, emoji: "✈️", color: "sky" as const },
    { name: "Rental Deposit", target: 48000, emoji: "🏠", color: "amber" as const },
    { name: "Emergency Fund", target: 30000, emoji: "🛟", color: "emerald" as const },
    { name: "Concert Tickets", target: 9000, emoji: "🎫", color: "violet" as const },
  ]
  const goals: { id: string }[] = []
  for (const j of jars) goals.push(await api.addGoal(j))

  await api.saveSettings({
    monthly_income: 22000,
    rent: 6000,
    utilities: 800,
    mpf: calculateMPF(22000),
    save_pct: 20,
    round_to: 10,
    roundup_on: true,
  })

  const jobs: Promise<unknown>[] = []
  // Six months of paydays + auto-splits (20% of HK$22,000 = HK$4,400 across 4 jars)
  for (let back = 5; back >= 0; back--) {
    const d = new Date()
    const first = new Date(d.getFullYear(), d.getMonth() - back, 1)
    const iso = `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, "0")}-01`
    jobs.push(
      api.addTx({
        title: "Payday", amount: 22000, kind: "income", category: "income", channel: "fps",
        date: iso, goal_id: "", recurring: false, source: "payday",
      }),
    )
    goals.forEach((g) =>
      jobs.push(
        api.addTx({
          title: "Payday auto-split", amount: 1100, kind: "saving", category: "saving", channel: "bank",
          date: iso, goal_id: g.id, recurring: false, source: "payday",
        }),
      ),
    )
  }

  const expense = (
    title: string, amount: number, category: Tx["category"], channel: Tx["channel"],
    daysAgo: number, recurring = false,
  ) =>
    api.addTx({
      title, amount, kind: "expense", category, channel,
      date: addDays(today, -daysAgo), goal_id: "", recurring, source: "demo",
    })

  // This month's spending, including small habits and subscriptions
  jobs.push(expense("茶餐廳午餐 Lunch", 38, "food", "octopus", 0))
  jobs.push(expense("MTR", 14, "transport", "octopus", 1))
  jobs.push(expense("Iced lemon tea", 25, "food", "payme", 2))
  jobs.push(expense("Iced lemon tea", 25, "food", "payme", 5))
  jobs.push(expense("Iced lemon tea", 25, "food", "payme", 9))
  jobs.push(expense("Iced lemon tea", 25, "food", "payme", 13))
  jobs.push(expense("7-Eleven", 12, "food", "octopus", 3))
  jobs.push(expense("7-Eleven", 18, "food", "octopus", 7))
  jobs.push(expense("Netflix", 78, "subscription", "credit", 4, true))
  jobs.push(expense("Spotify", 58, "subscription", "credit", 8, true))
  jobs.push(expense("Gym membership", 380, "bills", "credit", 10, true))
  jobs.push(expense("Uniqlo", 399, "shopping", "credit", 6))
  jobs.push(expense("Movie night", 90, "entertainment", "alipayhk", 11))
  jobs.push(expense("Bus", 9, "transport", "octopus", 12))
  // Round-up sweeps from the lunch, MTR and 7-Eleven purchases
  jobs.push(
    api.addTx({
      title: "Round-up", amount: 2, kind: "saving", category: "saving", channel: "other",
      date: today, goal_id: goals[0].id, recurring: false, source: "roundup",
    }),
  )
  jobs.push(
    api.addTx({
      title: "Round-up", amount: 6, kind: "saving", category: "saving", channel: "other",
      date: today, goal_id: goals[2].id, recurring: false, source: "roundup",
    }),
  )

  await Promise.all(jobs)
}
