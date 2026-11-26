import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { PartyDetails } from "@/features/party-module"

export const Route = createFileRoute(
  "/organization/$orgId/customers/$partyId"
)({
  component: CustomerDetailsPage,
})

function CustomerDetailsPage() {
  const { orgId, partyId } = Route.useParams()
  const navigate = useNavigate()

  return (
    <PartyDetails
      orgId={orgId}
      partyId={partyId}
      role="CUSTOMER"
      onBack={() =>
        navigate({ to: "/organization/$orgId/customers", params: { orgId } })
      }
      onViewRole={(role) =>
        navigate({
          to:
            role === "CUSTOMER"
              ? "/organization/$orgId/customers/$partyId"
              : "/organization/$orgId/vendors/$partyId",
          params: { orgId, partyId },
        })
      }
    />
  )
}
