import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { VendorBillDetails } from "@/features/vendor-bill-module"

export const Route = createFileRoute("/organization/$orgId/vendor-bills/$billId")({
  component: VendorBillDetailsPage,
})

function VendorBillDetailsPage() {
  const { orgId, billId } = Route.useParams()
  const navigate = useNavigate()
  return (
    <VendorBillDetails
      orgId={orgId}
      billId={billId}
      onBack={() => navigate({ to: "/organization/$orgId/vendor-bills", params: { orgId } })}
    />
  )
}
