import { createRootRoute, Outlet } from "@tanstack/react-router"
import { PrefsProvider } from "@/lib/prefs"

// The shell every route renders inside. Language, dark mode and the privacy
// toggle are app-wide, so the provider wraps the whole tree.
export const Route = createRootRoute({
  component: () => (
    <PrefsProvider>
      <Outlet />
    </PrefsProvider>
  ),
})
