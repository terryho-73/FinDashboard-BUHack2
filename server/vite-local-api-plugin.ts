import type { IncomingMessage } from "node:http"
import type { Duplex } from "node:stream"
import path from "node:path"
import type { Plugin, ViteDevServer } from "vite"
import { WebSocketServer, type WebSocket } from "ws"
import { getLocalDb } from "./local-db"
import { handleLocalApi, snapshotForCollection } from "./local-api"

type SubFrame = {
  op?: string
  subId?: string
  collection?: string
}

/**
 * Node-friendly dev backend: SQLite CRUD at /api/* plus a minimal /__vibes_sub
 * WebSocket so @omg-dev/sdk snapshots load without waiting for reconnect give-up.
 */
export function localApiPlugin(): Plugin {
  let projectRoot = process.cwd()
  let wss: WebSocketServer | null = null

  function attachWs(server: ViteDevServer) {
    const httpServer = server.httpServer
    if (!httpServer || wss) return

    wss = new WebSocketServer({ noServer: true })

    httpServer.on("upgrade", (req: IncomingMessage, socket: Duplex, head: Buffer) => {
      const pathname = (req.url ?? "").split("?")[0]
      if (pathname !== "/__vibes_sub") return

      wss!.handleUpgrade(req, socket, head, (ws: WebSocket) => {
        ws.on("message", (raw) => {
          try {
            const frame = JSON.parse(String(raw)) as SubFrame
            if (frame.op === "sub" && frame.subId && frame.collection) {
              const rows = snapshotForCollection(frame.collection)
              ws.send(
                JSON.stringify({
                  type: "snapshot",
                  subId: frame.subId,
                  rows,
                  seq: Date.now(),
                }),
              )
            }
          } catch {
            ws.send(JSON.stringify({ type: "error", code: "bad_frame", message: "invalid JSON" }))
          }
        })
      })
    })
  }

  return {
    name: "pocketgoals-local-api",
    configResolved(config) {
      projectRoot = config.root
    },
    configureServer(server) {
      getLocalDb(projectRoot)
      attachWs(server)

      server.middlewares.use((req, res, next) => {
        const url = req.url ?? ""
        const pathname = url.split("?")[0] ?? ""

        if (pathname === "/__vibes_events" && req.method === "GET") {
          res.statusCode = 200
          res.setHeader("Content-Type", "text/event-stream; charset=utf-8")
          res.setHeader("Cache-Control", "no-cache")
          res.setHeader("Connection", "keep-alive")
          res.write(": keepalive\n\n")
          const timer = setInterval(() => {
            if (!res.writableEnded) res.write(": ping\n\n")
          }, 25000)
          req.on("close", () => clearInterval(timer))
          return
        }

        if (!pathname.startsWith("/api/")) return next()

        void handleLocalApi(req, res, url).then((handled) => {
          if (!handled) next()
        })
      })

      server.config.logger.info(
        `[pocketgoals] Local API + SQLite at ${path.join(projectRoot, ".data", "pocketgoals.sqlite")}`,
      )
    },
  }
}