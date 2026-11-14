import { defineSchema, collection, fields } from "@omg-dev/schema"

// Savings Jars HK — data model.
// goals: tangible saving buckets (saved amount is derived from saving transactions)
// transactions: every expense, income (payday) and top-up, across all channels
// settings: one row per user with the monthly budget inputs
export default defineSchema({
  collections: {
    goals: collection({
      fields: {
        name: fields.string(),
        target: fields.number(),
        emoji: fields.string(),
        color: fields.enum(["rose", "amber", "sky", "emerald", "violet"]),
      },
    }),
    transactions: collection({
      fields: {
        title: fields.string(),
        amount: fields.number(),
        kind: fields.enum(["expense", "income", "saving"]),
        category: fields.enum([
          "food",
          "transport",
          "shopping",
          "entertainment",
          "bills",
          "subscription",
          "other",
          "income",
          "saving",
        ]),
        channel: fields.enum([
          "octopus",
          "payme",
          "alipayhk",
          "fps",
          "credit",
          "cash",
          "bank",
          "other",
        ]),
        date: fields.date(),
        goal_id: fields.string(),
        recurring: fields.boolean(),
        source: fields.enum(["manual", "csv", "roundup", "payday", "topup", "demo"]),
      },
    }),
    settings: collection({
      fields: {
        monthly_income: fields.number(),
        rent: fields.number(),
        utilities: fields.number(),
        mpf: fields.number(),
        save_pct: fields.number(),
        round_to: fields.number(),
        roundup_on: fields.boolean(),
      },
    }),
  },
})
