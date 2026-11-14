import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import { useCollection } from "@omg-dev/sdk"
import {
  useOfflineCollection,
  type OfflineCollection,
  type OfflineCollectionHook,
} from "@/lib/offline-store"

export type DataBackendMode = "probing" | "api" | "offline"

const BackendCtx = createContext<DataBackendMode>("probing")

async function probeApiReachable(): Promise<boolean> {
  try {
    const r = await fetch("/api/settings", { method: "GET", headers: { Accept: "application/json" } })
    const type = r.headers.get("content-type") ?? ""
    if (!r.ok || !type.includes("json")) return false
    await r.json()
    return true
  } catch {
    return false
  }
}

export function DataBackendProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<DataBackendMode>("probing")

  useEffect(() => {
    let cancelled = false
    void probeApiReachable().then((ok) => {
      if (!cancelled) setMode(ok ? "api" : "offline")
    })
    return () => {
      cancelled = true
    }
  }, [])

  return <BackendCtx.Provider value={mode}>{children}</BackendCtx.Provider>
}

export function useDataBackend() {
  return useContext(BackendCtx)
}

type CollectionOpts = {
  collection: OfflineCollection
  api: string
}

export function useAppCollection<T extends { id: string }>(
  opts: CollectionOpts,
): OfflineCollectionHook<T> {
  const mode = useDataBackend()
  const apiQ = useCollection<T>({ collection: opts.collection, api: opts.api })
  const offlineQ = useOfflineCollection<T>(opts.collection)

  if (mode === "offline") return offlineQ
  if (mode === "probing") {
    return {
      data: [],
      loading: true,
      error: null,
      status: "loading",
      refresh: () => {},
      create: offlineQ.create,
      update: offlineQ.update,
      remove: offlineQ.remove,
    }
  }
  return apiQ as unknown as OfflineCollectionHook<T>
}