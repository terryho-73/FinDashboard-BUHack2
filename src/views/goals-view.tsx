import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { usePrefs } from "@/lib/prefs"
import { useSavingsData } from "@/lib/savings-data"
import { Page, useSheetActions } from "@/components/AppLayout"
import { goalSaved, money, JAR_HEX } from "@/lib/finance"
import { ProgressRing } from "@/components/Charts"

export function GoalsView() {
  const { t, hidden } = usePrefs()
  const { goals, txs, api, loading } = useSavingsData()
  const { openTopUp, openNewGoal } = useSheetActions()

  return (
    <Page>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">{t.goalsPageTitle}</h2>
          <p className="text-sm text-muted-foreground">{t.goalsPageHint}</p>
        </div>
        <Button variant="outline" size="sm" onClick={openNewGoal} className="h-9 shrink-0 gap-1">
          <Plus className="size-4" /> {t.newGoal}
        </Button>
      </div>

      {loading && goals.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.emptyLoading}</p>
      ) : goals.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-4 text-center text-sm text-muted-foreground">{t.noGoals}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {goals.map((g) => {
            const saved = goalSaved(g.id, txs)
            const pct = g.target > 0 ? saved / g.target : 0
            const done = pct >= 1
            return (
              <li key={g.id}>
                <Card className="flex flex-col gap-4 p-4">
                  <div className="flex items-start gap-3">
                    <div className="relative">
                      <ProgressRing value={pct} color={g.color} />
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold tabular-nums">
                        {Math.min(100, Math.round(pct * 100))}%
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
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
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </Page>
  )
}