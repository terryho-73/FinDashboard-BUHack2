import { useState, useRef, type ChangeEvent } from "react"
import { FileUp, CheckCircle2, AlertCircle, Copy, Loader2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { usePrefs } from "@/lib/prefs"
import { Page } from "@/components/AppLayout"
import { analyzeCsv, existingKeysFrom, type ImportAnalysis } from "@/lib/csv-import"
import { format } from "@/lib/i18n"

// 1. Import the correct custom hook from your savings-data.tsx
import { useSavingsData } from "@/lib/savings-data" 

export function ImportView() {
  const { t } = usePrefs()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [analysis, setAnalysis] = useState<ImportAnalysis | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  // 2. Use your team's custom data hook
  const { txs, goals, api } = useSavingsData()

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsParsing(true)
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      
      const result = analyzeCsv(text, {
        // 3. Pass the txs (transactions) and map the goals
        existingKeys: existingKeysFrom(txs),
        existingGoalIds: goals.map(g => g.id) 
      })
      
      setAnalysis(result)
      setIsParsing(false)
    }
    reader.readAsText(file)
  }

  const handleConfirmImport = async () => {
    if (!analysis || analysis.payload.length === 0) return
    
    setIsImporting(true)
    try {
      // 4. Save to the database using your api.addTx method
      for (const tx of analysis.payload) {
        await api.addTx(tx as never) // 'as never' might be needed if TS complains, but your api handles it
      }
      
      alert(format(t.importSuccess, { count: analysis.payload.length }))
      
      setAnalysis(null)
      if (fileInputRef.current) fileInputRef.current.value = ""
    } catch (err) {
      console.error(err)
      alert("Import failed. Please try again.")
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <Page>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t.importTitle}</h2>
      </div>

      {!analysis ? (
        <Card className="flex flex-col items-center gap-4 p-8 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
            <FileUp className="size-7 text-muted-foreground" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-medium">{t.importUploadTitle}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {t.importUploadHint}
            </p>
          </div>
          
          <input
            type="file"
            accept=".csv"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
          <Button 
            onClick={() => fileInputRef.current?.click()} 
            disabled={isParsing}
          >
            {isParsing ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            {t.importSelectFile}
          </Button>

          <a 
            href="/templates/transactions-template.csv" 
            download 
            className="text-xs text-primary underline mt-2"
          >
            {t.importDownloadTemplate}
          </a>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Summary Card */}
          <Card className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">{t.importReadyTitle}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {format(t.importSummary, {
                  valid: analysis.summary.valid,
                  invalid: analysis.summary.invalid,
                  duplicate: analysis.summary.duplicate
                })}
              </p>
            </div>
            <Button 
              onClick={handleConfirmImport} 
              disabled={analysis.summary.valid === 0 || isImporting}
            >
              {isImporting && <Loader2 className="mr-2 size-4 animate-spin" />}
              {t.importConfirm}
            </Button>
          </Card>

          {/* Preview List */}
          <div className="rounded-md border">
            <div className="max-h-[60vh] overflow-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted text-muted-foreground sticky top-0">
                  <tr>
                    <th className="p-3 font-medium">{t.dateLabel}</th>
                    <th className="p-3 font-medium">{t.titleLabel}</th>
                    <th className="p-3 font-medium">{t.amountLabel}</th>
                    <th className="p-3 font-medium">{t.importStatus}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {analysis.rows.map((row) => (
                    <tr key={row.index} className="hover:bg-muted/50">
                      <td className="p-3 whitespace-nowrap">{row.raw.date || "-"}</td>
                      <td className="p-3 max-w-[150px] truncate">{row.raw.title || "-"}</td>
                      <td className="p-3">{row.raw.amount || "-"}</td>
                      <td className="p-3">
                        {row.status === "valid" && (
                          <span className="flex items-center text-green-600 text-xs font-medium">
                            <CheckCircle2 className="mr-1 size-3" /> {t.importStatusValid}
                          </span>
                        )}
                        {row.status === "invalid" && (
                          <span className="flex items-center text-destructive text-xs font-medium" title={row.issues.map(i => i.message).join("\n")}>
                            <AlertCircle className="mr-1 size-3" /> {t.importStatusInvalid}
                          </span>
                        )}
                        {row.status === "duplicate" && (
                          <span className="flex items-center text-amber-600 text-xs font-medium" title="Skipped: Duplicate">
                            <Copy className="mr-1 size-3" /> {t.importStatusDuplicate}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <Button 
            variant="outline" 
            className="w-full" 
            onClick={() => setAnalysis(null)}
          >
            {t.cancel}
          </Button>
        </div>
      )}
    </Page>
  )
}