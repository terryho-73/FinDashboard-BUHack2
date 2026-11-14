import { useMemo, useState } from "react"
import { useRouterState } from "@tanstack/react-router"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { usePrefs } from "@/lib/prefs"
import { useSavingsData } from "@/lib/savings-data"
import { weekAround, marksForDate } from "@/lib/calendar-events"
import { todayISO } from "@/lib/finance"
import { cn } from "@/lib/utils"
import { DayEventList } from "@/components/MonthCalendar"

/** Sticky week + day detail above the quick-action bar — homepage only. */
export function HomeCalendarDock() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const { t, lang } = usePrefs()
  const { goals, txs, settings } = useSavingsData()

  const today = todayISO()
  const [selected, setSelected] = useState(today)
  const [weekAnchor, setWeekAnchor] = useState(today)

  const week = useMemo(() => weekAround(weekAnchor), [weekAnchor])

  const selectedMarks = useMemo(
    () => marksForDate(selected, goals, txs, settings, lang),
    [selected, goals, txs, settings, lang],
  )

  if (pathname !== "/") return null

  function shiftWeek(delta: number) {
    const [y, m, d] = weekAnchor.split("-").map(Number)
    const dt = new Date(y, m - 1, d + delta * 7)
    const iso = todayISO(dt)
    setWeekAnchor(iso)
    if (!week.includes(selected)) setSelected(iso)
  }

  return (
    <div
      className="fixed inset-x-0 bottom-[calc(9.25rem+env(safe-area-inset-bottom))] z-30 border-t bg-background/95 px-4 pt-2 pb-1 backdrop-blur"
      aria-label={t.calendarDockTitle}
    >
      <div className="mx-auto w-full max-w-md">
        <div className="mb-1 flex items-center justify-between gap-2">
          <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => shiftWeek(-1)} aria-label={t.calendarPrevWeek}>
            <ChevronLeft className="size-4" />
          </Button>
          <p className="min-w-0 flex-1 truncate text-center text-xs font-medium text-foreground">
            {selected === today ? t.today : selected}
            {selectedMarks.length > 0 ? ` · ${selectedMarks[0].label}` : ""}
          </p>
          <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => shiftWeek(1)} aria-label={t.calendarNextWeek}>
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {week.map((iso) => {
            const marks = marksForDate(iso, goals, txs, settings, lang)
            const dom = Number(iso.slice(8, 10))
            const isToday = iso === today
            const isSelected = iso === selected
            const hasPay = marks.some((m) => m.type === "payday")
            const hasFest = marks.some((m) => m.type === "festival")
            const hasTrip = marks.some((m) => m.type === "trip")
            return (
              <button
                key={iso}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setSelected(iso)}
                className={cn(
                  "flex h-10 flex-col items-center justify-center rounded-xl text-[11px] font-semibold tabular-nums",
                  isSelected && "bg-muted-foreground/25 text-foreground ring-1 ring-border",
                  !isSelected && isToday && "ring-1 ring-border bg-muted/70",
                  !isSelected && !isToday && "bg-muted/50 text-muted-foreground",
                )}
              >
                {dom}
                <span className="mt-0.5 flex h-1 gap-0.5">
                  {hasPay && <span className="size-1 rounded-full bg-foreground/50" />}
                  {hasFest && <span className="size-1 rounded-full bg-destructive" />}
                  {hasTrip && <span className="size-1 rounded-full bg-secondary" />}
                </span>
              </button>
            )
          })}
        </div>

        <div className="mt-2 max-h-16 overflow-y-auto border-t border-border/60 pt-2">
          <DayEventList marks={selectedMarks} />
        </div>
      </div>
    </div>
  )
}