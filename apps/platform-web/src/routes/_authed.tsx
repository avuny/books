import { Outlet, createFileRoute } from "@tanstack/react-router"

import { PlatformAuthedLayout } from "@/features/platform-auth-module"

export const Route = createFileRoute("/_authed")({
  component: AuthedLayoutRoute,
})

function AuthedLayoutRoute() {
  return (
    <PlatformAuthedLayout>
      <Outlet />
    </PlatformAuthedLayout>
  )
}
