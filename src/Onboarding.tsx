import { useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { ArrowRight, PiggyBank, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { SettingsSheet } from "@/components/QuickSheets"
import { usePrefs } from "@/lib/prefs-context"
import { useSavingsData } from "@/lib/savings-data"
import { seedDemo } from "@/lib/seed"

export default function Onboarding() {
  const { t } = usePrefs()
  const navigate = useNavigate()
  const { api, settings, goals, txs, loading, offline } = useSavingsData()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [demoBusy, setDemoBusy] = useState(false)
  const [demoError, setDemoError] = useState<string | null>(null)

  const goHome = () => void navigate({ to: "/", replace: true })

  async function loadDemo() {
    if (demoBusy) return
    setDemoBusy(true)
    setDemoError(null)
    try {
      // Only seed an empty account, so a double tap or a revisit can't duplicate data.
      if (goals.length === 0 && txs.length === 0) {
        await seedDemo(api as unknown as Parameters<typeof seedDemo>[0])
      }
      goHome()
    } catch (error) {
      setDemoError(error instanceof Error ? error.message : "Unable to load demo data")
      setDemoBusy(false)
    }
  }

  return (
    <div className="min-h-svh bg-background px-4 py-8 text-foreground">
      <main className="mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-md items-center">
        <Card className="w-full overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background p-0">
          <div className="p-5 text-center">
            <div className="mb-4 flex justify-center">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                <PiggyBank className="size-7" aria-hidden="true" />
              </div>
            </div>
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">{t.onboardingEyebrow}</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">{t.onboardingTitle}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{t.onboardingSubtitle}</p>
          </div>

          <div className="border-t bg-muted/30 p-4">
            <div className="space-y-3">
              {[
                [t.onboardingStep1Title, t.onboardingStep1Text],
                [t.onboardingStep2Title, t.onboardingStep2Text],
                [t.onboardingStep3Title, t.onboardingStep3Text],
              ].map(([title, text], index) => (
                <div key={title} className="flex items-start gap-3 rounded-2xl bg-background/80 p-3">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {index + 1}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 p-5 pt-4">
            <Button onClick={() => setSettingsOpen(true)} disabled={demoBusy} className="h-11 flex-1 gap-2">
              {t.onboardingSetup}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
            <Button
              variant="secondary"
              onClick={() => void loadDemo()}
              disabled={demoBusy || loading}
              className="h-11"
            >
              <Sparkles className="mr-2 size-4" aria-hidden="true" />
              {demoBusy ? t.onboardingDemoLoading : t.onboardingDemo}
            </Button>
          </div>
          {demoError && <p role="alert" className="px-5 pb-5 text-sm text-destructive">{demoError}</p>}
        </Card>
      </main>

      <SettingsSheet
        key={settings?.id ?? "new"}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        api={api}
        offline={offline}
        onSaved={goHome}
      />
    </div>
  )
}
