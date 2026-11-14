import React from "react"
import { AbsoluteFill, Audio, Easing, Img, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion"
import rec from "./recording.json"
import { Backdrop, C, Rise, fontFamily, useEnter } from "./ui"

export const FPS = 30
const INTRO = 3.5
const OUTRO = 4.5
const TOTAL = 180
export const TOTAL_FRAMES = TOTAL * FPS
const SLOT = TOTAL - INTRO - OUTRO
const SPEED = rec.duration / SLOT // recording seconds per video second

const W = 390
const H = 844
const SCALE = 1.1
const PHONE_TOP = (1080 - (H + 28) * SCALE) / 2

type Frame = { t: number; f: string }
type Ev = { type: string; t: number; x?: number; y?: number; scale?: number; label?: string }
const frames = rec.frames as Frame[]
const events = rec.events as Ev[]

const frameAt = (t: number) => {
  let lo = 0
  let hi = frames.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (frames[mid].t <= t) lo = mid
    else hi = mid - 1
  }
  return frames[lo].f
}

const ease = Easing.bezier(0.45, 0, 0.2, 1)
const CAM_MOVE = 1.1
/** Camera state (zoom + focus y in screen px), eased between zoom events. */
const camera = (t: number) => {
  let from = { z: 1, y: H / 2 }
  let target = from
  let start = -1
  for (const e of events) {
    if (e.type !== "zoom" || e.t > t) continue
    if (start >= 0) {
      const p = ease(Math.min(1, (e.t - start) / CAM_MOVE))
      from = { z: from.z + (target.z - from.z) * p, y: from.y + (target.y - from.y) * p }
    }
    target = { z: e.scale ?? 1, y: e.y ?? H / 2 }
    start = e.t
  }
  if (start < 0) return from
  const p = ease(Math.min(1, (t - start) / CAM_MOVE))
  return { z: from.z + (target.z - from.z) * p, y: from.y + (target.y - from.y) * p }
}

const CAPTIONS: Record<string, string> = {
  onboarding: "Start with your budget — or just tap Try demo",
  hero: "Total saved, and what's safe to spend today",
  forecast: "A 30-day cash-flow forecast against your safety buffer",
  "purchase-safe": "Test a purchase before you buy it",
  "purchase-goal": "…and shows how many days it pushes your goal back",
  "purchase-danger": "Too big? It flags the danger zone — and suggests a fix",
  jars: "A savings jar for every goal",
  topup: "Top up a jar in a couple of taps",
  "topup-done": "Progress updates instantly",
  quicklog: "New: Quick log — just say it or type it",
  "quicklog-parse": "AI reads your note…",
  "quicklog-review": "…and splits it into expenses you can check",
  "quicklog-saved": "Logged — with what's still safe today and the goal cost",
  expense: "Or use the full form — Octopus, PayMe, FPS, card…",
  roundup: "Round up the spare change into a jar",
  payday: "Payday split: pay yourself first",
  challenge: "New: pick a weekly challenge",
  "challenge-on": "It tracks itself from what you log",
  share: "Share your week with friends",
  month: "This month at a glance, plus six months of growth",
  categories: "See where the money goes",
  recent: "Every spend shown as days of delay for your jar",
  insights: "Small habits, translated into goal days",
  cutback: "What if you skipped it? The cut-back calculator",
  privacy: "Hide balances when you're in public",
  language: "English / 廣東話",
  dark: "Dark mode, day or night",
}
const marks = events.filter((e) => e.type === "mark")
const markT = (label: string) => marks.find((m) => m.label === label)?.t ?? Infinity

const Taps: React.FC<{ t: number }> = ({ t }) => (
  <>
    {events
      .filter((e) => e.type === "tap" && t >= e.t && t < e.t + 0.7)
      .map((e) => {
        const p = (t - e.t) / 0.7
        const r = 18 + p * 34
        return (
          <React.Fragment key={e.t}>
            <div style={{ position: "absolute", left: e.x! - r, top: e.y! - r, width: r * 2, height: r * 2, borderRadius: "50%", border: `3px solid ${C.purple}`, opacity: 1 - p }} />
            <div style={{ position: "absolute", left: e.x! - 16, top: e.y! - 16, width: 32, height: 32, borderRadius: "50%", background: `${C.purple}88`, opacity: Math.max(0, 1 - p * 1.6) }} />
          </React.Fragment>
        )
      })}
  </>
)

const Subtitle: React.FC<{ t: number }> = ({ t }) => {
  let i = -1
  for (let k = 0; k < marks.length; k++) if (marks[k].t <= t) i = k
  const m = marks[i]
  const text = m && CAPTIONS[m.label!]
  if (!text) return null
  const next = marks[i + 1]?.t ?? Infinity
  const o = Math.max(0, Math.min(1, (t - m.t) / 0.35, (next - t) / 0.35))
  const lift = (1 - Math.min(1, (t - m.t) / 0.35)) * 14
  return (
    <div style={{ position: "absolute", left: 80, bottom: 96, width: 500, opacity: o, transform: `translateY(${lift}px)`, fontFamily }}>
      <div style={{ width: 44, height: 4, borderRadius: 2, background: `linear-gradient(90deg, ${C.green}, ${C.purple})`, marginBottom: 18 }} />
      <div style={{ fontSize: 40, fontWeight: 700, lineHeight: 1.2, color: C.fg, letterSpacing: -0.8, textShadow: "0 4px 24px rgba(0,0,0,0.6)" }}>{text}</div>
    </div>
  )
}

