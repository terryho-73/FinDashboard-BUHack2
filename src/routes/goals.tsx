import { createFileRoute } from "@tanstack/react-router"
import { GoalsView } from "@/views/goals-view"

export const Route = createFileRoute("/goals")({
  component: GoalsView,
})