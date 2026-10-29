import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/organization/$orgId/role")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/organization/$orgId/roles",
      params: { orgId: params.orgId },
    })
  },
})
