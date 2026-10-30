import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Navbar } from "@workspace/ui/blocks/layout/navbar"
import ModeSwitcherBtn from "@workspace/ui/blocks/buttons/mode-switcher-btn"
import LoadingPage from "@workspace/ui/blocks/loading/loading-page"
import { HomeButton } from "@/components/buttons/home-button"
import { LanguageSwitcherButton } from "@/components/buttons/language-button"
import UserButton from "@/components/buttons/user-button"
import { useAuthenticatedHandler } from "@/features/auth"
import { AcceptInvitation } from "@/features/invitation-module"
import { ROUTES } from "@/features/routes"

type AcceptInvitationSearch = {
  token?: string
}

// PUBLIC page (outside the /organization auth guard): the invitee may not have an
// account yet, and the invitation preview does not need one. Accepting does.
export const Route = createFileRoute("/invitations/accept")({
  validateSearch: (search: Record<string, unknown>): AcceptInvitationSearch => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  component: AcceptInvitationRoute,
})

function AcceptInvitationRoute() {
  const { token } = Route.useSearch()
  const navigate = useNavigate()
  const { data, isLoading } = useAuthenticatedHandler()

  if (isLoading) return <LoadingPage />

  const isAuthenticated = Boolean(data?.success)

  return (
    <div className="flex h-screen flex-col bg-muted">
      <Navbar
        start={<HomeButton />}
        end={
          <>
            {isAuthenticated ? <UserButton /> : null}
            <ModeSwitcherBtn />
            <LanguageSwitcherButton />
          </>
        }
      />
      <div className="flex-1 overflow-auto p-6 md:p-8">
        <AcceptInvitation
          token={token}
          isAuthenticated={isAuthenticated}
          onSignIn={() => {
            void navigate({ to: ROUTES.auth.index })
          }}
          onSuccess={() => {
            void navigate({ to: "/organization", search: { all: true } })
          }}
        />
      </div>
    </div>
  )
}
