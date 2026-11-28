import { useEffect, type ReactNode } from "react"
import { useNavigate } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

import { Spinner } from "@workspace/ui/components/spinner"

import { PlatformShell } from "./platform-shell"
import { useCurrentAdmin } from "./use-current-admin"

type PlatformAuthedLayoutProps = {
  children: ReactNode
}

/** Gate for the signed-in area: no live session, no shell. */
export function PlatformAuthedLayout({ children }: PlatformAuthedLayoutProps) {
  const { t } = useTranslation("platform-admin")
  const navigate = useNavigate()
  const { isPending, isAuthenticated } = useCurrentAdmin()

  useEffect(() => {
    if (!isPending && !isAuthenticated) {
      void navigate({ to: "/sign-in" })
    }
  }, [isPending, isAuthenticated, navigate])

  if (isPending) {
    return (
      <div
        className="flex min-h-svh items-center justify-center gap-2 text-sm text-muted-foreground"
        role="status"
      >
        <Spinner className="size-4" />
        {t("shell.loading")}
      </div>
    )
  }
  if (!isAuthenticated) return null

  return <PlatformShell>{children}</PlatformShell>
}
