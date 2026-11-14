import { createFileRoute } from "@tanstack/react-router"
import { ActivityView } from "@/views/activity-view"

export const Route = createFileRoute("/activity")({
  component: ActivityView,
})