// Synthesizes an original, royalty-free 3-minute upbeat lo-fi track as a WAV file.
// Usage: node scripts/make-music.mjs  →  public/music.wav
import { writeFileSync, mkdirSync } from "node:fs"

const SR = 44100
const DURATION = 180
const BPM = 100
const BEAT = 60 / BPM
const BAR = BEAT * 4
const N = SR * DURATION
const L = new Float32Array(N)
const R = new Float32Array(N)

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12)
// Deterministic PRNG for noise so renders are reproducible
let seed = 1234567
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1

// Progression (2 bars each): Cmaj9 – G6 – Am7 – Fmaj7
const chords = [
  { root: 48, notes: [60, 64, 67, 71, 74] },
  { root: 43, notes: [59, 62, 67, 69, 74] },
  { root: 45, notes: [60, 64, 67, 69, 72] },
  { root: 41, notes: [60, 64, 65, 69, 72] },
]
const chordAt = (bar) => chords[Math.floor(bar / 2) % chords.length]

const TOTAL_BARS = Math.ceil(DURATION / BAR)
// Arrangement flags per bar
const section = (bar) => {
  if (bar < 8) return { pad: 1, arp: 0.6, drums: 0, bass: 0, snare: 0, lead: 0 }
  if (bar < 24) return { pad: 0.8, arp: 0.8, drums: 1, bass: 1, snare: 0, lead: 0 }
  if (bar < 40) return { pad: 0.8, arp: 0.9, drums: 1, bass: 1, snare: 1, lead: 0.7 }
  if (bar < 48) return { pad: 1, arp: 0.7, drums: 0, bass: 0.6, snare: 0, lead: 0 }
  if (bar < 68) return { pad: 0.8, arp: 1, drums: 1, bass: 1, snare: 1, lead: 1 }
  return { pad: 1, arp: 0.5, drums: 0, bass: 0, snare: 0, lead: 0 }
}

function add(start, len, fn, pan = 0, gain = 1) {
  const s0 = Math.floor(start * SR)
  const n = Math.floor(len * SR)
  const gl = gain * Math.cos(((pan + 1) * Math.PI) / 4)
  const gr = gain * Math.sin(((pan + 1) * Math.PI) / 4)
  for (let i = 0; i < n && s0 + i < N; i++) {
    const v = fn(i / SR)
    L[s0 + i] += v * gl
    R[s0 + i] += v * gr
  }
}

// --- Instruments ---
const pad = (f) => (t) => {
  const env = Math.min(1, t / 0.6)
  let v = 0
  for (const d of [-0.12, 0, 0.12]) {
    const ph = 2 * Math.PI * f * Math.pow(2, d / 12) * t
    v += Math.sin(ph) + 0.25 * Math.sin(2 * ph) + 0.1 * Math.sin(3 * ph)
  }
  return (v / 3) * env * 0.05
}
const pluck = (f) => (t) => {
  const ph = 2 * Math.PI * f * t
  return (Math.sin(ph) + 0.3 * Math.sin(2 * ph) * Math.exp(-t * 12)) * Math.exp(-t * 6) * 0.12
}
const bassVoice = (f, len) => (t) => {
  const ph = 2 * Math.PI * f * t
  const env = Math.min(1, t / 0.01) * Math.min(1, (len - t) / 0.05)
  return (Math.sin(ph) + 0.2 * Math.sin(2 * ph)) * env * 0.28
}
const kick = (t) => {
  const f = 50 + 90 * Math.exp(-t * 30)
  return Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 9) * 0.55
}
let hpPrev = 0
const hat = (t) => {
  const n = rand()
  const v = n - hpPrev
  hpPrev = n
  return v * Math.exp(-t * 45) * 0.06
}
const snare = (t) => (rand() * 0.7 + 0.3 * Math.sin(2 * Math.PI * 190 * t)) * Math.exp(-t * 18) * 0.22
const lead = (f) => (t) => {
  const vib = Math.sin(2 * Math.PI * 5 * t) * 0.003 * Math.min(1, t * 3)
  const ph = 2 * Math.PI * f * (1 + vib) * t
  return (Math.sin(ph) + 0.15 * Math.sin(3 * ph)) * Math.min(1, t / 0.03) * Math.exp(-t * 1.8) * 0.09
}

