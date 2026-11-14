import type { IncomingMessage, ServerResponse } from "node:http"
import {
  collectionFromPath,
  createRow,
  exportAll,
  getRow,
  listRows,
  removeRow,
  updateRow,
  type CollectionName,
} from "./local-db"

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader("Content-Type", "application/json; charset=utf-8")
  res.end(JSON.stringify(body))
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  const text = Buffer.concat(chunks).toString("utf8").trim()
  if (!text) return {}
  try {
    const parsed = JSON.parse(text)
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {}
  } catch {
    throw new Error("Invalid JSON body")
  }
}

function parseApiPath(url: string): { collection: CollectionName; id?: string } | "export" | null {
  const pathname = url.split("?")[0] ?? ""
  if (pathname === "/api/export") return "export"
  const m = pathname.match(/^\/api\/([^/]+)(?:\/([^/]+))?$/)
  if (!m) return null
  const collection = collectionFromPath(m[1])
  if (!collection) return null
  return { collection, id: m[2] }
}

/** Node middleware handler for collection REST + export (Omg-compatible shapes). */
export async function handleLocalApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: string,
): Promise<boolean> {
  const parsed = parseApiPath(url)
  if (!parsed) return false

  if (parsed === "export") {
    if (req.method !== "GET") {
      sendJson(res, 405, { error: "method not allowed" })
      return true
    }
    sendJson(res, 200, { exported_at: new Date().toISOString(), ...exportAll() })
    return true
  }

  const { collection, id } = parsed
  const method = req.method ?? "GET"

  try {
    if (method === "GET" && !id) {
      sendJson(res, 200, listRows(collection))
      return true
    }
    if (method === "GET" && id) {
      const row = getRow(collection, id)
      if (!row) {
        sendJson(res, 404, { error: "Not found" })
        return true
      }
      sendJson(res, 200, row)
      return true
    }
    if (method === "POST" && !id) {
      const body = await readJsonBody(req)
      sendJson(res, 200, createRow(collection, body))
      return true
    }
    if (method === "PATCH" && id) {
      const body = await readJsonBody(req)
      const row = updateRow(collection, id, body)
      if (!row) {
        sendJson(res, 404, { error: "Not found" })
        return true
      }
      sendJson(res, 200, row)
      return true
    }
    if (method === "DELETE" && id) {
      if (!removeRow(collection, id)) {
        sendJson(res, 404, { error: "Not found" })
        return true
      }
      res.statusCode = 204
      res.end()
      return true
    }
    sendJson(res, 405, { error: "method not allowed" })
    return true
  } catch (e) {
    sendJson(res, 400, { error: e instanceof Error ? e.message : String(e) })
    return true
  }
}

export function snapshotForCollection(collection: string): Record<string, unknown>[] {
  const name = collectionFromPath(collection)
  if (!name) return []
  return listRows(name)
}