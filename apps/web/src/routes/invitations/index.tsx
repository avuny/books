import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router"
import { useAuthenticatedHandler } from "@/features/auth"
import { MyInvitationList } from "@/features/invitation-module"
import { ROUTES } from "@/features/routes"

// Unlike /invitations/accept, the inbox is per-user: it needs a session.
export const Route = createFileRoute("/invitations/")({
  component: MyInvitationsRoute,
})

function MyInvitationsRoute() {
  const navigate = useNavigate()
  const { data } = useAuthenticatedHandler()

  if (!data?.success) return <Navigate to={ROUTES.auth.index} replace />

  return (
    <MyInvitationList
      onAccepted={() => {
        void navigate({ to: "/organization", search: { all: true } })
      }}
    />
  )
}
