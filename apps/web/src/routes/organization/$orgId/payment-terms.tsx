import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { PaymentTermsPage } from "@/features/purchase-order-module"

export const Route = createFileRoute("/organization/$orgId/payment-terms")({
  component: PaymentTermsRoute,
})

function PaymentTermsRoute() {
  const { orgId } = Route.useParams()
  const navigate = useNavigate()
  return (
    <PaymentTermsPage
      orgId={orgId}
      onBack={() => navigate({ to: "/organization/$orgId/purchase-orders", params: { orgId } })}
    />
  )
}
