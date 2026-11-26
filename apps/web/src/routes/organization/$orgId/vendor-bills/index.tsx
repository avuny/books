import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { VendorBillList } from "@/features/vendor-bill-module"

export const Route = createFileRoute("/organization/$orgId/vendor-bills/")({
  component: VendorBillsPage,
})

function VendorBillsPage() {
  const { orgId } = Route.useParams()
  const navigate = useNavigate()
  return (
    <VendorBillList
      orgId={orgId}
      onViewBill={(billId) =>
        navigate({ to: "/organization/$orgId/vendor-bills/$billId", params: { orgId, billId } })
      }
    />
  )
}
