import { createFileRoute } from "@tanstack/react-router"
import App from "@/App"

// "/" — the home route. src/App.tsx stays the home view, so the build-time
// prerender (which renders the app's root view into dist/index.html) keeps
// working exactly as before.
export const Route = createFileRoute("/")({
  component: App,
})
