import { useState, type ReactNode } from "react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { usePrefs } from "@/lib/prefs"
import { format } from "@/lib/i18n"
import {
  CHANNELS,
  EXPENSE_CATS,
  JAR_COLORS,
  JAR_EMOJIS,
  JAR_HEX,
  spareChange,
  todayISO,
  type Goal,
  type Settings,
  type Tx,
} from "@/lib/finance"
import { cn } from "@/lib/utils"

export type Api = {
  goals: Goal[]
  settings: Settings | null
  addTx: (t: Omit<Tx, "id" | "created_at">) => Promise<unknown>
  addGoal: (g: Omit<Goal, "id">) => Promise<unknown>
  removeGoal: (id: string) => Promise<unknown>
  removeTx: (id: string) => Promise<unknown>
  saveSettings: (s: Omit<Settings, "id">) => Promise<unknown>
}

type SheetProps = { open: boolean; onOpenChange: (v: boolean) => void; api: Api }

// ── shared bits ──────────────────────────────────────────────────────────────

function SheetShell({ open, onOpenChange, title, hint, children }: SheetProps & { title: string; hint: string; children: ReactNode }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="max-h-[92svh] overflow-y-auto rounded-t-3xl p-0"
      >
        <div className="mx-auto w-full max-w-md px-5 pt-5 pb-8">
          <SheetHeader className="p-0">
            <SheetTitle className="text-lg">{title}</SheetTitle>
            <SheetDescription>{hint}</SheetDescription>
          </SheetHeader>
          <div className="mt-5 flex flex-col gap-5">{children}</div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "min-h-10 rounded-full border px-3.5 text-sm transition-colors active:scale-[0.97]",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-muted/50 text-foreground hover:bg-accent",
      )}
    >
      {children}
    </button>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 min-w-0">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
    </div>
  )
}

function ChipRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>
}

function parseAmount(v: string) {
  const n = Number(v.replace(/,/g, ""))
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0
}

// ── Log expense (with round-up) ──────────────────────────────────────────────

export function ExpenseSheet(props: SheetProps) {
  const { t } = usePrefs()
  const { api } = props
  const [title, setTitle] = useState("")
  const [amountText, setAmountText] = useState("")
  const [category, setCategory] = useState<(typeof EXPENSE_CATS)[number]>("food")
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]>("octopus")
  const [date, setDate] = useState(todayISO())
  const [recurring, setRecurring] = useState(false)
  const [jarId, setJarId] = useState<string>(api.goals[0]?.id ?? "")
  const [busy, setBusy] = useState(false)

  const amount = parseAmount(amountText)
  const roundTo = api.settings?.round_to ?? 10
  const spare = amount > 0 ? spareChange(amount, roundTo) : 0
  const roundOn = !!api.settings?.roundup_on && spare > 0 && !!jarId

  async function submit() {
    if (!title.trim() || amount <= 0 || busy) return
    setBusy(true)
    try {
      await api.addTx({
        title: title.trim(), amount, kind: "expense", category, channel, date,
        goal_id: "", recurring, source: "manual",
      })
      if (roundOn) {
        await api.addTx({
          title: "Round-up", amount: spare, kind: "saving", category: "saving", channel: "other",
          date, goal_id: jarId, recurring: false, source: "roundup",
        })
      }
      setTitle("")
      setAmountText("")
      setRecurring(false)
      props.onOpenChange(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <SheetShell {...props} title={t.logTitle} hint={t.logHint}>
      <Field label={t.titleLabel}>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t.titlePlaceholder} maxLength={60} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t.amountLabel}>
          <Input inputMode="decimal" value={amountText} onChange={(e) => setAmountText(e.target.value)} placeholder="38" />
        </Field>
        <Field label={t.dateLabel}>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
      <Field label={t.categoryLabel}>
        <ChipRow>
          {EXPENSE_CATS.map((c) => (
            <Chip key={c} active={category === c} onClick={() => setCategory(c)}>{t.cats[c]}</Chip>
          ))}
        </ChipRow>
      </Field>
      <Field label={t.channelLabel}>
        <ChipRow>
          {CHANNELS.map((c) => (
            <Chip key={c} active={channel === c} onClick={() => setChannel(c)}>{t.channels[c]}</Chip>
          ))}
        </ChipRow>
      </Field>
      <div className="flex items-center justify-between gap-4 rounded-2xl bg-muted/50 p-4">
        <Label className="text-sm">{t.recurringLabel}</Label>
        <Switch checked={recurring} onCheckedChange={setRecurring} aria-label={t.recurringLabel} />
      </div>
      {api.settings?.roundup_on && api.goals.length > 0 && (
        <Field label={`${t.roundupToJar} · HK$${roundTo}`}>
          <ChipRow>
            {api.goals.map((g) => (
              <Chip key={g.id} active={jarId === g.id} onClick={() => setJarId(g.id)}>
                {g.emoji} {g.name}
              </Chip>
            ))}
          </ChipRow>
          {roundOn && (
            <p className="text-xs text-muted-foreground">
              {format(t.roundupAdded, { amount: `HK$${spare}` })}
            </p>
          )}
        </Field>
      )}
      <Button onClick={submit} disabled={!title.trim() || amount <= 0 || busy} className="h-11 w-full text-base">
        {t.addExpense}
      </Button>
    </SheetShell>
  )
}

