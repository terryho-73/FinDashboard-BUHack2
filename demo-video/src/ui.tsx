import React from "react"
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion"
import { loadFont } from "@remotion/google-fonts/Inter"

export const { fontFamily } = loadFont("normal", { weights: ["400", "500", "600", "700", "800"], subsets: ["latin"] })

export const C = {
  bg: "#0c0d11",
  fg: "#f5f5f7",
  muted: "#9a9ba5",
  green: "#10b981",
  purple: "#8b5cf6",
  blue: "#0ea5e9",
  red: "#f43f5e",
  card: "rgba(255,255,255,0.06)",
  border: "rgba(255,255,255,0.12)",
}

const ease = Easing.bezier(0.45, 0, 0.2, 1)

/** Background with slowly drifting colour glows. */
export const Backdrop: React.FC<{ tint?: string }> = ({ tint = C.purple }) => {
  const f = useCurrentFrame()
  const x = Math.sin(f / 140) * 120
  const y = Math.cos(f / 170) * 80
  return (
    <AbsoluteFill style={{ background: C.bg, overflow: "hidden" }}>
      <div style={{ position: "absolute", width: 1100, height: 1100, borderRadius: "50%", left: 1000 + x, top: -300 + y, background: `radial-gradient(circle, ${tint}55, transparent 65%)`, filter: "blur(40px)" }} />
      <div style={{ position: "absolute", width: 900, height: 900, borderRadius: "50%", left: -300 - x, top: 500 - y, background: `radial-gradient(circle, ${C.green}33, transparent 65%)`, filter: "blur(40px)" }} />
      <AbsoluteFill style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
    </AbsoluteFill>
  )
}

/** Fade + lift a scene in and out. */
export const SceneFade: React.FC<{ duration: number; children: React.ReactNode }> = ({ duration, children }) => {
  const f = useCurrentFrame()
  const o = interpolate(f, [0, 15, duration - 15, duration], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>
}

export const useEnter = (delay = 0, damping = 18) => {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  return spring({ frame: f - delay, fps, config: { damping, mass: 0.7 } })
}

export const Rise: React.FC<{ delay?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ delay = 0, children, style }) => {
  const s = useEnter(delay)
  return <div style={{ opacity: s, transform: `translateY(${(1 - s) * 40}px)`, ...style }}>{children}</div>
}

export const Eyebrow: React.FC<{ children: React.ReactNode; color?: string; delay?: number }> = ({ children, color = C.green, delay = 0 }) => (
  <Rise delay={delay}>
    <div style={{ display: "inline-flex", alignItems: "center", gap: 12, fontSize: 24, fontWeight: 600, letterSpacing: 4, textTransform: "uppercase", color }}>
      <span style={{ width: 36, height: 3, background: color, borderRadius: 2 }} />
      {children}
    </div>
  </Rise>
)

export const Title: React.FC<{ children: React.ReactNode; delay?: number; size?: number }> = ({ children, delay = 6, size = 76 }) => (
  <Rise delay={delay}>
    <h1 style={{ margin: "18px 0 0", fontSize: size, lineHeight: 1.05, fontWeight: 800, letterSpacing: -2, color: C.fg }}>{children}</h1>
  </Rise>
)

export const Body: React.FC<{ children: React.ReactNode; delay?: number }> = ({ children, delay = 12 }) => (
  <Rise delay={delay}>
    <p style={{ margin: "26px 0 0", fontSize: 32, lineHeight: 1.45, color: C.muted, maxWidth: 760 }}>{children}</p>
  </Rise>
)

export const Bullet: React.FC<{ icon: string; title: string; text: string; delay: number; color?: string }> = ({ icon, title, text, delay, color = C.green }) => (
  <Rise delay={delay} style={{ display: "flex", gap: 22, alignItems: "flex-start", marginTop: 26 }}>
    <div style={{ flex: "0 0 auto", width: 60, height: 60, borderRadius: 18, display: "grid", placeItems: "center", fontSize: 30, background: `${color}22`, border: `1px solid ${color}55` }}>{icon}</div>
    <div>
      <div style={{ fontSize: 30, fontWeight: 700, color: C.fg }}>{title}</div>
      <div style={{ fontSize: 24, color: C.muted, marginTop: 4, maxWidth: 640, lineHeight: 1.4 }}>{text}</div>
    </div>
  </Rise>
)

/** Left-hand caption column. */
export const Caption: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ position: "absolute", left: 140, top: 0, bottom: 0, width: 820, display: "flex", flexDirection: "column", justifyContent: "center", fontFamily }}>{children}</div>
)

export const PHONE_X = 1060
export const SCREEN_W = 390
export const SCREEN_H = 844
const NAV_H = 74

type Key = [frame: number, value: number]
const track = (f: number, keys: Key[]) =>
  keys.length === 1
    ? keys[0][1]
    : interpolate(f, keys.map((k) => k[0]), keys.map((k) => k[1]), { easing: ease, extrapolateLeft: "clamp", extrapolateRight: "clamp" })

export type Layer = { src: string; from?: number; fade?: number; scroll?: Key[]; nav?: boolean }

/**
 * Phone mockup. Each layer is a real screenshot (full-page or viewport); layers
 * cross-fade in at `from` and scroll according to keyframes in CSS pixels.
 */
