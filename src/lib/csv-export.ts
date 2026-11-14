import type { Tx } from "@/lib/finance"

function escapeCsvCell(value: string | number | boolean): string {
  const s = String(value ?? "")
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

/** Export transactions as CSV without papaparse (avoids blank app if package is missing). */
export function exportTransactionsToCsv(txs: Tx[], filename = "savings-jars-export.csv") {
  const headers = ["date", "title", "amount", "kind", "category", "channel", "goal_id", "recurring"]
  const lines = [headers.join(",")]

  for (const tx of txs) {
    const row = [
      tx.date,
      tx.title,
      tx.amount,
      tx.kind,
      tx.category || "other",
      tx.channel || "",
      tx.goal_id || "",
      tx.recurring ? "true" : "false",
    ].map(escapeCsvCell)
    lines.push(row.join(","))
  }

  const csv = lines.join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.setAttribute("download", filename)
  link.rel = "noopener"
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
