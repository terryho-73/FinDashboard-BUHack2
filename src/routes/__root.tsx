import { createRootRoute } from "@tanstack/react-router"
import { PrefsProvider } from "@/lib/prefs"
import { SavingsDataProvider } from "@/lib/savings-data"
import { AppLayout } from "@/components/AppLayout"

export const Route = createRootRoute({
  component: () => (
    <PrefsProvider>
      <SavingsDataProvider>
        <AppLayout />
      </SavingsDataProvider>
    </PrefsProvider>
  ),
})