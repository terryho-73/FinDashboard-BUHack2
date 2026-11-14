import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { useAppCollection, useDataBackend } from "@/lib/data-backend"
import { clearOfflineStore } from "@/lib/offline-store"
import { type Goal, type Settings, type Tx } from "@/lib/finance"
import type { Api } from "@/components/QuickSheets"

function mergeRows<T extends { id: string }>(
  base: T[],
  local: Record<string, T>,
  removed: Record<string, true>,
): T[] {
  const m = new Map<string, T>()
  for (const r of base) m.set(r.id, r)
  for (const r of Object.values(local)) m.set(r.id, r)
  for (const id of Object.keys(removed)) m.delete(id)
  return [...m.values()]
}

export type SavingsData = {
  goals: Goal[]
  txs: Tx[]
  settings: Settings | null
  loading: boolean
  empty: boolean
  hasDemoData: boolean
  hasCsvData: boolean
  error: string | null
  status: string
  api: Api
  refreshAll: () => void
  clearAll: () => Promise<void>
  offline: boolean
  goalsQ: ReturnType<typeof useAppCollection<Goal>>
  txQ: ReturnType<typeof useAppCollection<Tx>>
  settingsQ: ReturnType<typeof useAppCollection<Settings>>
}

const Ctx = createContext<SavingsData | null>(null)

export function SavingsDataProvider({ children }: { children: ReactNode }) {
  const backend = useDataBackend()
  const offline = backend === "offline"
  const goalsQ = useAppCollection<Goal>({ collection: "goals", api: "/api/goals" })
  const txQ = useAppCollection<Tx>({ collection: "transactions", api: "/api/transactions" })
  const settingsQ = useAppCollection<Settings>({ collection: "settings", api: "/api/settings" })

  const [localTx, setLocalTx] = useState<Record<string, Tx>>({})
  const [removedTx, setRemovedTx] = useState<Record<string, true>>({})
  const [localGoals, setLocalGoals] = useState<Record<string, Goal>>({})
  const [removedGoals, setRemovedGoals] = useState<Record<string, true>>({})
  const [localSettings, setLocalSettings] = useState<Settings | null>(null)
  const [settingsGone, setSettingsGone] = useState(false)

  const goals = useMemo(
    () => mergeRows(goalsQ.data, localGoals, removedGoals),
    [goalsQ.data, localGoals, removedGoals],
  )
  const txs = useMemo(
    () => mergeRows(txQ.data, localTx, removedTx),
    [txQ.data, localTx, removedTx],
  )
  const settings = settingsGone ? null : (localSettings ?? settingsQ.data[0] ?? null)

  const loading = goalsQ.loading || txQ.loading || settingsQ.loading
  const empty = !loading && goals.length === 0 && txs.length === 0
  const hasDemoData = useMemo(() => txs.some((t) => t.source === "demo"), [txs])
  const hasCsvData = useMemo(() => txs.some((t) => t.source === "csv"), [txs])

  const errors = offline ? [] : ([goalsQ.error, txQ.error, settingsQ.error].filter(Boolean) as string[])
  const error = errors[0] ?? null
  const status = goalsQ.status ?? txQ.status ?? settingsQ.status ?? "loading"

  const api: Api = useMemo(
    () => ({
      goals,
      settings,
      addTx: async (row) => {
        const r = (await txQ.create(row as never)) as Tx
        if (r?.id) setLocalTx((m) => ({ ...m, [r.id]: r }))
        return r
      },
      addGoal: async (row) => {
        const r = (await goalsQ.create(row as never)) as Goal
        if (r?.id) setLocalGoals((m) => ({ ...m, [r.id]: r }))
        return r
      },
      removeGoal: async (id) => {
        await goalsQ.remove(id)
        setRemovedGoals((m) => ({ ...m, [id]: true }))
      },
      removeTx: async (id) => {
        await txQ.remove(id)
        setRemovedTx((m) => ({ ...m, [id]: true }))
      },
      saveSettings: async (row) => {
        const r = (settings
          ? await settingsQ.update(settings.id, row as never)
          : await settingsQ.create(row as never)) as Settings
        setLocalSettings(r)
        setSettingsGone(false)
        return r
      },
    }),
    [goals, settings, goalsQ, settingsQ, txQ],
  )

  const refreshAll = useCallback(() => {
    goalsQ.refresh()
    txQ.refresh()
    settingsQ.refresh()
  }, [goalsQ, settingsQ, txQ])

  const clearAll = useCallback(async () => {
    for (const t of txs) await api.removeTx(t.id)
    for (const g of goals) await api.removeGoal(g.id)
    if (settings) {
      await settingsQ.remove(settings.id)
      setSettingsGone(true)
      setLocalSettings(null)
    }
    if (offline) clearOfflineStore()
  }, [api, goals, offline, settings, settingsQ, txs])

  const value = useMemo(
    (): SavingsData => ({
      goals,
      txs,
      settings,
      loading,
      empty,
      hasDemoData,
      hasCsvData,
      error,
      status,
      api,
      refreshAll,
      goalsQ,
      txQ,
      settingsQ,
      clearAll,
      offline,
    }),
    [
      goals,
      txs,
      settings,
      loading,
      empty,
      hasDemoData,
      hasCsvData,
      error,
      status,
      api,
      refreshAll,
      goalsQ,
      txQ,
      settingsQ,
      clearAll,
      offline,
    ],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSavingsData() {
  const v = useContext(Ctx)
  if (!v) throw new Error("useSavingsData must be used within SavingsDataProvider")
  return v
}
