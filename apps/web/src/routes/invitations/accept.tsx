import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useAuthenticatedHandler } from "@/features/auth"
import { AcceptInvitation } from "@/features/invitation-module"
import { ROUTES } from "@/features/routes"

type AcceptInvitationSearch = {
  token?: string
}

// PUBLIC page (outside the /organization auth guard): the invitee may not have an
// account yet, and the invitation preview does not need one. Accepting does.
// Navbar + auth loading come from the parent /invitations layout.
export const Route = createFileRoute("/invitations/accept")({
  validateSearch: (
    search: Record<string, unknown>
  ): AcceptInvitationSearch => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  component: AcceptInvitationRoute,
})

function AcceptInvitationRoute() {
  const { token } = Route.useSearch()
  const navigate = useNavigate()
  const { data } = useAuthenticatedHandler()

  return (
    <AcceptInvitation
      token={token}
      isAuthenticated={Boolean(data?.success)}
      onSignIn={() => {
        void navigate({ to: ROUTES.auth.index })
      }}
      onSuccess={() => {
        void navigate({ to: "/organization", search: { all: true } })
      }}
    />
  )
}
