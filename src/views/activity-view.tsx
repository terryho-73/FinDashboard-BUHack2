import { Trash2, Wallet, PiggyBank, Receipt } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { usePrefs } from "@/lib/prefs"
import { useSavingsData } from "@/lib/savings-data"
import { money, todayISO } from "@/lib/finance"
import { cn } from "@/lib/utils"
import { Page } from "@/components/AppLayout"

export function ActivityView() {
  const { t, hidden } = usePrefs()
  const { txs, api, loading } = useSavingsData()
  const today = todayISO()

  const sorted = [...txs].sort((a, b) =>
    a.date !== b.date ? (a.date < b.date ? 1 : -1) : (b.created_at ?? "").localeCompare(a.created_at ?? ""),
  )

  function dayLabel(iso: string) {
    if (iso === today) return t.today
    const yesterday = todayISO(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() - 1))
    if (iso === yesterday) return t.yesterday
    return iso.slice(5)
  }

  return (
    <Page>
      <h2 className="text-lg font-semibold">{t.activityTitle}</h2>
      <p className="text-sm text-muted-foreground">{t.activityHint}</p>
      <Card className="gap-3 p-5">
        {loading && sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.emptyLoading}</p>
        ) : sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.noTx}</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {sorted.map((tx) => {
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
                      {tx.source === "demo" ? ` · ${t.demoBadge}` : ""}
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
    </Page>
  )
}