import { createFileRoute, redirect } from "@tanstack/react-router"

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    // The authed layout sends signed-out admins to /sign-in.
    throw redirect({ to: "/admins" })
  },
})
