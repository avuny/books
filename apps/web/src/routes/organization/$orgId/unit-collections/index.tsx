import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { UnitCollectionList } from "@/features/unit-module"

export const Route = createFileRoute("/organization/$orgId/unit-collections/")({
  component: UnitCollectionsPage,
})

function UnitCollectionsPage() {
  const { orgId } = Route.useParams()
  const navigate = useNavigate()

  return (
    <UnitCollectionList
      orgId={orgId}
      onViewCollection={(collectionId) =>
        navigate({
          to: "/organization/$orgId/unit-collections/$collectionId",
          params: { orgId, collectionId },
        })
      }
    />
  )
}
