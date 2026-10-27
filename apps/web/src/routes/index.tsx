import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import { Navbar } from "@workspace/ui/blocks/layout/navbar"
import ModeSwitcherBtn from "@workspace/ui/blocks/buttons/mode-switcher-btn"
import UserButton from "@/components/buttons/user-button"

import { useSignOut } from "@/api"
import DashboardButton from "@/components/buttons/dashboard-button"
import { HomeButton } from "@/components/buttons/home-button"
import { LanguageSwitcherButton } from "@/components/buttons/language-button"
import { useAuthenticatedHandler } from "@/features/auth"

export const Route = createFileRoute("/")({
  component: Index,
})

function Index() {
  const { t } = useTranslation("common")
  const navigate = useNavigate()

  const { mutateAsync: signOut, isPending } = useSignOut({})
  const { data, isLoading } = useAuthenticatedHandler()
  const useSignOutHandler = () => ({
    submit: async () => {
      await signOut()
    },
    isPending,
  })

  return (
    <>
      <Navbar
        start={
          <>
            <HomeButton />
            <DashboardButton />
          </>
        }
        end={
          <>
            <UserButton
              user={data?.data}
              isLoading={isLoading}
              onClick={() => {
                void navigate({ to: "/auth/sign-in" })
              }}
              useSignOutHandler={useSignOutHandler}
            />

            <ModeSwitcherBtn />
            <LanguageSwitcherButton />
          </>
        }
      />

      <div className="flex min-h-svh p-6">
        <div className="flex max-w-md min-w-0 flex-col gap-4 text-sm leading-loose">
          <h1>{t("msgs.confirmDeleteDescription")}</h1>

          <div className="font-mono text-xs text-muted-foreground">
            (Press <kbd>d</kbd> to toggle dark mode)
          </div>
        </div>
      </div>
    </>
  )
}
