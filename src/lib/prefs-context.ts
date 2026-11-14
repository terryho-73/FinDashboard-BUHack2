import { createContext, useContext } from "react"
import type { Dict, Lang } from "@/lib/i18n"

export type Prefs = {
  lang: Lang
  setLang: (l: Lang) => void
  t: Dict
  dark: boolean
  setDark: (v: boolean) => void
  hidden: boolean
  setHidden: (v: boolean) => void
}

// Kept apart from PrefsProvider so fast refresh can hot-swap the provider
// without recreating this context (which would orphan every consumer).
export const PrefsContext = createContext<Prefs | null>(null)

export function usePrefs() {
  const v = useContext(PrefsContext)
  if (!v) throw new Error("usePrefs must be used inside PrefsProvider")
  return v
}
