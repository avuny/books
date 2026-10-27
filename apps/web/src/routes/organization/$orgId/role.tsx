import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/organization/$orgId/role")({
  component: RolePage,
})

function RolePage() {
  const { orgId } = Route.useParams()
  return <h1 className="text-xl font-semibold">Roles for {orgId}</h1>
}
