import { todayISO, type Goal, type Settings, type Tx } from "@/lib/finance"
import { getHkPublicHoliday } from "@/lib/hk-public-holidays"
import type { Lang } from "@/lib/i18n"

export type DayMarkType = "payday" | "festival" | "trip" | "bill"

export type DayMark = {
  type: DayMarkType
  label: string
}

function monthKey(year: number, monthIndex0: number) {
  return `${year}-${String(monthIndex0 + 1).padStart(2, "0")}`
}

function daysInMonth(year: number, monthIndex0: number) {
  return new Date(year, monthIndex0 + 1, 0).getDate()
}

function parseLocalDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y, m - 1, d)
}

function isSunday(iso: string): boolean {
  return parseLocalDate(iso).getDay() === 0
}

/** HK banks: pay hitting Sunday is shown on Monday in the calendar. */
export function adjustPaydayIso(iso: string): string {
  if (!isSunday(iso)) return iso
  const [y, m, d] = iso.split("-").map(Number)
  return todayISO(new Date(y, m - 1, d + 1))
}

export function expectedPaydayIso(year: number, monthIndex0: number, dayOfMonth: number): string {
  const iso = `${monthKey(year, monthIndex0)}-${String(dayOfMonth).padStart(2, "0")}`
  return adjustPaydayIso(iso)
}

function sundayHolidayLabel(lang: Lang): DayMark {
  return {
    type: "festival",
    label: lang === "zh" ? "星期日（公眾假期）" : "Sunday (public holiday)",
  }
}

function isPaydayTx(tx: Tx): boolean {
  return tx.source === "payday" || (tx.kind === "income" && tx.title.toLowerCase().includes("payday"))
}

function paydayDayFromTxs(txs: Tx[]): number {
  const paydays = txs.filter(isPaydayTx)
  if (paydays.length === 0) return 1
  const counts = new Map<number, number>()
  for (const t of paydays) {
    const adjusted = adjustPaydayIso(t.date)
    const d = Number(adjusted.slice(8, 10))
    if (Number.isFinite(d)) counts.set(d, (counts.get(d) ?? 0) + 1)
  }
  let best = 1
  let n = 0
  for (const [day, c] of counts) {
    if (c > n) {
      n = c
      best = day
    }
  }
  return best
}

export function buildMonthMarks(
  year: number,
  monthIndex0: number,
  opts: {
    goals: Goal[]
    txs: Tx[]
    settings: Settings | null
    lang: Lang
  },
): Record<string, DayMark[]> {
  const { goals, txs, settings, lang } = opts
  const out: Record<string, DayMark[]> = {}
  const push = (iso: string, mark: DayMark) => {
    if (!out[iso]) out[iso] = []
    if (!out[iso].some((m) => m.type === mark.type && m.label === mark.label)) out[iso].push(mark)
  }

  const dim = daysInMonth(year, monthIndex0)
  const paydayDom = paydayDayFromTxs(txs)
  const hasIncome = (settings?.monthly_income ?? 0) > 0 || txs.some((t) => t.kind === "income")

  for (let d = 1; d <= dim; d++) {
    const iso = `${monthKey(year, monthIndex0)}-${String(d).padStart(2, "0")}`

    if (isSunday(iso)) {
      push(iso, sundayHolidayLabel(lang))
    }

    const holiday = getHkPublicHoliday(iso)
    if (holiday) push(iso, { type: "festival", label: lang === "zh" ? holiday.zh : holiday.en })

    if (settings && d === 25) {
      const rent = (settings.rent ?? 0) + (settings.utilities ?? 0)
      if (rent > 0) {
        push(iso, {
          type: "bill",
          label: lang === "zh" ? "租務／雜費" : "Rent & utilities",
        })
      }
    }
  }

  for (const tx of txs) {
    if (!isPaydayTx(tx)) continue
    const display = adjustPaydayIso(tx.date)
    const [ty, tm] = display.split("-").map(Number)
    if (ty === year && tm === monthIndex0 + 1) {
      push(display, { type: "payday", label: lang === "zh" ? "出糧日" : "Payday" })
    }
  }

  if (hasIncome) {
    const expected = expectedPaydayIso(year, monthIndex0, paydayDom)
    const [ey, em] = expected.split("-").map(Number)
    if (ey === year && em === monthIndex0 + 1) {
      push(expected, { type: "payday", label: lang === "zh" ? "預計出糧" : "Expected payday" })
    }
  }

  for (const g of goals) {
    const tripDate = g.target_date?.trim()
    if (!tripDate) continue
    const y = Number(tripDate.slice(0, 4))
    const m = Number(tripDate.slice(5, 7)) - 1
    if (y === year && m === monthIndex0) {
      push(tripDate, {
        type: "trip",
        label: lang === "zh" ? `計劃：${g.name}` : `Plan: ${g.name}`,
      })
    }
  }

  return out
}

export function marksForDate(
  iso: string,
  goals: Goal[],
  txs: Tx[],
  settings: Settings | null,
  lang: Lang,
): DayMark[] {
  const [y, m] = iso.split("-").map(Number)
  const monthMarks = buildMonthMarks(y, m - 1, { goals, txs, settings, lang })
  return monthMarks[iso] ?? []
}

export function weekAround(iso: string): string[] {
  const [y, m, d] = iso.split("-").map(Number)
  const anchor = new Date(y, m - 1, d)
  const day = anchor.getDay()
  const sundayOffset = -day
  const start = new Date(anchor)
  start.setDate(anchor.getDate() + sundayOffset)
  const days: string[] = []
  for (let i = 0; i < 7; i++) {
    const dt = new Date(start)
    dt.setDate(start.getDate() + i)
    days.push(todayISO(dt))
  }
  return days
}

export function addMonths(year: number, monthIndex0: number, delta: number) {
  const d = new Date(year, monthIndex0 + delta, 1)
  return { year: d.getFullYear(), monthIndex0: d.getMonth() }
}