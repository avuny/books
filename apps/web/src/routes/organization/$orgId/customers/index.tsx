import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { PartyList } from "@/features/party-module"

export const Route = createFileRoute("/organization/$orgId/customers/")({
  component: CustomersPage,
})

function CustomersPage() {
  const { orgId } = Route.useParams()
  const navigate = useNavigate()

  return (
    <PartyList
      orgId={orgId}
      role="CUSTOMER"
      onViewParty={(partyId) =>
        navigate({
          to: "/organization/$orgId/customers/$partyId",
          params: { orgId, partyId },
        })
      }
    />
  )
}
