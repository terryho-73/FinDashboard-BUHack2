import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { usePrefs } from "@/lib/prefs"
import { buildMonthMarks, addMonths, type DayMark, type DayMarkType } from "@/lib/calendar-events"
import { todayISO } from "@/lib/finance"
import type { Goal, Settings, Tx } from "@/lib/finance"
import { cn } from "@/lib/utils"

const MARK_DOT: Record<DayMarkType, string> = {
  payday: "bg-primary",
  festival: "bg-destructive",
  trip: "bg-secondary",
  bill: "bg-muted-foreground",
}

type Props = {
  goals: Goal[]
  txs: Tx[]
  settings: Settings | null
  selected: string
  onSelect: (iso: string) => void
  year: number
  monthIndex0: number
  onMonthChange: (year: number, monthIndex0: number) => void
  compact?: boolean
  id?: string
}

export function MonthCalendar({
  goals,
  txs,
  settings,
  selected,
  onSelect,
  year,
  monthIndex0,
  onMonthChange,
  compact,
  id,
}: Props) {
  const { t, lang } = usePrefs()
  const today = todayISO()

  const marks = buildMonthMarks(year, monthIndex0, { goals, txs, settings, lang })

  const startPad = new Date(year, monthIndex0, 1).getDay()
  const dim = new Date(year, monthIndex0 + 1, 0).getDate()

  const cells: (string | null)[] = []
  for (let i = 0; i < startPad; i++) cells.push(null)
  for (let d = 1; d <= dim; d++) {
    cells.push(`${year}-${String(monthIndex0 + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`)
  }

  const monthLabel = new Date(year, monthIndex0, 1).toLocaleString(lang === "zh" ? "zh-HK" : "en", {
    month: "long",
    year: "numeric",
  })

  const weekdays =
    lang === "zh" ? ["日", "一", "二", "三", "四", "五", "六"] : ["Su", "M", "T", "W", "T", "F", "Sa"]

  function shiftMonth(delta: number) {
    const n = addMonths(year, monthIndex0, delta)
    onMonthChange(n.year, n.monthIndex0)
  }

  return (
    <section id={id} className="flex flex-col gap-3" aria-label={t.calendarTitle}>
      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => shiftMonth(-1)} aria-label={t.calendarPrev}>
          <ChevronLeft className="size-4" />
        </Button>
        <p className="min-w-0 truncate text-center text-sm font-semibold">{monthLabel}</p>
        <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => shiftMonth(1)} aria-label={t.calendarNext}>
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-muted-foreground">
        {weekdays.map((w, i) => (
          <span key={`${w}-${i}`}>{w}</span>
        ))}
      </div>

      <div className={cn("grid grid-cols-7 gap-1", compact ? "gap-0.5" : "gap-1.5")}>
        {cells.map((iso, idx) =>
          iso ? (
            <DayCell
              key={iso}
              iso={iso}
              day={Number(iso.slice(8, 10))}
              marks={marks[iso] ?? []}
              selected={selected === iso}
              today={today === iso}
              compact={compact}
              onSelect={() => onSelect(iso)}
            />
          ) : (
            <div key={`pad-${idx}`} className={cn(compact ? "h-9" : "h-11")} />
          ),
        )}
      </div>

      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        {(Object.keys(MARK_DOT) as DayMarkType[]).map((type) => (
          <li key={type} className="inline-flex items-center gap-1">
            <span className={cn("size-2 rounded-full", MARK_DOT[type])} aria-hidden />
            {t.calendarLegend[type]}
          </li>
        ))}
      </ul>
    </section>
  )
}

function DayCell({
  iso,
  day,
  marks,
  selected,
  today,
  compact,
  onSelect,
}: {
  iso: string
  day: number
  marks: DayMark[]
  selected: boolean
  today: boolean
  compact?: boolean
  onSelect: () => void
}) {
  const types = [...new Set(marks.map((m) => m.type))]

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={iso}
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-transparent transition-colors",
        compact ? "h-9 px-0.5" : "h-11",
        today && "ring-2 ring-ring/50",
        selected && "border-primary bg-primary/15",
        !selected && marks.length > 0 && "bg-muted/40",
        marks.some((m) => m.type === "festival") && !selected && "ring-1 ring-destructive/30",
      )}
    >
      <span
        className={cn(
          "text-xs font-medium tabular-nums",
          today && "text-primary",
          marks.some((m) => m.type === "festival") && "text-destructive",
        )}
      >
        {day}
      </span>
      {marks.length > 0 && (
        <span className="mt-0.5 flex gap-0.5">
          {types.slice(0, 3).map((type) => (
            <span key={type} className={cn("size-1 rounded-full", MARK_DOT[type])} aria-hidden />
          ))}
        </span>
      )}
    </button>
  )
}

export function DayEventList({ marks }: { marks: DayMark[] }) {
  const { t } = usePrefs()
  if (marks.length === 0) {
    return <p className="text-xs text-muted-foreground">{t.calendarNoEvents}</p>
  }
  return (
    <ul className="flex flex-col gap-1.5">
      {marks.map((m, i) => (
        <li
          key={`${m.type}-${m.label}-${i}`}
          className={cn(
            "rounded-lg px-2.5 py-1.5 text-xs",
            m.type === "payday" && "bg-primary/15 text-primary",
            m.type === "festival" && "bg-destructive/10 font-medium text-destructive",
            m.type === "trip" && "bg-secondary text-secondary-foreground",
            m.type === "bill" && "bg-muted text-muted-foreground",
          )}
        >
          {m.label}
        </li>
      ))}
    </ul>
  )
}