import { createFileRoute } from "@tanstack/react-router"

import { SalesCreditNoteList } from "@/features/sales-credit-note-module"

export const Route = createFileRoute("/organization/$orgId/sales-credit-notes/")({
  component: SalesCreditNotesPage,
})

function SalesCreditNotesPage() {
  const { orgId } = Route.useParams()
  return <SalesCreditNoteList orgId={orgId} />
}
