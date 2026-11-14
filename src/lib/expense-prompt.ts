// Shared by the browser and the dev-server AI endpoint (server/ai-parse.ts),
// so keep this file free of "@/..." imports.
import { CHANNELS, EXPENSE_CATS, addDays, type Tx } from "./finance"

export type ParsedExpense = {
  title: string
  amount: number
  category: (typeof EXPENSE_CATS)[number]
  channel: Tx["channel"]
  date: string
}

export const EXPENSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          amount: { type: "number" },
          category: { type: "string", enum: [...EXPENSE_CATS] },
          channel: { type: "string", enum: [...CHANNELS] },
          days_ago: { type: "integer" },
        },
        required: ["title", "amount", "category", "channel", "days_ago"],
      },
    },
  },
  required: ["items"],
}

export const EXPENSE_SYSTEM = `You turn a Hong Kong student's spoken or typed note into expense records.
The note can be in any language or a mix (English, Cantonese, Mandarin, Japanese, Korean, Tagalog, Indonesian, Hindi, ...),
and may come from speech-to-text, so expect missing punctuation and numbers written as words.
Return one item per purchase mentioned.
- title: short merchant or item name, keep the user's language (e.g. "Lunch", "奶茶", "MTR").
- amount: HK dollars as a number ("68蚊" → 68, "$12.5" → 12.5, "百五" → 150, "sixty eight" → 68, "六十八块" → 68).
- category: food | transport | shopping | entertainment | bills | subscription | other.
  MTR/bus/minibus/taxi/的士/港鐵/巴士 = transport. Meals, drinks, 茶餐廳, 奶茶, coffee = food.
  Netflix/Spotify/gym membership = subscription.
- channel: octopus (八達通) | payme | alipayhk | fps (轉數快) | credit (visa/master/信用卡) | cash (現金) | bank | other.
  If not said: MTR/bus default octopus, otherwise other.
- days_ago: 0 for today; yesterday in any language ("yesterday", "尋日", "琴日", "昨天", "昨日", "kahapon", "kemarin") = 1; the day before = 2.
If no amount is mentioned, return no item for it.
Reply with JSON only, shaped like {"items":[{"title":"Lunch","amount":68,"category":"food","channel":"payme","days_ago":0}]}.`

/** Pull the JSON object out of a model reply (tolerates ```json fences). */
export function extractJson(text: string): unknown {
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  if (start < 0 || end <= start) return {}
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    return {}
  }
}

/** Validate and clamp whatever the model returned. */
export function normalizeExpenses(raw: unknown, today: string): ParsedExpense[] {
  const items = (raw as { items?: unknown })?.items
  if (!Array.isArray(items)) return []
  return items
    .map((i) => i as { title?: unknown; amount?: unknown; category?: unknown; channel?: unknown; days_ago?: unknown })
    .filter((i) => typeof i.amount === "number" && i.amount > 0)
    .map((i) => ({
      title: String(i.title ?? "").trim().slice(0, 60) || "Expense",
      amount: Math.round((i.amount as number) * 100) / 100,
      category: (EXPENSE_CATS as readonly unknown[]).includes(i.category)
        ? (i.category as ParsedExpense["category"])
        : "other",
      channel: (CHANNELS as readonly unknown[]).includes(i.channel) ? (i.channel as Tx["channel"]) : "other",
      date: addDays(today, -Math.min(30, Math.max(0, Math.round(Number(i.days_ago) || 0)))),
    }))
}
