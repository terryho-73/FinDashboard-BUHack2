import { FileUp } from "lucide-react"
import { Card } from "@/components/ui/card"
import { usePrefs } from "@/lib/prefs"
import { Page } from "@/components/AppLayout"

export function ImportView() {
  const { t } = usePrefs()

  return (
    <Page>
      <h2 className="text-lg font-semibold">{t.importTitle}</h2>
      <Card className="flex flex-col items-center gap-4 p-8 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
          <FileUp className="size-7 text-muted-foreground" aria-hidden />
        </div>
        <p className="text-sm text-muted-foreground">{t.importComingSoon}</p>
        <p className="text-xs text-muted-foreground">{t.importSchemaNote}</p>
      </Card>
    </Page>
  )
}