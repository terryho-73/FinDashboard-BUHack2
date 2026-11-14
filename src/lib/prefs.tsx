import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { dict, type Dict, type Lang } from "@/lib/i18n"

type Prefs = {
  lang: Lang
  setLang: (l: Lang) => void
  t: Dict
  dark: boolean
  setDark: (v: boolean) => void
  hidden: boolean
  setHidden: (v: boolean) => void
}

const Ctx = createContext<Prefs | null>(null)

const KEY = "savings-jars-prefs"

function readPrefs(): { lang: Lang; dark: boolean; hidden: boolean } {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null
    if (raw) return { lang: "en", dark: false, hidden: false, ...JSON.parse(raw) }
  } catch {
    /* ignore */
  }
  return { lang: "en", dark: false, hidden: false }
}

// Language, dark mode and the privacy ("hide balances") toggle live here so
// every component reads one source of truth. Persisted in localStorage.
export function PrefsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(readPrefs)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      /* ignore */
    }
    document.documentElement.classList.toggle("dark", state.dark)
    document.documentElement.lang = state.lang === "zh" ? "zh-HK" : "en"
  }, [state])

  const value = useMemo<Prefs>(
    () => ({
      lang: state.lang,
      setLang: (lang) => setState((s) => ({ ...s, lang })),
      t: dict[state.lang],
      dark: state.dark,
      setDark: (dark) => setState((s) => ({ ...s, dark })),
      hidden: state.hidden,
      setHidden: (hidden) => setState((s) => ({ ...s, hidden })),
    }),
    [state],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function usePrefs() {
  const v = useContext(Ctx)
  if (!v) throw new Error("usePrefs must be used inside PrefsProvider")
  return v
}
