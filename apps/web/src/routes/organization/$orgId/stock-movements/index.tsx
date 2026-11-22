import { createFileRoute } from "@tanstack/react-router"
import { StockMovementList } from "@/features/stock-movement-module"

export const Route = createFileRoute(
  "/organization/$orgId/stock-movements/"
)({
  component: StockMovementsPage,
})

function StockMovementsPage() {
  const { orgId } = Route.useParams()

  return <StockMovementList orgId={orgId} />
}