// ── Top up a jar ─────────────────────────────────────────────────────────────

export function TopUpSheet(props: SheetProps & { initialJarId?: string }) {
  const { t } = usePrefs()
  const { api } = props
  const [jarId, setJarId] = useState(props.initialJarId ?? api.goals[0]?.id ?? "")
  const [amountText, setAmountText] = useState("")
  const [busy, setBusy] = useState(false)
  const amount = parseAmount(amountText)
  const jar = api.goals.find((g) => g.id === jarId)

  async function submit() {
    if (!jar || amount <= 0 || busy) return
    setBusy(true)
    try {
      await api.addTx({
        title: jar.name, amount, kind: "saving", category: "saving", channel: "bank",
        date: todayISO(), goal_id: jar.id, recurring: false, source: "topup",
      })
      setAmountText("")
      props.onOpenChange(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <SheetShell {...props} title={t.topUpTitle} hint={t.topUpHint}>
      {api.goals.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.noGoals}</p>
      ) : (
        <>
          <Field label={t.chooseJar}>
            <ChipRow>
              {api.goals.map((g) => (
                <Chip key={g.id} active={jarId === g.id} onClick={() => setJarId(g.id)}>
                  {g.emoji} {g.name}
                </Chip>
              ))}
            </ChipRow>
          </Field>
          <Field label={t.amountLabel}>
            <Input inputMode="decimal" value={amountText} onChange={(e) => setAmountText(e.target.value)} placeholder="500" />
          </Field>
          <Button onClick={submit} disabled={amount <= 0 || busy} className="h-11 w-full text-base">
            {t.addTopUp}
          </Button>
        </>
      )}
    </SheetShell>
  )
}

// ── Payday auto-split ────────────────────────────────────────────────────────

