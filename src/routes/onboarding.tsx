import { createFileRoute } from "@tanstack/react-router"
import Onboarding from "@/Onboarding"

export const Route = createFileRoute("/onboarding")({
  component: Onboarding,
})
