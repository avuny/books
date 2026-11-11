import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { UnitList } from "@/features/unit-module"

export const Route = createFileRoute("/organization/$orgId/units/")({
  component: UnitsPage,
})

function UnitsPage() {
  const { orgId } = Route.useParams()
  const navigate = useNavigate()

  return (
    <UnitList
      orgId={orgId}
      onViewUnit={(unitId) =>
        navigate({
          to: "/organization/$orgId/units/$unitId",
          params: { orgId, unitId },
        })
      }
    />
  )
}

