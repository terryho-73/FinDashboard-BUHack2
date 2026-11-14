import type { Connect } from "vite"
import { EXPENSE_SCHEMA, EXPENSE_SYSTEM, extractJson, normalizeExpenses } from "../src/lib/expense-prompt"

// POST /ai/parse-expense  { text, today }  →  { items, provider }
//
// Runs inside the dev server so the API key never reaches the browser.
// Provider order:
//   1. HKBU GenAI (OpenAI-compatible) when HKBU_GENAI_API_KEY is set
//   2. Local Ollama (free) otherwise
// Configure in .env.local (git-ignored):
//   HKBU_GENAI_API_KEY=...
//   HKBU_GENAI_BASE_URL=...      optional, defaults to https://genai.hkbu.edu.hk/api/v1
//   HKBU_GENAI_MODEL=...         optional, defaults to gpt-6-luna
//   OLLAMA_HOST=http://127.0.0.1:11434   OLLAMA_MODEL=qwen2.5:3b

const HKBU_DEFAULT_BASE = "https://genai.hkbu.edu.hk/api/v1"
const HKBU_DEFAULT_MODEL = "gpt-6-luna"

type Env = Record<string, string | undefined>

class HttpError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function readJson(req: Connect.IncomingMessage) {
  const chunks: Buffer[] = []
  for await (const c of req) chunks.push(c as Buffer)
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as { text?: string; today?: string }
}

// Same call as `client.responses.create({ model, instructions, input })` from
// the openai SDK, made with fetch so the app doesn't need another dependency.
async function viaResponses(env: Env, text: string) {
  const base = (env.HKBU_GENAI_BASE_URL || HKBU_DEFAULT_BASE).replace(/\/+$/, "")
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${env.HKBU_GENAI_API_KEY}` }
  const body = {
    model: env.HKBU_GENAI_MODEL || HKBU_DEFAULT_MODEL,
    instructions: EXPENSE_SYSTEM,
    input: text,
    text: { format: { type: "json_schema", name: "expenses", schema: EXPENSE_SCHEMA, strict: true } },
  }
  let res = await fetch(`${base}/responses`, { method: "POST", headers, body: JSON.stringify(body) })
  // Some gateways/models reject structured output; the prompt already asks for JSON.
  if (res.status === 400) {
    const { text: _drop, ...plain } = body
    void _drop
    res = await fetch(`${base}/responses`, { method: "POST", headers, body: JSON.stringify(plain) })
  }
  if (!res.ok) throw new HttpError(502, `HKBU GenAI ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const data = (await res.json()) as {
    output_text?: string
    output?: { content?: { type?: string; text?: string }[] }[]
  }
  // Raw REST has no `output_text` helper (that's an SDK convenience), so join the parts.
  return (
    data.output_text ??
    (data.output ?? [])
      .flatMap((o) => o.content ?? [])
      .filter((c) => c.type === "output_text")
      .map((c) => c.text ?? "")
      .join("")
  )
}

async function viaOllama(env: Env, text: string) {
  const host = (env.OLLAMA_HOST ?? "http://127.0.0.1:11434").replace(/\/+$/, "")
  let res: Response
  try {
    res = await fetch(`${host}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: env.OLLAMA_MODEL ?? "qwen2.5:3b",
        stream: false,
        format: EXPENSE_SCHEMA,
        options: { temperature: 0 },
        messages: [
          { role: "system", content: EXPENSE_SYSTEM },
          { role: "user", content: text },
        ],
      }),
    })
  } catch {
    throw new HttpError(503, "No AI configured: set HKBU_GENAI_API_KEY in .env.local, or start Ollama")
  }
  if (!res.ok) throw new HttpError(502, `Ollama ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const data = (await res.json()) as { message?: { content?: string } }
  return data.message?.content ?? ""
}

export function aiParsePlugin(getEnv: () => Env) {
  return {
    name: "ai-parse-expense",
    configureServer(server: { middlewares: { use: (path: string, fn: Connect.NextHandleFunction) => void } }) {
      server.middlewares.use("/ai/parse-expense", (req, res) => {
        const send = (status: number, body: unknown) => {
          res.statusCode = status
          res.setHeader("Content-Type", "application/json")
          res.end(JSON.stringify(body))
        }
        if (req.method !== "POST") return send(405, { error: "POST only" })
        void (async () => {
          try {
            const { text, today } = await readJson(req)
            const note = (text ?? "").trim().slice(0, 500)
            if (!note || !/^\d{4}-\d{2}-\d{2}$/.test(today ?? "")) return send(400, { error: "text and today required" })
            const env = getEnv()
            const useHkbu = !!(env.HKBU_GENAI_API_KEY)
            const reply = useHkbu ? await viaResponses(env, note) : await viaOllama(env, note)
            send(200, { items: normalizeExpenses(extractJson(reply), today!), provider: useHkbu ? "hkbu" : "ollama" })
          } catch (e) {
            const status = e instanceof HttpError ? e.status : 500
            console.error("[ai-parse]", (e as Error).message)
            send(status, { error: (e as Error).message })
          }
        })()
      })
    },
  }
}
