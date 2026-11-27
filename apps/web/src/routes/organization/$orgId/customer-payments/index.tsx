import { createFileRoute } from "@tanstack/react-router"

import { CustomerPaymentList } from "@/features/customer-payment-module"

export const Route = createFileRoute("/organization/$orgId/customer-payments/")({
  component: CustomerPaymentsPage,
})

function CustomerPaymentsPage() {
  const { orgId } = Route.useParams()
  return <CustomerPaymentList orgId={orgId} />
}