export function PaydaySheet(props: SheetProps) {
  const { t } = usePrefs()
  const { api } = props
  const [amountText, setAmountText] = useState(String(api.settings?.monthly_income || ""))
  const [busy, setBusy] = useState(false)
  const pay = parseAmount(amountText)
  const pct = api.settings?.save_pct ?? 0
  const toSave = Math.round(((pay * pct) / 100) * 100) / 100
  const perJar = api.goals.length ? Math.floor((toSave / api.goals.length) * 100) / 100 : 0
  const canSplit = api.goals.length > 0 && toSave > 0

  async function submit() {
    if (pay <= 0 || busy) return
    setBusy(true)
    try {
      const date = todayISO()
      await api.addTx({
        title: "Payday", amount: pay, kind: "income", category: "income", channel: "fps",
        date, goal_id: "", recurring: false, source: "payday",
      })
      if (canSplit) {
        for (const g of api.goals) {
          await api.addTx({
            title: "Payday auto-split", amount: perJar, kind: "saving", category: "saving", channel: "bank",
            date, goal_id: g.id, recurring: false, source: "payday",
          })
        }
      }
      props.onOpenChange(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <SheetShell {...props} title={t.paydayTitle} hint={t.paydayHint}>
      <Field label={t.paydayAmount}>
        <Input inputMode="decimal" value={amountText} onChange={(e) => setAmountText(e.target.value)} />
      </Field>
      <div className="rounded-2xl bg-muted/50 p-4 text-sm">
        {canSplit ? (
          <p>
            {format(t.paydayPreview, { amount: `HK$${toSave.toLocaleString("en-HK")}` })} ({pct}%)
          </p>
        ) : (
          <p className="text-muted-foreground">{t.paydayNoJar}</p>
        )}
      </div>
      <Button onClick={submit} disabled={pay <= 0 || busy} className="h-11 w-full text-base">
        {t.addPayday}
      </Button>
    </SheetShell>
  )
}

// ── New jar ──────────────────────────────────────────────────────────────────

export function GoalSheet(props: SheetProps) {
  const { t } = usePrefs()
  const { api } = props
  const [name, setName] = useState("")
  const [targetText, setTargetText] = useState("")
  const [emoji, setEmoji] = useState(JAR_EMOJIS[0])
  const [color, setColor] = useState<Goal["color"]>("sky")
  const [busy, setBusy] = useState(false)
  const target = parseAmount(targetText)

  async function submit() {
    if (!name.trim() || target <= 0 || busy) return
    setBusy(true)
    try {
      await api.addGoal({ name: name.trim(), target, emoji, color })
      setName("")
      setTargetText("")
      props.onOpenChange(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <SheetShell {...props} title={t.newGoalTitle} hint={t.newGoalHint}>
      <Field label={t.goalName}>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.goalNamePlaceholder} maxLength={40} />
      </Field>
      <Field label={t.goalTarget}>
        <Input inputMode="decimal" value={targetText} onChange={(e) => setTargetText(e.target.value)} placeholder="15000" />
      </Field>
      <Field label={t.goalEmoji}>
        <ChipRow>
          {JAR_EMOJIS.map((e) => (
            <Chip key={e} active={emoji === e} onClick={() => setEmoji(e)}>{e}</Chip>
          ))}
        </ChipRow>
      </Field>
      <Field label={t.goalColor}>
        <ChipRow>
          {JAR_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              aria-pressed={color === c}
              onClick={() => setColor(c)}
              className={cn("size-9 rounded-full border-2", color === c ? "border-foreground" : "border-transparent")}
              style={{ backgroundColor: JAR_HEX[c] }}
            />
          ))}
        </ChipRow>
      </Field>
      <Button onClick={submit} disabled={!name.trim() || target <= 0 || busy} className="h-11 w-full text-base">
        {t.addGoal}
      </Button>
    </SheetShell>
  )
}

// ── Settings (budget + round-up) ─────────────────────────────────────────────

export function SettingsSheet(props: SheetProps & { onClear: () => void }) {
  const { t } = usePrefs()
  const { api } = props
  const s = api.settings
  const [vals, setVals] = useState(() => ({
    monthly_income: String(s?.monthly_income ?? ""),
    rent: String(s?.rent ?? ""),
    utilities: String(s?.utilities ?? ""),
    mpf: String(s?.mpf ?? ""),
    save_pct: String(s?.save_pct ?? "20"),
  }))
  const [roundTo, setRoundTo] = useState<number>(s?.round_to ?? 10)
  const [roundupOn, setRoundupOn] = useState<boolean>(s?.roundup_on ?? true)
  const [busy, setBusy] = useState(false)
  const num = (k: keyof typeof vals) => Math.max(0, Number(vals[k].replace(/,/g, "")) || 0)

  async function submit() {
    setBusy(true)
    try {
      await api.saveSettings({
        monthly_income: num("monthly_income"),
        rent: num("rent"),
        utilities: num("utilities"),
        mpf: num("mpf"),
        save_pct: Math.min(100, num("save_pct")),
        round_to: roundTo,
        roundup_on: roundupOn,
      })
      props.onOpenChange(false)
    } finally {
      setBusy(false)
    }
  }

  const fields: { k: keyof typeof vals; label: string }[] = [
    { k: "monthly_income", label: t.monthlyIncome },
    { k: "rent", label: t.rent },
    { k: "utilities", label: t.utilities },
    { k: "mpf", label: t.mpf },
    { k: "save_pct", label: t.savePct },
  ]

  return (
    <SheetShell {...props} title={t.settingsTitle} hint={t.settingsHint}>
      <div className="grid grid-cols-2 gap-3">
        {fields.map((f) => (
          <Field key={f.k} label={f.label}>
            <Input
              inputMode="decimal"
              value={vals[f.k]}
              onChange={(e) => setVals((v) => ({ ...v, [f.k]: e.target.value }))}
            />
          </Field>
        ))}
      </div>
      <div className="flex items-center justify-between gap-4 rounded-2xl bg-muted/50 p-4">
        <div className="min-w-0">
          <Label className="text-sm">{t.roundupOn}</Label>
          <p className="text-xs text-muted-foreground">{t.roundupHint}</p>
        </div>
        <Switch checked={roundupOn} onCheckedChange={setRoundupOn} aria-label={t.roundupOn} />
      </div>
      <Field label={t.roundTo}>
        <ChipRow>
          {[10, 50].map((n) => (
            <Chip key={n} active={roundTo === n} onClick={() => setRoundTo(n)}>HK${n}</Chip>
          ))}
        </ChipRow>
      </Field>
      <Button onClick={submit} disabled={busy} className="h-11 w-full text-base">{t.save}</Button>
      <Button
        variant="ghost"
        onClick={() => {
          if (window.confirm(t.clearConfirm)) props.onClear()
        }}
        className="w-full text-destructive"
      >
        {t.clearAll}
      </Button>
    </SheetShell>
  )
}
