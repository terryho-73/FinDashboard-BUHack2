import { JAR_HEX, money, type Goal } from "@/lib/finance"

// Circular progress for a jar. Percentage stays visible in privacy mode.
export function ProgressRing({ value, color, size = 56 }: { value: number; color: Goal["color"]; size?: number }) {
  const r = (size - 8) / 2
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(1, value))
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity={0.12} strokeWidth={6} className="text-foreground" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={JAR_HEX[color]}
        strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct)}
        style={{ transition: "stroke-dashoffset 600ms ease" }}
      />
    </svg>
  )
}

// Net savings growth: cumulative saved over the last months.
export function NetLine({ points, labels, hidden }: { points: number[]; labels: string[]; hidden: boolean }) {
  const W = 300
  const H = 120
  const pad = 8
  const max = Math.max(1, ...points)
  const xs = points.map((_, i) => pad + (i * (W - pad * 2)) / Math.max(1, points.length - 1))
  const ys = points.map((p) => H - pad - (p / max) * (H - pad * 2 - 8))
  const d = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ")
  const area = `${d} L${xs[xs.length - 1].toFixed(1)},${H - pad} L${xs[0].toFixed(1)},${H - pad} Z`
  const last = points[points.length - 1] ?? 0
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-xs text-muted-foreground">Cumulative</span>
        <span className="text-sm font-semibold tabular-nums">{money(last, hidden)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Net savings growth">
        <defs>
          <linearGradient id="netfill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#netfill)" />
        <path d={d} fill="none" stroke="#10b981" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {xs.map((x, i) => (
          <circle key={i} cx={x} cy={ys[i]} r={3} fill="#10b981" />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        {labels.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
    </div>
  )
}

// Horizontal bars: spending by category this month.
export function CategoryBars({
  rows,
  hidden,
}: {
  rows: { label: string; value: number }[]
  hidden: boolean
}) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r.label} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="min-w-0 truncate">{r.label}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">{money(r.value, hidden)}</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500"
              style={{ width: `${(r.value / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

// Income vs expenses vs saved this month.
export function FlowBars({
  rows,
  hidden,
}: {
  rows: { label: string; value: number; color: string }[]
  hidden: boolean
}) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <div className="flex flex-col gap-3">
      {rows.map((r) => (
        <div key={r.label} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between text-sm">
            <span>{r.label}</span>
            <span className="tabular-nums font-medium">{money(r.value, hidden)}</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${(r.value / max) * 100}%`, backgroundColor: r.color }} />
          </div>
        </div>
      ))}
    </div>
  )
}
