import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import { Navbar } from "@workspace/ui/blocks/layout/navbar"
import ModeSwitcherBtn from "@workspace/ui/blocks/buttons/mode-switcher-btn"
import UserButton from "@workspace/ui/blocks/buttons/user-btn"

import { useSignOut } from "@/api"
import { HomeButton } from "@/components/buttons/home-button"
import { LanguageSwitcherButton } from "@/components/buttons/language-button"

export const Route = createFileRoute("/")({
  component: Index,
})

function Index() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const { mutateAsync: signOut, isPending } = useSignOut({})

  const useSignOutHandler = () => ({
    submit: async () => {
      await signOut()
    },
    isPending,
  })

  return (
    <>
      <Navbar
        start={<HomeButton />}
        end={
          <>
            <UserButton
              user={undefined}
              isLoading={false}
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
          <h1>{t("common.welcome")}</h1>

          <div className="font-mono text-xs text-muted-foreground">
            (Press <kbd>d</kbd> to toggle dark mode)
          </div>
        </div>
      </div>
    </>
  )
}
