import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router"
import {
  Eye,
  EyeOff,
  Home,
  List,
  Moon,
  PiggyBank,
  Receipt,
  Settings as SettingsIcon,
  Sun,
  Wallet,
  X,
  AlertCircle,
  Loader2,
  FileUp,
  Mic,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { BottomNav } from "@/components/ui/bottom-nav"
import { usePrefs } from "@/lib/prefs"
import { useSavingsData } from "@/lib/savings-data"
import { seedDemo } from "@/lib/seed"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  ExpenseSheet,
  GoalSheet,
  PaydaySheet,
  SettingsSheet,
  TopUpSheet,
} from "@/components/QuickSheets"
import { QuickLogSheet } from "@/components/QuickLog"
import { HomeCalendarDock } from "@/components/HomeCalendarDock"
import { savingPacePerDay, summary, todayISO, type Goal } from "@/lib/finance"

type SheetKey = "quicklog" | "expense" | "topup" | "payday" | "goal" | "settings" | null
type NavId = "home" | "activity" | "goals" | "import"

const DEMO_BANNER_KEY = "pocketgoals-demo-banner-dismissed"

type SheetActions = {
  openTopUp: (jarId?: string) => void
  openNewGoal: () => void
  openExpense: () => void
  openPayday: () => void
  openSettings: () => void
  openQuickLog: () => void
}

const SheetActionsCtx = createContext<SheetActions | null>(null)

export function useSheetActions() {
  const v = useContext(SheetActionsCtx)
  if (!v) throw new Error("useSheetActions must be used inside AppLayout")
  return v
}

