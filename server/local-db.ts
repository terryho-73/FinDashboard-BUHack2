import fs from "node:fs"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"

export const COLLECTIONS = ["goals", "transactions", "settings"] as const
export type CollectionName = (typeof COLLECTIONS)[number]

const BOOL_COLS: Record<CollectionName, Set<string>> = {
  goals: new Set(),
  transactions: new Set(["recurring"]),
  settings: new Set(["roundup_on"]),
}

type LocalDb = {
  db: DatabaseSync
  path: string
}

const globalKey = "__pocketgoals_local_sqlite__"

function getGlobalSingleton(): LocalDb | null {
  return (globalThis as Record<string, LocalDb | undefined>)[globalKey] ?? null
}

function setGlobalSingleton(v: LocalDb) {
  ;(globalThis as Record<string, LocalDb>)[globalKey] = v
}

const DDL: Record<CollectionName, string> = {
  goals: `
    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      name TEXT NOT NULL,
      target REAL NOT NULL,
      emoji TEXT NOT NULL,
      color TEXT NOT NULL,
      target_date TEXT NOT NULL DEFAULT ''
    )`,
  transactions: `
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      title TEXT NOT NULL,
      amount REAL NOT NULL,
      kind TEXT NOT NULL,
      category TEXT NOT NULL,
      channel TEXT NOT NULL,
      date TEXT NOT NULL,
      goal_id TEXT NOT NULL,
      recurring INTEGER NOT NULL,
      source TEXT NOT NULL
    )`,
  settings: `
    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      monthly_income REAL NOT NULL,
      rent REAL NOT NULL,
      utilities REAL NOT NULL,
      mpf REAL NOT NULL,
      save_pct REAL NOT NULL,
      round_to REAL NOT NULL,
      roundup_on INTEGER NOT NULL
    )`,
}

export function getLocalDb(projectRoot: string): LocalDb {
  const existing = getGlobalSingleton()
  if (existing) return existing

  const dir = path.join(projectRoot, ".data")
  fs.mkdirSync(dir, { recursive: true })
  const dbPath = path.join(dir, "pocketgoals.sqlite")
  const db = new DatabaseSync(dbPath)
  db.exec("PRAGMA journal_mode = WAL")
  db.exec("PRAGMA foreign_keys = ON")
  for (const name of COLLECTIONS) db.exec(DDL[name])
  migrateGoalsTargetDate(db)

  const handle: LocalDb = { db, path: dbPath }
  setGlobalSingleton(handle)
  return handle
}

function decodeRow(name: CollectionName, row: Record<string, unknown>): Record<string, unknown> {
  const out = { ...row }
  for (const col of BOOL_COLS[name]) {
    if (col in out) out[col] = Boolean(out[col])
  }
  return out
}

function rowsOf(stmt: { all(...args: unknown[]): unknown[] }) {
  return stmt.all() as Record<string, unknown>[]
}

export function listRows(name: CollectionName): Record<string, unknown>[] {
  const { db } = getLocalDbFromSingleton()
  const rows = rowsOf(db.prepare(`SELECT * FROM ${name} ORDER BY created_at DESC`))
  return rows.map((r) => decodeRow(name, r))
}

export function getRow(name: CollectionName, id: string): Record<string, unknown> | null {
  const { db } = getLocalDbFromSingleton()
  const row = db.prepare(`SELECT * FROM ${name} WHERE id = ? LIMIT 1`).get(id) as
    | Record<string, unknown>
    | undefined
  return row ? decodeRow(name, row) : null
}

export function createRow(
  name: CollectionName,
  body: Record<string, unknown>,
): Record<string, unknown> {
  const { db } = getLocalDbFromSingleton()
  const id = crypto.randomUUID()
  const ts = new Date().toISOString()
  const record: Record<string, unknown> = { id, created_at: ts, updated_at: ts, ...body }
  for (const col of BOOL_COLS[name]) {
    if (col in record) record[col] = record[col] ? 1 : 0
  }
  const cols = Object.keys(record)
  const placeholders = cols.map(() => "?").join(", ")
  const values = cols.map((c) => record[c])
  db.prepare(`INSERT INTO ${name} (${cols.join(", ")}) VALUES (${placeholders})`).run(...values)
  return decodeRow(name, record)
}

export function updateRow(
  name: CollectionName,
  id: string,
  body: Record<string, unknown>,
): Record<string, unknown> | null {
  const { db } = getLocalDbFromSingleton()
  const existing = db.prepare(`SELECT * FROM ${name} WHERE id = ? LIMIT 1`).get(id) as
    | Record<string, unknown>
    | undefined
  if (!existing) return null

  const updates: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(body)) {
    if (k === "id" || k === "created_at" || k === "updated_at") continue
    updates[k] = BOOL_COLS[name].has(k) ? (v ? 1 : 0) : v
  }
  updates.updated_at = new Date().toISOString()

  const setClauses = Object.keys(updates)
    .map((k) => `${k} = ?`)
    .join(", ")
  const values = [...Object.values(updates), id]
  db.prepare(`UPDATE ${name} SET ${setClauses} WHERE id = ?`).run(...values)

  const merged = { ...existing, ...updates }
  return decodeRow(name, merged)
}

export function removeRow(name: CollectionName, id: string): boolean {
  const { db } = getLocalDbFromSingleton()
  const result = db.prepare(`DELETE FROM ${name} WHERE id = ?`).run(id) as { changes: number }
  return result.changes > 0
}

export function exportAll(): Record<CollectionName, Record<string, unknown>[]> {
  return {
    goals: listRows("goals"),
    transactions: listRows("transactions"),
    settings: listRows("settings"),
  }
}

function getLocalDbFromSingleton(): LocalDb {
  const existing = getGlobalSingleton()
  if (!existing) throw new Error("local db not initialized")
  return existing
}

function migrateGoalsTargetDate(db: DatabaseSync) {
  const cols = db.prepare("PRAGMA table_info(goals)").all() as { name: string }[]
  if (!cols.some((c) => c.name === "target_date")) {
    db.exec("ALTER TABLE goals ADD COLUMN target_date TEXT NOT NULL DEFAULT ''")
  }
}

export function collectionFromPath(segment: string): CollectionName | null {
  if ((COLLECTIONS as readonly string[]).includes(segment)) return segment as CollectionName
  return null
}