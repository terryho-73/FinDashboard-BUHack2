import { createRootRoute } from "@tanstack/react-router"
import { PrefsProvider } from "@/lib/prefs"
import { DataBackendProvider } from "@/lib/data-backend"
import { SavingsDataProvider } from "@/lib/savings-data"
import { AppLayout } from "@/components/AppLayout"

export const Route = createRootRoute({
  component: () => (
    <PrefsProvider>
      <DataBackendProvider>
        <SavingsDataProvider>
          <AppLayout />
        </SavingsDataProvider>
      </DataBackendProvider>
    </PrefsProvider>
  ),
})