const Recording: React.FC = () => {
  const f = useCurrentFrame()
  const t = Math.min(rec.duration, (f / FPS) * SPEED)
  const enter = useEnter(0, 22)
  const { z, y } = camera(t)
  const focusY = PHONE_TOP + (14 + y) * SCALE
  const ty = 540 - focusY
  const isDark = t > markT("dark") && t < markT("end")
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: `translateY(${ty + (1 - enter) * 200}px) scale(${z})`, transformOrigin: `960px ${focusY}px`, opacity: enter }}>
        <div
          style={{
            position: "absolute", left: 960 - ((W + 28) * SCALE) / 2, top: PHONE_TOP, width: W + 28, height: H + 28, padding: 14, borderRadius: 64,
            background: "linear-gradient(145deg,#2a2b31,#121317)", boxShadow: "0 60px 140px rgba(0,0,0,0.6), inset 0 0 0 2px rgba(255,255,255,0.08)",
            transform: `scale(${SCALE})`, transformOrigin: "top left", boxSizing: "border-box",
          }}
        >
          <div style={{ position: "relative", width: W, height: H, borderRadius: 50, overflow: "hidden", background: isDark ? "#0a0a0a" : "#fff" }}>
            <Img src={staticFile(`rec/${frameAt(t)}`)} style={{ position: "absolute", inset: 0, width: W, height: H }} />
            <Taps t={t} />
            <div style={{ position: "absolute", top: 10, left: "50%", width: 110, height: 30, marginLeft: -55, borderRadius: 20, background: "#000" }} />
          </div>
        </div>
      </AbsoluteFill>
      <Subtitle t={t} />
    </AbsoluteFill>
  )
}

const Brand: React.FC = () => (
  <div style={{ position: "absolute", left: 56, top: 48, display: "flex", alignItems: "center", gap: 14, fontFamily, color: C.fg, opacity: 0.85 }}>
    <div style={{ width: 44, height: 44, borderRadius: 12, display: "grid", placeItems: "center", fontSize: 26, background: "#18181b", border: `1px solid ${C.green}88` }}>🐷</div>
    <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5 }}>Savings Jars HK</div>
  </div>
)

const Intro: React.FC = () => {
  const f = useCurrentFrame()
  const s = useEnter(0, 14)
  const out = interpolate(f, [INTRO * FPS - 20, INTRO * FPS], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  return (
    <AbsoluteFill style={{ fontFamily, alignItems: "center", justifyContent: "center", textAlign: "center", opacity: out }}>
      <div style={{ transform: `scale(${0.7 + s * 0.3})`, opacity: s, fontSize: 96 }}>🐷</div>
      <Rise delay={8}><div style={{ fontSize: 104, fontWeight: 800, letterSpacing: -4, color: C.fg }}>Savings Jars HK</div></Rise>
      <Rise delay={18}><div style={{ marginTop: 8, fontSize: 36, color: C.muted }}>Small jars, big future. · 儲錢罐 HK</div></Rise>
    </AbsoluteFill>
  )
}

const Outro: React.FC = () => (
  <AbsoluteFill style={{ fontFamily, alignItems: "center", justifyContent: "center", textAlign: "center" }}>
    <Rise><div style={{ fontSize: 96 }}>🐷</div></Rise>
    <Rise delay={6}><div style={{ fontSize: 104, fontWeight: 800, letterSpacing: -4, color: C.fg }}>Savings Jars HK</div></Rise>
    <Rise delay={14}>
      <div style={{ fontSize: 40, fontWeight: 600, background: `linear-gradient(90deg, ${C.green}, ${C.purple})`, WebkitBackgroundClip: "text", color: "transparent" }}>Small jars, big future.</div>
    </Rise>
    <Rise delay={30}><div style={{ marginTop: 36, fontSize: 26, color: C.muted }}>Built at BUHack · A tracker only — no real money is moved</div></Rise>
  </AbsoluteFill>
)

export const Demo: React.FC = () => {
  const f = useCurrentFrame()
  const recFrom = Math.round(INTRO * FPS) - 10
  const recLen = Math.round(SLOT * FPS) + 10
  const recOut = interpolate(f, [recFrom + recLen - 15, recFrom + recLen], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Backdrop tint={C.purple} />
      <Sequence durationInFrames={Math.round(INTRO * FPS)}><Intro /></Sequence>
      <Sequence from={recFrom} durationInFrames={recLen}>
        <AbsoluteFill style={{ opacity: recOut }}>
          <Recording />
          <Brand />
        </AbsoluteFill>
      </Sequence>
      <Sequence from={TOTAL_FRAMES - Math.round(OUTRO * FPS)}><Outro /></Sequence>
      <Audio
        src={staticFile("music.wav")}
        volume={(fr) => interpolate(fr, [0, 30, TOTAL_FRAMES - 60, TOTAL_FRAMES], [0, 0.8, 0.8, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
      />
    </AbsoluteFill>
  )
}
