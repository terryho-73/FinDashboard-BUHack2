import Papa from "papaparse"
import type { Tx } from "@/lib/finance" // Adjust based on your actual Tx type

export function exportTransactionsToCsv(txs: Tx[], filename = "savings-jars-export.csv") {
  // Map the transactions to match the CSV template format
  const data = txs.map(tx => ({
    date: tx.date,
    title: tx.title,
    amount: tx.amount,
    kind: tx.kind,
    category: tx.category || "other",
    channel: tx.channel || "",
    goal_id: tx.goal_id || "",
    recurring: tx.recurring ? "true" : "false",
  }))

  const csv = Papa.unparse(data)
  
  // Create a blob and trigger download
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.setAttribute("download", filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}