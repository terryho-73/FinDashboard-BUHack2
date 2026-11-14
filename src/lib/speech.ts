import { useCallback, useEffect, useRef, useState } from "react"

// Minimal typing for the browser Web Speech API (not in TS's DOM lib).
type SpeechResultList = ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>
type SpeechRecognitionLike = {
  lang: string
  interimResults: boolean
  continuous: boolean
  onresult: ((e: { results: SpeechResultList }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null
  const w = window as unknown as Record<string, unknown>
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => SpeechRecognitionLike) | null
}

/** Stop on its own after this long with no new words. */
const SILENCE_MS = 4000

// Voice languages offered in quick-log. The browser listens for one language
// per session (no auto-detect), so the user picks; the AI then parses any of them.
export const VOICE_LANGS = [
  { tag: "zh-HK", label: "廣東話" },
  { tag: "en-HK", label: "English" },
  { tag: "cmn-Hans-CN", label: "普通话" },
  { tag: "zh-TW", label: "國語（台灣）" },
  { tag: "ja-JP", label: "日本語" },
  { tag: "ko-KR", label: "한국어" },
  { tag: "fil-PH", label: "Filipino" },
  { tag: "id-ID", label: "Bahasa Indonesia" },
  { tag: "hi-IN", label: "हिन्दी" },
  { tag: "fr-FR", label: "Français" },
  { tag: "es-ES", label: "Español" },
] as const

const VOICE_KEY = "pocketgoals.voiceLang"

export function loadVoiceLang(appLang: "en" | "zh") {
  try {
    const saved = localStorage.getItem(VOICE_KEY)
    if (saved && VOICE_LANGS.some((l) => l.tag === saved)) return saved
  } catch {
    /* storage blocked */
  }
  return appLang === "zh" ? "zh-HK" : "en-HK"
}

export function saveVoiceLang(tag: string) {
  try {
    localStorage.setItem(VOICE_KEY, tag)
  } catch {
    /* storage blocked: choice just won't be remembered */
  }
}

const join = (a: string, b: string) => [a.trim(), b.trim()].filter(Boolean).join(" ")

/**
 * Free voice-to-text via the browser (Chrome, Edge, Safari).
 *
 * Keeps listening through pauses: the browser ends a recognition session on
 * its own after a short silence, so we restart it until the user taps stop or
 * SILENCE_MS passes with no new words. `onDone` gets the whole transcript once.
 */
export function useSpeech(speechLang: string, onDone: (text: string) => void) {
  const supported = getRecognitionCtor() !== null
  const [listening, setListening] = useState(false)
  const [live, setLive] = useState("")
  const [error, setError] = useState<string | null>(null)

  const recRef = useRef<SpeechRecognitionLike | null>(null)
  const wantRef = useRef(false) // user still wants to listen
  const doneText = useRef("") // finals from earlier (restarted) sessions
  const sessionFinal = useRef("") // finals from the current session
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onDoneRef = useRef(onDone)
  useEffect(() => {
    onDoneRef.current = onDone
  }, [onDone])

  const clearSilence = () => {
    if (silenceTimer.current) clearTimeout(silenceTimer.current)
    silenceTimer.current = null
  }

  const stop = useCallback(() => {
    wantRef.current = false
    clearSilence()
    recRef.current?.stop() // onend delivers the transcript
  }, [])

  const armSilence = useCallback(() => {
    clearSilence()
    silenceTimer.current = setTimeout(stop, SILENCE_MS)
  }, [stop])

  const cancel = useCallback(() => {
    wantRef.current = false
    clearSilence()
    const rec = recRef.current
    recRef.current = null
    rec?.abort()
    doneText.current = ""
    sessionFinal.current = ""
    setListening(false)
    setLive("")
  }, [])

  useEffect(() => cancel, [cancel])

  const startSession = useCallback(() => {
    // Named inner function so onend can restart the session recursively.
    const run = () => {
      const Ctor = getRecognitionCtor()
      if (!Ctor) return
      const rec = new Ctor()
      rec.lang = speechLang
      rec.interimResults = true
      rec.continuous = true
      sessionFinal.current = ""
      rec.onresult = (e) => {
        let finals = ""
        let partial = ""
        for (let i = 0; i < e.results.length; i++) {
          const r = e.results[i]
          if (r.isFinal) finals = join(finals, r[0].transcript)
          else partial = join(partial, r[0].transcript)
        }
        sessionFinal.current = finals
        setLive(join(join(doneText.current, finals), partial))
        armSilence()
      }
      rec.onerror = (e) => {
        if (e.error === "not-allowed" || e.error === "service-not-allowed" || e.error === "audio-capture") {
          wantRef.current = false
          setError(e.error)
        }
        // "no-speech", "network", "aborted": let onend decide whether to restart
      }
      rec.onend = () => {
        if (recRef.current !== rec) return // cancelled or replaced
        doneText.current = join(doneText.current, sessionFinal.current)
        sessionFinal.current = ""
        if (wantRef.current) {
          try {
            run() // browser stopped on a pause — keep going
            return
          } catch {
            /* fall through and finish */
          }
        }
        recRef.current = null
        clearSilence()
        setListening(false)
        setLive("")
        const text = doneText.current.trim()
        doneText.current = ""
        if (text) onDoneRef.current(text)
      }
      recRef.current = rec
      rec.start()
    }
    run()
  }, [speechLang, armSilence])

  const start = useCallback(() => {
    if (!getRecognitionCtor()) return
    cancel()
    setError(null)
    wantRef.current = true
    setListening(true)
    armSilence()
    startSession()
  }, [cancel, armSilence, startSession])

  return { supported, listening, live, error, start, stop, cancel }
}
