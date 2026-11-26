import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { PartyList } from "@/features/party-module"

export const Route = createFileRoute("/organization/$orgId/vendors/")({
  component: VendorsPage,
})

function VendorsPage() {
  const { orgId } = Route.useParams()
  const navigate = useNavigate()

  return (
    <PartyList
      orgId={orgId}
      role="VENDOR"
      onViewParty={(partyId) =>
        navigate({
          to: "/organization/$orgId/vendors/$partyId",
          params: { orgId, partyId },
        })
      }
    />
  )
}
