import { useRef, useState } from "react"
import { CheckCircle2, Loader2, Mic, Square, Trash2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SheetShell, type SheetProps } from "@/components/QuickSheets"
import { usePrefs } from "@/lib/prefs-context"
import { format } from "@/lib/i18n"
import { CHANNELS, EXPENSE_CATS, formatDays, goalDelayDays, money, todayISO, type Goal, type Tx } from "@/lib/finance"
import { LlmUnavailable, parseExpenses, type ParsedExpense } from "@/lib/llm"
import { VOICE_LANGS, loadVoiceLang, saveVoiceLang, useSpeech } from "@/lib/speech"
import { cn } from "@/lib/utils"

type Props = SheetProps & {
  /** Safe-to-spend today, recomputed by the dashboard after each save. */
  safeToday: number
  /** Saving pace (HK$/day) used to turn a spend into goal delay. */
  pacePerDay: number
  focusGoal: Goal | null
  onOpenForm: () => void
}

type Phase = "input" | "parsing" | "review" | "saved"

export function QuickLogSheet(props: Props) {
  const { t, lang, hidden } = usePrefs()
  const { api } = props
  const [text, setText] = useState("")
  const [items, setItems] = useState<ParsedExpense[]>([])
  const [phase, setPhase] = useState<Phase>("input")
  const [error, setError] = useState<string | null>(null)
  const [savedTotal, setSavedTotal] = useState(0)
  const [saving, setSaving] = useState(false)
  const [voiceLang, setVoiceLang] = useState(() => loadVoiceLang(lang))
  const abortRef = useRef<AbortController | null>(null)

  async function parse(input: string) {
    const note = input.trim()
    if (!note) return
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setError(null)
    setPhase("parsing")
    try {
      const out = await parseExpenses(note, todayISO(), ctrl.signal)
      if (ctrl.signal.aborted) return
      if (out.length === 0) {
        setError(t.qlNothing)
        setPhase("input")
        return
      }
      setItems(out)
      setPhase("review")
    } catch (e) {
      if ((e as Error).name === "AbortError") return
      setError(e instanceof LlmUnavailable ? t.qlOffline : `${t.qlFailed} (${(e as Error).message.slice(0, 120)})`)
      setPhase("input")
    }
  }

  // Called once when the user taps stop (or after a few seconds of silence)
  // with everything they said, so a pause mid-sentence doesn't cut them off.
  const speech = useSpeech(voiceLang, (heard) => {
    const next = text ? `${text} ${heard}` : heard
    setText(next)
    void parse(next)
  })

  function update(i: number, patch: Partial<ParsedExpense>) {
    setItems((list) => list.map((it, j) => (j === i ? { ...it, ...patch } : it)))
  }

  async function saveAll() {
    const valid = items.filter((i) => i.title.trim() && i.amount > 0)
    if (valid.length === 0 || saving) return
    setSaving(true)
    try {
      for (const it of valid) {
        await api.addTx({
          title: it.title.trim(), amount: it.amount, kind: "expense", category: it.category,
          channel: it.channel, date: it.date, goal_id: "", recurring: false, source: "manual",
        })
      }
      setSavedTotal(valid.reduce((s, i) => s + i.amount, 0))
      setPhase("saved")
    } finally {
      setSaving(false)
    }
  }

  function reset() {
    abortRef.current?.abort()
    speech.cancel()
    setText("")
    setItems([])
    setError(null)
    setPhase("input")
  }

  function onOpenChange(v: boolean) {
    if (!v) reset()
    props.onOpenChange(v)
  }

  const delay = goalDelayDays(savedTotal, props.pacePerDay)

  return (
    <SheetShell {...props} onOpenChange={onOpenChange} title={t.qlTitle} hint={t.qlHint}>
      {phase === "saved" ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <CheckCircle2 className="size-12 text-primary" aria-hidden="true" />
          <p className="text-xl font-semibold">{format(t.qlLogged, { amount: money(savedTotal, hidden) })}</p>
          <p className="text-sm text-muted-foreground">{format(t.qlSafe, { amount: money(props.safeToday, hidden) })}</p>
          {props.focusGoal && delay !== null && (
            <p className="rounded-2xl bg-muted/60 px-4 py-2.5 text-sm">
              {props.focusGoal.emoji}{" "}
              {format(t.goalCostPush, { goal: props.focusGoal.name, days: formatDays(delay, lang) })}
            </p>
          )}
          <div className="mt-2 grid w-full grid-cols-2 gap-2">
            <Button variant="secondary" className="h-11" onClick={reset}>{t.qlAnother}</Button>
            <Button className="h-11" onClick={() => onOpenChange(false)}>{t.qlDone}</Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col items-center gap-2">
            <Button
              type="button"
              size="icon"
              disabled={!speech.supported || phase === "parsing"}
              onClick={speech.listening ? speech.stop : speech.start}
              aria-label={speech.listening ? t.qlStop : t.qlSpeak}
              aria-pressed={speech.listening}
              className={cn("size-20 rounded-full shadow-sm", speech.listening && "animate-pulse bg-destructive text-primary-foreground hover:bg-destructive")}
            >
              {speech.listening ? <Square className="size-7" /> : <Mic className="size-8" />}
            </Button>
            <p className="min-h-5 text-center text-sm text-muted-foreground">
              {!speech.supported
                ? t.qlNoVoice
                : speech.listening
                  ? t.qlListening
                  : t.qlSpeak}
            </p>
            {speech.supported && (
              <Select
                value={voiceLang}
                onValueChange={(v) => {
                  if (!v) return
                  setVoiceLang(v)
                  saveVoiceLang(v)
                }}
                items={VOICE_LANGS.map((l) => ({ value: l.tag, label: l.label }))}
                disabled={speech.listening}
              >
                <SelectTrigger size="sm" className="min-w-36" aria-label={t.qlVoiceLang}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VOICE_LANGS.map((l) => <SelectItem key={l.tag} value={l.tag}>{l.label}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Textarea
              value={speech.listening ? [text, speech.live].filter(Boolean).join(" ") : text}
              readOnly={speech.listening}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  void parse(text)
                }
              }}
              placeholder={t.qlPlaceholder}
              aria-label={t.qlPlaceholder}
              rows={2}
              maxLength={300}
            />
            {phase !== "review" && (
              <Button onClick={() => parse(text)} disabled={!text.trim() || phase === "parsing"} className="h-11 gap-2">
                {phase === "parsing" ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                {phase === "parsing" ? t.qlParsing : t.qlParse}
              </Button>
            )}
            {error && <p role="alert" className="rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          </div>

          {phase === "review" && (
            <div className="flex flex-col gap-3">
              <ul className="flex flex-col gap-3">
                {items.map((it, i) => (
                  <li key={i} className="flex flex-col gap-2 rounded-2xl border bg-card p-3">
                    <div className="grid grid-cols-[1fr_6.5rem_auto] gap-2">
                      <Input value={it.title} onChange={(e) => update(i, { title: e.target.value })} aria-label={t.titleLabel} maxLength={60} />
                      <Input
                        inputMode="decimal"
                        value={String(it.amount)}
                        onChange={(e) => {
                          let cleaned = e.target.value.replace(/[^\d.]/g, "")
                          const dot = cleaned.indexOf(".")
                          if (dot !== -1) {
                            cleaned =
                              cleaned.slice(0, dot + 1) +
                              cleaned.slice(dot + 1).replace(/\./g, "").slice(0, 2)
                          }
                          update(i, { amount: Number(cleaned) || 0 })
                        }}
                        aria-label={t.amountLabel}
                        className="tabular-nums"
                      />
                      <Button size="icon" variant="ghost" aria-label={t.delete} onClick={() => setItems((l) => l.filter((_, j) => j !== i))}>
                        <Trash2 className="size-4 text-muted-foreground" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Select
                        value={it.category}
                        onValueChange={(v) => v && update(i, { category: v as ParsedExpense["category"] })}
                        items={EXPENSE_CATS.map((c) => ({ value: c, label: t.cats[c] }))}
                      >
                        <SelectTrigger size="sm" className="w-full" aria-label={t.categoryLabel}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {EXPENSE_CATS.map((c) => <SelectItem key={c} value={c}>{t.cats[c]}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Select
                        value={it.channel}
                        onValueChange={(v) => v && update(i, { channel: v as Tx["channel"] })}
                        items={CHANNELS.map((c) => ({ value: c, label: t.channels[c] }))}
                      >
                        <SelectTrigger size="sm" className="w-full" aria-label={t.channelLabel}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CHANNELS.map((c) => <SelectItem key={c} value={c}>{t.channels[c]}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    {it.date !== todayISO() && <p className="text-xs text-muted-foreground">{it.date}</p>}
                  </li>
                ))}
              </ul>
              <div className="grid grid-cols-[auto_1fr] gap-2">
                <Button variant="secondary" className="h-11" onClick={() => parse(text)}>{t.qlRetry}</Button>
                <Button className="h-11 gap-2" onClick={saveAll} disabled={items.length === 0 || saving}>
                  {saving && <Loader2 className="size-4 animate-spin" />}
                  {format(t.qlSave, { n: items.length, amount: money(items.reduce((s, i) => s + i.amount, 0), hidden) })}
                </Button>
              </div>
            </div>
          )}

          <button type="button" onClick={() => { onOpenChange(false); props.onOpenForm() }} className="text-center text-xs text-muted-foreground underline underline-offset-4">
            {t.qlForm}
          </button>
        </>
      )}
    </SheetShell>
  )
}
