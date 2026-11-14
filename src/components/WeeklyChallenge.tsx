import { useMemo, useState } from "react"
import { Flame, Share2, Trophy } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { usePrefs } from "@/lib/prefs-context"
import { format } from "@/lib/i18n"
import {
  CHALLENGES,
  challengeStatus,
  goalSaved,
  money,
  weekRecap,
  weekStart,
  type ChallengeId,
  type Goal,
  type Habit,
  type Tx,
} from "@/lib/finance"
import { cn } from "@/lib/utils"

const KEY = "pocketgoals.challenge"

type Stored = { id: ChallengeId; week: string }

// The chosen challenge is a per-device preference for the current week only,
// so it lives in localStorage; progress itself is derived from transactions.
function load(): Stored | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Stored) : null
  } catch {
    return null
  }
}

function persist(v: Stored | null) {
  try {
    if (v) localStorage.setItem(KEY, JSON.stringify(v))
    else localStorage.removeItem(KEY)
  } catch {
    /* storage blocked: challenge just won't survive a reload */
  }
}

export function WeeklyChallenge(props: { txs: Tx[]; today: string; habits: Habit[]; streak: number; focusGoal: Goal | null }) {
  const { t, hidden } = usePrefs()
  const { txs, today, habits } = props
  const week = weekStart(today)
  const [stored, setStored] = useState<Stored | null>(load)
  const [shared, setShared] = useState(false)
  const active = stored && stored.week === week ? stored.id : null

  const hasHabit = habits.length > 0
  const available = useMemo(() => CHALLENGES.filter((id) => id !== "habit_half" || hasHabit), [hasHabit])
  const statuses = useMemo(
    () => Object.fromEntries(available.map((id) => [id, challengeStatus(id, txs, today, habits)])) as Record<ChallengeId, ReturnType<typeof challengeStatus>>,
    [available, txs, today, habits],
  )
  const recap = useMemo(() => weekRecap(txs, today), [txs, today])

  function choose(id: ChallengeId | null) {
    const v = id ? { id, week } : null
    setStored(v)
    persist(v)
  }

  function describe(id: ChallengeId) {
    const s = statuses[id]
    const c = t.challenges[id]
    const vars = { limit: id === "food_cut" ? money(s.limit, hidden) : s.limit, habit: s.habit ?? "" }
    return { name: format(c.name, vars), desc: format(c.desc, vars) }
  }

  const goal = props.focusGoal
  const goalPct = goal && goal.target > 0 ? Math.min(100, Math.round((goalSaved(goal.id, txs) / goal.target) * 100)) : null

  async function share() {
    const lines = [
      format(t.recapShareSaved, { amount: money(recap.saved) }),
      recap.vsUsual > 0 ? format(t.recapShareLess, { amount: money(recap.vsUsual) }) : null,
      props.streak > 0 ? format(t.recapShareStreak, { n: props.streak }) : null,
      active && statuses[active].state === "done" ? `🏆 ${describe(active).name}` : null,
      goal && goalPct !== null ? `${goal.emoji} ${goal.name}: ${goalPct}%` : null,
    ].filter(Boolean)
    const text = `${t.recapShareTitle}\n${lines.join("\n")}`
    try {
      if (navigator.share) await navigator.share({ text })
      else {
        await navigator.clipboard.writeText(text)
        setShared(true)
        setTimeout(() => setShared(false), 2000)
      }
    } catch {
      /* user cancelled the share sheet */
    }
  }

  const st = active ? statuses[active] : null

  return (
    <Card className="gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{t.weekTitle}</h2>
          <p className="text-xs text-muted-foreground">{active ? t.weekHintActive : t.weekHint}</p>
        </div>
        {active && (
          <Button variant="ghost" size="sm" className="h-8 shrink-0 text-xs" onClick={() => choose(null)}>
            {t.challengeChange}
          </Button>
        )}
      </div>

      {!active ? (
        <ul className="grid grid-cols-2 gap-2">
          {available.map((id) => {
            const d = describe(id)
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => choose(id)}
                  className="flex h-full w-full flex-col gap-1 rounded-2xl border bg-muted/40 p-3 text-left transition-colors hover:bg-accent active:scale-[0.98]"
                >
                  <span className="text-sm font-medium">{d.name}</span>
                  <span className="text-xs text-muted-foreground">{d.desc}</span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : st && (
        <div
          className={cn(
            "flex flex-col gap-3 rounded-2xl p-4",
            st.state === "failed" ? "bg-destructive/10" : "bg-primary/10",
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold">{describe(active).name}</p>
              <p className="text-xs text-muted-foreground">{describe(active).desc}</p>
            </div>
            <Badge variant={st.state === "failed" ? "destructive" : st.state === "done" ? "default" : "secondary"} className="shrink-0">
              {st.state === "done" && <Trophy className="size-3" />}
              {st.state === "done" ? t.challengeDone : st.state === "failed" ? t.challengeFailed : t.challengeOnTrack}
            </Badge>
          </div>
          <Progress value={Math.round(st.progress * 100)} aria-label={describe(active).name} />
          <p className="text-xs tabular-nums text-muted-foreground">
            {active === "save3"
              ? `${st.value} / ${st.limit}`
              : active === "habit_half"
                ? `${st.value} / ${st.limit}×`
                : active === "food_cut"
                  ? `${money(st.value, hidden)} / ${money(st.limit, hidden)}`
                  : money(st.value, hidden)}
            {st.kept > 0 && <> · {format(t.challengeKept, { amount: money(st.kept, hidden) })}</>}
          </p>
        </div>
      )}

      {/* Recap: this week so far, shareable */}
      <div className="grid grid-cols-3 gap-2 border-t pt-4 text-center">
        <div className="rounded-2xl bg-muted/50 p-2.5">
          <p className="text-xs text-muted-foreground">{t.recapSaved}</p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums">{money(recap.saved, hidden)}</p>
        </div>
        <div className="rounded-2xl bg-muted/50 p-2.5">
          <p className="text-xs text-muted-foreground">{t.recapVsUsual}</p>
          <p className={cn("mt-0.5 text-sm font-semibold tabular-nums", recap.vsUsual > 0 ? "text-primary" : recap.vsUsual < 0 && "text-destructive")}>
            {recap.vsUsual >= 0 ? "−" : "+"}{money(Math.abs(recap.vsUsual), hidden)}
          </p>
        </div>
        <div className="rounded-2xl bg-muted/50 p-2.5">
          <p className="text-xs text-muted-foreground">{t.recapStreak}</p>
          <p className="mt-0.5 inline-flex items-center gap-1 text-sm font-semibold tabular-nums">
            <Flame className="size-3.5" aria-hidden="true" />
            {props.streak}
          </p>
        </div>
      </div>
      <Button variant="outline" className="h-10 gap-2" onClick={share}>
        <Share2 className="size-4" /> {shared ? t.recapCopied : t.recapShare}
      </Button>
    </Card>
  )
}
