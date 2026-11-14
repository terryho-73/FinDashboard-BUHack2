import fs from "node:fs"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { DatabaseSync } from "node:sqlite"
import type { Connect } from "vite"
import { WebSocketServer, type WebSocket } from "ws"

const tables = {
  goals: ["name", "target", "emoji", "color"],
  transactions: ["title", "amount", "kind", "category", "channel", "date", "goal_id", "recurring", "source"],
  settings: ["monthly_income", "rent", "utilities", "mpf", "save_pct", "round_to", "roundup_on"],
} as const

type TableName = keyof typeof tables

export function localDbPlugin(dbFile: string) {
  let database: DatabaseSync | null = null
  const clients = new Set<NodeJS.WritableStream>()
  const sockets = new Map<WebSocket, Map<string, TableName>>()

  return {
    name: "local-node-sqlite",
    configureServer(server: {
      middlewares: { use: Connect.NextHandleFunction }
      httpServer?: { on: (event: "upgrade", listener: (request: unknown, socket: unknown, head: Buffer) => void) => void }
    }) {
      const file = path.resolve(process.cwd(), dbFile)
      fs.mkdirSync(path.dirname(file), { recursive: true })
      database = new DatabaseSync(file)
      migrate(database)

      const wsServer = new WebSocketServer({ noServer: true })
      server.httpServer?.on("upgrade", (request, socket, head) => {
        const url = request instanceof Object && "url" in request ? request.url : undefined
        if (url !== "/__vibes_sub") return
        wsServer.handleUpgrade(request as never, socket as never, head, (client) => {
          sockets.set(client, new Map())
          client.on("message", (message) => {
            try {
              const frame = JSON.parse(String(message)) as { op?: string; subId?: string; collection?: string }
              if (frame.op !== "sub" || !frame.subId || !frame.collection || !(frame.collection in tables)) return
              const table = frame.collection as TableName
              sockets.get(client)?.set(frame.subId, table)
              client.send(JSON.stringify({
                type: "snapshot",
                subId: frame.subId,
                collection: table,
                seq: 0,
                rows: database?.prepare(`SELECT * FROM ${table} ORDER BY created_at ASC`).all() ?? [],
              }))
            } catch {
              client.send(JSON.stringify({ type: "error", code: "bad_frame", message: "Invalid subscription frame" }))
            }
          })
          client.on("close", () => sockets.delete(client))
        })
      })

      server.middlewares.use((req, res, next) => {
        if (req.url === "/__vibes_events" && req.method === "GET") {
          res.statusCode = 200
          res.setHeader("Content-Type", "text/event-stream")
          res.setHeader("Cache-Control", "no-cache")
          res.setHeader("Connection", "keep-alive")
          res.write(":\n\n")
          clients.add(res)
          req.on("close", () => clients.delete(res))
          return
        }

        const match = req.url?.match(/^\/api\/(goals|transactions|settings)(?:\/([^/?]+))?$/)
        if (!match || !database) return next()

          void handleRequest(database, req, res, match[1] as TableName, match[2], clients, sockets)
      })
    },
  }
}

function migrate(db: DatabaseSync) {
  for (const [table, columns] of Object.entries(tables)) {
    const definitions = columns.map((column) => `${column} ${column === "target" || column === "amount" || column.includes("income") || column === "rent" || column === "utilities" || column === "mpf" || column === "save_pct" || column === "round_to" ? "REAL" : column === "recurring" || column === "roundup_on" ? "INTEGER" : "TEXT"}`).join(", ")
    db.exec(`CREATE TABLE IF NOT EXISTS ${table} (id TEXT PRIMARY KEY, created_at TEXT, updated_at TEXT, ${definitions})`)
  }
}

async function handleRequest(
  db: DatabaseSync,
  req: Connect.IncomingMessage,
  res: Connect.ServerResponse,
  table: TableName,
  id: string | undefined,
  clients: Set<NodeJS.WritableStream>,
  sockets: Map<WebSocket, Map<string, TableName>>,
) {
  try {
    if (req.method === "GET") {
      sendJson(res, db.prepare(`SELECT * FROM ${table} ORDER BY created_at ASC`).all())
      return
    }

    if (req.method === "POST") {
      const body = await readJson(req)
      const now = new Date().toISOString()
      const row = { id: randomUUID(), created_at: now, updated_at: now, ...pickColumns(table, body) }
      const columns = Object.keys(row)
      const values = columns.map((column) => row[column as keyof typeof row])
      db.prepare(`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`).run(...values)
      sendJson(res, row, 201)
      invalidate(clients, sockets, table, "insert", row)
      return
    }

    if (req.method === "PATCH" && id) {
      const body = pickColumns(table, await readJson(req))
      const columns = Object.keys(body)
      if (columns.length === 0) {
        sendJson(res, { error: "No editable fields supplied" }, 400)
        return
      }
      const values = Object.values(body)
      const now = new Date().toISOString()
      db.prepare(`UPDATE ${table} SET ${columns.map((column) => `${column} = ?`).join(", ")}, updated_at = ? WHERE id = ?`).run(...values, now, id)
      const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id)
      if (!row) {
        sendJson(res, { error: "Not found" }, 404)
        return
      }
      sendJson(res, row)
      invalidate(clients, sockets, table, "update", row)
      return
    }

    if (req.method === "DELETE" && id) {
      db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id)
      res.statusCode = 204
      res.end()
      invalidate(clients, sockets, table, "delete", { id })
      return
    }

    sendJson(res, { error: "Method not allowed" }, 405)
  } catch (error) {
    sendJson(res, { error: error instanceof Error ? error.message : "Local database request failed" }, 500)
  }
}

function pickColumns(table: TableName, body: Record<string, unknown>) {
  return Object.fromEntries(
    tables[table]
      .filter((column) => column in body)
      .map((column) => [
        column,
        column === "recurring" || column === "roundup_on"
          ? body[column] ? 1 : 0
          : body[column],
      ]),
  )
}

function readJson(req: Connect.IncomingMessage) {
  return new Promise<Record<string, unknown>>((resolve, reject) => {
    let data = ""
    req.setEncoding("utf8")
    req.on("data", (chunk: string) => { data += chunk })
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {})
      } catch {
        reject(new Error("Invalid JSON body"))
      }
    })
    req.on("error", reject)
  })
}

function invalidate(
  clients: Set<NodeJS.WritableStream>,
  sockets: Map<WebSocket, Map<string, TableName>>,
  collection: TableName,
  op: "insert" | "update" | "delete",
  row: { id: string } & Record<string, unknown>,
) {
  const event = `data: ${JSON.stringify({ type: "invalidate", collection })}\n\n`
  for (const client of clients) client.write(event)
  for (const [socket, subscriptions] of sockets) {
    for (const [subId, table] of subscriptions) {
      if (table !== collection || socket.readyState !== 1) continue
      socket.send(JSON.stringify({
        type: "delta",
        subId,
        collection,
        seq: 0,
        op,
        ...(op === "delete" ? { id: row.id } : { row }),
      }))
    }
  }
}

function sendJson(res: Connect.ServerResponse, body: unknown, status = 200) {
  res.statusCode = status
  res.setHeader("Content-Type", "application/json")
  res.end(JSON.stringify(body))
}
