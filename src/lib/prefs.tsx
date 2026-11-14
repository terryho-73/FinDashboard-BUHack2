import { useEffect, useMemo, useState, type ReactNode } from "react"
import { dict, type Lang } from "@/lib/i18n"
import { PrefsContext, type Prefs } from "@/lib/prefs-context"

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

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>
}

export { usePrefs } from "@/lib/prefs-context"