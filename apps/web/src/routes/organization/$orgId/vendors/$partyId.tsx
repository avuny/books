import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { PartyDetails } from "@/features/party-module"

export const Route = createFileRoute(
  "/organization/$orgId/vendors/$partyId"
)({
  component: VendorDetailsPage,
})

function VendorDetailsPage() {
  const { orgId, partyId } = Route.useParams()
  const navigate = useNavigate()

  return (
    <PartyDetails
      orgId={orgId}
      partyId={partyId}
      role="VENDOR"
      onBack={() =>
        navigate({ to: "/organization/$orgId/vendors", params: { orgId } })
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