export function AppLayout() {
  const navigate = useNavigate()
  const { t, lang, setLang, dark, setDark, hidden, setHidden } = usePrefs()
  const { loading, empty, error, offline, hasDemoData, api, refreshAll, clearAll, goals, txs, settings } =
    useSavingsData()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const today = todayISO()
  const spendSummary = useMemo(() => summary(txs, settings, today), [txs, settings, today])
  const pacePerDay = useMemo(() => savingPacePerDay(txs, settings, today), [txs, settings, today])
  const focusGoal: Goal | null = goals[0] ?? null

  const [sheet, setSheet] = useState<SheetKey>(null)
  const [topUpJar, setTopUpJar] = useState<string | undefined>(undefined)
  const [demoBannerOpen, setDemoBannerOpen] = useState(false)

  useEffect(() => {
    if (!hasDemoData) {
      setDemoBannerOpen(false)
      return
    }
    try {
      setDemoBannerOpen(localStorage.getItem(DEMO_BANNER_KEY) !== "1")
    } catch {
      setDemoBannerOpen(true)
    }
  }, [hasDemoData])

  function dismissDemoBanner() {
    setDemoBannerOpen(false)
    try {
      localStorage.setItem(DEMO_BANNER_KEY, "1")
    } catch {
      /* ignore */
    }
  }

  function navActive(): NavId {
    if (pathname === "/activity") return "activity"
    if (pathname === "/goals") return "goals"
    if (pathname === "/import") return "import"
    return "home"
  }

  function openTopUp(jarId?: string) {
    setTopUpJar(jarId)
    setSheet("topup")
  }

  const showBlockingLoad = loading && empty && !error

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex w-full max-w-md items-center gap-2 px-4 py-3">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold tracking-tight">{t.appName}</h1>
            <p className="truncate text-xs text-muted-foreground">{t.tagline}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setLang(lang === "en" ? "zh" : "en")}
            aria-label={t.lang}
            className="h-9 px-2.5 text-xs font-medium"
          >
            {t.lang}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setHidden(!hidden)}
            aria-label={hidden ? t.show : t.hide}
            aria-pressed={hidden}
            className="size-9"
          >
            {hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDark(!dark)}
            aria-label={t.darkMode}
            aria-pressed={dark}
            className="size-9"
          >
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSheet("settings")}
            aria-label={t.settingsTitle}
            className="size-9"
          >
            <SettingsIcon className="size-4" />
          </Button>
        </div>

        {demoBannerOpen && (
          <div className="border-t border-accent/30 bg-accent/15 px-4 py-2.5">
            <div className="mx-auto flex max-w-md items-start gap-2">
              <p className="min-w-0 flex-1 text-xs text-foreground">{t.demoBanner}</p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                aria-label={t.demoBannerDismiss}
                onClick={dismissDemoBanner}
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>
        )}

        {offline && (
          <div className="border-t border-accent/30 bg-accent/15 px-4 py-2.5">
            <p className="mx-auto max-w-md text-center text-xs text-foreground">{t.offlineBanner}</p>
          </div>
        )}

        {error && !offline && (
          <div className="border-t border-destructive/30 bg-destructive/10 px-4 py-3" role="alert">
            <div className="mx-auto flex max-w-md items-center gap-3">
              <AlertCircle className="size-5 shrink-0 text-destructive" aria-hidden />
              <p className="min-w-0 flex-1 text-xs text-destructive">{t.dataError}</p>
              <Button type="button" size="sm" variant="outline" className="h-8 shrink-0" onClick={refreshAll}>
                {t.retry}
              </Button>
            </div>
          </div>
        )}
      </header>

      <main
        className={cn(
          "mx-auto flex w-full max-w-md flex-col gap-5 px-4 pt-4",
          pathname === "/"
            ? "pb-[calc(21rem+env(safe-area-inset-bottom))]"
            : "pb-[calc(9.5rem+env(safe-area-inset-bottom))]",
        )}
      >
        {showBlockingLoad && (
          <div className="flex flex-col items-center gap-3 py-16 text-center" role="status" aria-live="polite">
            <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
            <p className="text-sm text-muted-foreground">{t.emptyLoading}</p>
          </div>
        )}

        {!showBlockingLoad && empty && pathname === "/" && (
          <Card className="gap-3 p-5 text-center">
            <p className="text-sm text-muted-foreground">{t.demoHint}</p>
            <Button
              onClick={() => seedDemo(api as unknown as Parameters<typeof seedDemo>[0])}
              className="h-11"
            >
              {t.demo}
            </Button>
          </Card>
        )}

        <SheetActionsCtx.Provider
          value={{
            openTopUp,
            openNewGoal: () => setSheet("goal"),
            openExpense: () => setSheet("expense"),
            openPayday: () => setSheet("payday"),
            openSettings: () => setSheet("settings"),
            openQuickLog: () => setSheet("quicklog"),
          }}
        >
          <Outlet />
        </SheetActionsCtx.Provider>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85 pb-[calc(4.75rem+env(safe-area-inset-bottom))]">
        {pathname === "/" && <HomeCalendarDock />}
        <nav aria-label={t.quickActionsNav} className="pt-2">
          <div className="mx-auto grid w-full max-w-md grid-cols-4 gap-1.5 px-4 pb-2">
            <Button onClick={() => setSheet("quicklog")} className="h-11 flex-col gap-0.5 px-1 text-[10px]" size="lg">
              <Mic className="size-4" />
              {t.quickLog}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setSheet("expense")}
              className="h-11 flex-col gap-0.5 px-1 text-[10px]"
              size="lg"
            >
              <Receipt className="size-4" />
              {t.logExpense}
            </Button>
            <Button
              variant="secondary"
              onClick={() => openTopUp()}
              className="h-11 flex-col gap-0.5 px-1 text-[10px]"
              size="lg"
            >
              <PiggyBank className="size-4" />
              {t.topUp}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setSheet("payday")}
              className="h-11 flex-col gap-0.5 px-1 text-[10px]"
              size="lg"
            >
              <Wallet className="size-4" />
              {t.payday}
            </Button>
          </div>
        </nav>
      </div>

      <RouteBottomNav active={navActive()} onNavigate={(to) => navigate({ to })} />

      <QuickLogSheet
        open={sheet === "quicklog"}
        onOpenChange={(v) => setSheet(v ? "quicklog" : null)}
        api={api}
        safeToday={spendSummary.perDay}
        pacePerDay={pacePerDay}
        focusGoal={focusGoal}
        onOpenForm={() => setSheet("expense")}
      />
      <ExpenseSheet open={sheet === "expense"} onOpenChange={(v) => setSheet(v ? "expense" : null)} api={api} />
      <TopUpSheet
        key={topUpJar ?? "none"}
        open={sheet === "topup"}
        onOpenChange={(v) => setSheet(v ? "topup" : null)}
        api={api}
        initialJarId={topUpJar}
      />
      <PaydaySheet open={sheet === "payday"} onOpenChange={(v) => setSheet(v ? "payday" : null)} api={api} />
      <GoalSheet open={sheet === "goal"} onOpenChange={(v) => setSheet(v ? "goal" : null)} api={api} />
      <SettingsSheet
        open={sheet === "settings"}
        onOpenChange={(v) => setSheet(v ? "settings" : null)}
        api={api}
        offline={offline}
        onClear={clearAll}
      />
    </div>
  )
}

function RouteBottomNav({
  active,
  onNavigate,
}: {
  active: NavId
  onNavigate: (to: "/" | "/activity" | "/goals" | "/import") => void
}) {
  const { t } = usePrefs()

  return (
    <BottomNav
      active={active}
      onSelect={(id) => {
        const paths: Record<NavId, "/" | "/activity" | "/goals" | "/import"> = {
          home: "/",
          activity: "/activity",
          goals: "/goals",
          import: "/import",
        }
        onNavigate(paths[id as NavId])
      }}
      tabs={[
        { id: "home", label: t.navHome, Icon: Home },
        { id: "activity", label: t.navActivity, Icon: List },
        { id: "goals", label: t.navGoals, Icon: PiggyBank },
        { id: "import", label: t.navImport, Icon: FileUp },
      ]}
    />
  )
}

/** Wrap a route view with consistent page spacing when needed */
export function Page({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-5">{children}</div>
}