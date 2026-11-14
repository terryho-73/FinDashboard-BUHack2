import { createFileRoute } from "@tanstack/react-router"
import { ImportView } from "@/views/import-view"

export const Route = createFileRoute("/import")({
  component: ImportView,
})