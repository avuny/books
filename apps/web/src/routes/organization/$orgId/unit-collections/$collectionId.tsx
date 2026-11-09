import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { UnitCollectionDetails } from "@/features/unit-module"

export const Route = createFileRoute("/organization/$orgId/unit-collections/$collectionId")({
  component: UnitCollectionDetailsPage,
})

function UnitCollectionDetailsPage() {
  const { orgId, collectionId } = Route.useParams()
  const navigate = useNavigate()

  return (
    <UnitCollectionDetails
      orgId={orgId}
      collectionId={collectionId}
      onBack={() =>
        navigate({ to: "/organization/$orgId/unit-collections", params: { orgId } })
      }
    />
  )
}
