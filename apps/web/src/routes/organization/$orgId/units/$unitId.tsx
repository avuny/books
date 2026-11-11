import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { UnitDetails } from "@/features/unit-module"

export const Route = createFileRoute(
  "/organization/$orgId/units/$unitId"
)({
  component: UnitDetailsPage,
})

function UnitDetailsPage() {
  const { orgId, unitId } = Route.useParams()
  const navigate = useNavigate()

  return (
    <UnitDetails
      orgId={orgId}
      unitId={unitId}
      onBack={() =>
        navigate({
          to: "/organization/$orgId/units",
          params: { orgId },
        })
      }
    />
  )
}

