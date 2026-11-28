import { createFileRoute } from "@tanstack/react-router"

import { RolesList } from "@/features/platform-role-module"

export const Route = createFileRoute("/_authed/roles/")({
  component: RolesRoute,
})

function RolesRoute() {
  return <RolesList />
}
