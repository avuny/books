import { createFileRoute } from "@tanstack/react-router"

import { VendorPaymentList } from "@/features/vendor-bill-module"

export const Route = createFileRoute("/organization/$orgId/vendor-payments/")({
  component: VendorPaymentsPage,
})

function VendorPaymentsPage() {
  const { orgId } = Route.useParams()
  return <VendorPaymentList orgId={orgId} />
}
