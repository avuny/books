import { createFileRoute, Outlet } from "@tanstack/react-router"
import { Navbar } from "@workspace/ui/blocks/layout/navbar"
import ModeSwitcherBtn from "@workspace/ui/blocks/buttons/mode-switcher-btn"
import LoadingPage from "@workspace/ui/blocks/loading/loading-page"
import { HomeButton } from "@/components/buttons/home-button"
import { LanguageSwitcherButton } from "@/components/buttons/language-button"
import UserButton from "@/components/buttons/user-button"
import { useAuthenticatedHandler } from "@/features/auth"

// Shell for every /invitations/* page. Children render only after the auth
// check settles, so they never flash a signed-out state.
export const Route = createFileRoute("/invitations")({
  component: InvitationsLayout,
})

function InvitationsLayout() {
  const { data, isLoading } = useAuthenticatedHandler()

  if (isLoading) return <LoadingPage />

  const isAuthenticated = Boolean(data?.success)

  return (
    <div className="flex h-dvh flex-col bg-muted">
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
      <main className="flex-1 overflow-auto p-6 md:p-8">
        <Outlet />
      </main>
    </div>
  )
}
