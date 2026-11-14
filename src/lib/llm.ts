import type { ParsedExpense } from "@/lib/expense-prompt"

export type { ParsedExpense }

// The dev server's /ai/parse-expense endpoint (server/ai-parse.ts) holds the
// API key and talks to HKBU GenAI, or local Ollama when no key is set.
export class LlmUnavailable extends Error {}

export async function parseExpenses(text: string, today: string, signal?: AbortSignal): Promise<ParsedExpense[]> {
  let res: Response
  try {
    res = await fetch("/ai/parse-expense", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, today }),
      signal,
    })
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e
    throw new LlmUnavailable("AI endpoint not reachable")
  }
  const data = (await res.json().catch(() => ({}))) as { items?: ParsedExpense[]; error?: string }
  if (res.status === 503 || res.status === 404) throw new LlmUnavailable(data.error ?? "No AI configured")
  if (!res.ok) throw new Error(data.error ?? `AI error ${res.status}`)
  return data.items ?? []
}