// Lead melody (scale degrees as MIDI), 8 bars, repeated
const melody = [
  [0, 76, 1], [1, 79, 0.5], [1.5, 76, 0.5], [2, 74, 1.5], [4, 74, 1], [5, 76, 0.5], [5.5, 74, 0.5], [6, 71, 2],
  [8, 72, 1], [9, 76, 1], [10, 79, 1.5], [12, 81, 1], [13, 79, 0.5], [13.5, 77, 0.5], [14, 76, 2],
  [16, 76, 1], [17, 79, 0.5], [17.5, 81, 0.5], [18, 84, 1.5], [20, 83, 1], [21, 81, 1], [22, 79, 2],
  [24, 77, 1], [25, 76, 1], [26, 74, 1], [27, 72, 1], [28, 72, 3],
]

for (let bar = 0; bar < TOTAL_BARS; bar++) {
  const t0 = bar * BAR
  const s = section(bar)
  const ch = chordAt(bar)

  if (s.pad && bar % 2 === 0) ch.notes.slice(0, 4).forEach((m, i) => add(t0, BAR * 2 + 0.3, pad(mtof(m)), i % 2 ? 0.4 : -0.4, s.pad))

  if (s.arp) {
    const pattern = [0, 2, 4, 1, 3, 2, 4, 3]
    for (let k = 0; k < 8; k++) {
      const m = ch.notes[pattern[k]] + (k === 6 ? 12 : 0)
      add(t0 + k * (BEAT / 2), 0.9, pluck(mtof(m)), k % 2 ? 0.5 : -0.5, s.arp)
    }
  }

  if (s.bass) {
    const f = mtof(ch.root)
    add(t0, BEAT * 1.5, bassVoice(f, BEAT * 1.5), 0, s.bass)
    add(t0 + BEAT * 1.5, BEAT, bassVoice(f, BEAT), 0, s.bass)
    add(t0 + BEAT * 2.5, BEAT * 1.5, bassVoice(f * (bar % 2 ? 1.5 : 1), BEAT * 1.5), 0, s.bass)
  }

  if (s.drums) {
    add(t0, 0.5, kick)
    add(t0 + BEAT * 1.5, 0.5, kick, 0, 0.6)
    add(t0 + BEAT * 2, 0.5, kick)
    for (let k = 0; k < 8; k++) add(t0 + k * (BEAT / 2) + (k % 2 ? 0.03 : 0), 0.15, hat, 0.3, k % 2 ? 0.7 : 1)
  }
  if (s.snare) {
    add(t0 + BEAT, 0.3, snare, -0.1)
    add(t0 + BEAT * 3, 0.3, snare, -0.1)
  }
  if (s.lead) {
    const local = (bar % 8) * 4
    for (const [beat, m, len] of melody) {
      if (beat >= local && beat < local + 4) add(t0 + (beat - local) * BEAT, len * BEAT + 0.8, lead(mtof(m)), 0.15, s.lead)
    }
  }
}

// Stereo ping-pong delay "reverb" for warmth
const D = Math.floor(BEAT * 0.75 * SR)
for (let i = D; i < N; i++) {
  L[i] += R[i - D] * 0.28
  R[i] += L[i - D] * 0.28
}
// Lo-fi low-pass (one-pole) + gentle saturation + master fades
let lpL = 0, lpR = 0
const a = 0.35
const buf = Buffer.alloc(44 + N * 4)
for (let i = 0; i < N; i++) {
  const t = i / SR
  const fade = Math.min(1, t / 2) * Math.min(1, (DURATION - t) / 5)
  lpL += a * (L[i] - lpL)
  lpR += a * (R[i] - lpR)
  const l = Math.tanh(lpL * 1.4) * 0.8 * fade
  const r = Math.tanh(lpR * 1.4) * 0.8 * fade
  buf.writeInt16LE(Math.round(l * 32767), 44 + i * 4)
  buf.writeInt16LE(Math.round(r * 32767), 46 + i * 4)
}
buf.write("RIFF", 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write("WAVE", 8)
buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22)
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34)
buf.write("data", 36); buf.writeUInt32LE(N * 4, 40)
mkdirSync(new URL("../public/", import.meta.url), { recursive: true })
writeFileSync(new URL("../public/music.wav", import.meta.url), buf)
console.log(`wrote public/music.wav (${DURATION}s, ${TOTAL_BARS} bars @ ${BPM} BPM)`)
