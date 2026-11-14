import { useCallback, useState } from "react"

const PREFIX = "pocketgoals-offline-"

export type OfflineCollection = "goals" | "transactions" | "settings"

function readRows<T>(collection: OfflineCollection): T[] {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(`${PREFIX}${collection}`) : null
    if (!raw) return []
    const parsed = JSON.parse(raw) as T[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeRows<T>(collection: OfflineCollection, rows: T[]) {
  try {
    localStorage.setItem(`${PREFIX}${collection}`, JSON.stringify(rows))
  } catch {
    /* quota / private mode */
  }
}

export type OfflineCollectionHook<T extends { id: string }> = {
  data: T[]
  loading: boolean
  error: string | null
  status: string
  refresh: () => void
  create: (row: Omit<T, "id" | "created_at" | "updated_at">) => Promise<T>
  update: (id: string, patch: Partial<T>) => Promise<T>
  remove: (id: string) => Promise<void>
}

export function useOfflineCollection<T extends { id: string }>(
  collection: OfflineCollection,
): OfflineCollectionHook<T> {
  const [data, setData] = useState<T[]>(() => readRows<T>(collection))

  const persist = useCallback(
    (rows: T[]) => {
      setData(rows)
      writeRows(collection, rows)
    },
    [collection],
  )

  const refresh = useCallback(() => {
    setData(readRows<T>(collection))
  }, [collection])

  return {
    data,
    loading: false,
    error: null,
    status: "ready",
    refresh,
    create: async (row) => {
      const now = new Date().toISOString()
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
      const created = { ...row, id, created_at: now, updated_at: now } as T
      persist([...readRows<T>(collection), created])
      return created
    },
    update: async (id, patch) => {
      const now = new Date().toISOString()
      let updated: T | undefined
      const next = readRows<T>(collection).map((row) => {
        if (row.id !== id) return row
        updated = { ...row, ...patch, updated_at: now } as T
        return updated
      })
      if (!updated) throw new Error(`Missing row ${id}`)
      persist(next)
      return updated
    },
    remove: async (id) => {
      persist(readRows<T>(collection).filter((row) => row.id !== id))
    },
  }
}

export function clearOfflineStore() {
  for (const key of ["goals", "transactions", "settings"] as const) {
    try {
      localStorage.removeItem(`${PREFIX}${key}`)
    } catch {
      /* ignore */
    }
  }
}

/** Trigger a browser file download from a Blob (works offline and online). */
export function triggerJsonDownload(payload: unknown, filenamePrefix = "pocketgoals-backup") {
  const exportedAt =
    payload && typeof payload === "object" && "exported_at" in payload && typeof (payload as { exported_at?: unknown }).exported_at === "string"
      ? (payload as { exported_at: string }).exported_at
      : new Date().toISOString()
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${filenamePrefix}-${exportedAt.slice(0, 10)}.json`
  a.rel = "noopener"
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke after the click has been processed
  setTimeout(() => URL.revokeObjectURL(url), 1_000)
}

export function downloadOfflineBackup() {
  const payload = {
    exported_at: new Date().toISOString(),
    goals: readRows("goals"),
    transactions: readRows("transactions"),
    settings: readRows("settings"),
  }
  triggerJsonDownload(payload)
}

/** Fetch /api/export and download as JSON. Falls back to offline backup on failure. */
export async function downloadApiBackup(): Promise<void> {
  try {
    const res = await fetch("/api/export", {
      method: "GET",
      headers: { Accept: "application/json" },
    })
    if (!res.ok) throw new Error(`Export failed (${res.status})`)
    const type = res.headers.get("content-type") ?? ""
    if (!type.includes("json")) throw new Error("Export did not return JSON")
    const payload = await res.json()
    triggerJsonDownload(payload)
  } catch {
    // API unreachable or non-JSON — use whatever is in offline localStorage
    downloadOfflineBackup()
  }
}