export const Phone: React.FC<{ layers: Layer[]; x?: number; y?: number; scale?: number; delay?: number; dark?: boolean; tilt?: number }> = ({
  layers, x = PHONE_X, y = 90, scale = 1.07, delay = 0, dark = false, tilt = 0,
}) => {
  const f = useCurrentFrame()
  const s = useEnter(delay, 20)
  const float = Math.sin(f / 45) * 6
  return (
    <div
      style={{
        position: "absolute", left: x, top: y, width: SCREEN_W + 28, height: SCREEN_H + 28, padding: 14, borderRadius: 64,
        background: "linear-gradient(145deg,#2a2b31,#121317)", boxShadow: "0 60px 120px rgba(0,0,0,0.55), inset 0 0 0 2px rgba(255,255,255,0.08)",
        transform: `translateY(${(1 - s) * 140 + float}px) scale(${scale}) rotate(${tilt}deg)`, transformOrigin: "top center", opacity: s,
      }}
    >
      <div style={{ position: "relative", width: SCREEN_W, height: SCREEN_H, borderRadius: 50, overflow: "hidden", background: dark ? "#0a0a0a" : "#fff" }}>
        {layers.map((l, i) => {
          const from = l.from ?? 0
          const fade = l.fade ?? 12
          const o = i === 0 ? 1 : interpolate(f, [from, from + fade], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
          if (o <= 0) return null
          const scrollY = l.scroll ? track(f, l.scroll) : 0
          return (
            <div key={i} style={{ position: "absolute", inset: 0, opacity: o, background: dark ? "#0a0a0a" : "#fff" }}>
              <Img src={staticFile(`shots/${l.src}.png`)} style={{ position: "absolute", left: 0, top: -scrollY, width: SCREEN_W }} />
              {l.nav && (
                <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: NAV_H, overflow: "hidden" }}>
                  <Img src={staticFile("shots/02-dashboard-top.png")} style={{ position: "absolute", left: 0, bottom: 0, width: SCREEN_W }} />
                </div>
              )}
            </div>
          )
        })}
        {/* Dynamic island */}
        <div style={{ position: "absolute", top: 10, left: "50%", width: 110, height: 30, marginLeft: -55, borderRadius: 20, background: "#000" }} />
      </div>
    </div>
  )
}

/** Pulsing highlight ring over the phone screen, in screen CSS px. */
export const Highlight: React.FC<{ phoneX?: number; phoneY?: number; scale?: number; x: number; y: number; w: number; h: number; from: number; to: number; color?: string }> = ({
  phoneX = PHONE_X, phoneY = 90, scale = 1.07, x, y, w, h, from, to, color = C.green,
}) => {
  const f = useCurrentFrame()
  const o = interpolate(f, [from, from + 10, to - 10, to], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  if (o <= 0) return null
  const pulse = 1 + Math.sin((f - from) / 6) * 0.015
  const cx = phoneX + 14 * scale + ((SCREEN_W + 28) * (1 - scale)) / 2
  return (
    <div
      style={{
        position: "absolute", left: cx + x * scale - 8, top: phoneY + 14 * scale + y * scale - 8, width: w * scale + 16, height: h * scale + 16,
        borderRadius: 22, border: `4px solid ${color}`, boxShadow: `0 0 40px ${color}99`, opacity: o, transform: `scale(${pulse})`,
      }}
    />
  )
}

/** Floating stat callout bubble. */
export const Callout: React.FC<{ x: number; y: number; from: number; to: number; label: string; value: string; color?: string }> = ({ x, y, from, to, label, value, color = C.green }) => {
  const f = useCurrentFrame()
  const { fps } = useVideoConfig()
  const s = spring({ frame: f - from, fps, config: { damping: 14 } })
  const out = interpolate(f, [to - 10, to], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
  if (f < from || f > to) return null
  return (
    <div
      style={{
        position: "absolute", left: x, top: y, padding: "18px 26px", whiteSpace: "nowrap", borderRadius: 22, fontFamily, background: "rgba(20,21,26,0.92)",
        border: `1px solid ${color}88`, boxShadow: `0 20px 60px rgba(0,0,0,0.5), 0 0 30px ${color}33`, opacity: s * out, transform: `scale(${0.8 + s * 0.2})`,
      }}
    >
      <div style={{ fontSize: 20, color: C.muted, fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 40, color, fontWeight: 800, letterSpacing: -1, marginTop: 2 }}>{value}</div>
    </div>
  )
}

export const Chip: React.FC<{ children: React.ReactNode; delay: number; color?: string }> = ({ children, delay, color = C.purple }) => (
  <Rise delay={delay} style={{ display: "inline-block", marginRight: 14, marginTop: 14 }}>
    <span style={{ display: "inline-block", padding: "12px 22px", borderRadius: 999, fontSize: 24, fontWeight: 600, color: C.fg, background: `${color}26`, border: `1px solid ${color}66` }}>{children}</span>
  </Rise>
)

export const ProgressBar: React.FC<{ total: number }> = ({ total }) => {
  const f = useCurrentFrame()
  return (
    <div style={{ position: "absolute", left: 0, bottom: 0, height: 5, width: `${(f / total) * 100}%`, background: `linear-gradient(90deg, ${C.green}, ${C.purple})` }} />
  )
}
