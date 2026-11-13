import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/organization/$orgId/warehouse")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/organization/$orgId/warehouses", params: { orgId: params.orgId } })
  },
})
