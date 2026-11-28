import { useState, type ReactNode } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { ShieldCheck } from "lucide-react"

import { Button, buttonVariants } from "@workspace/ui/components/button"

import { usePlatformLogout, getPlatformMeQueryKey } from "@/api"

import { useCurrentAdmin } from "./use-current-admin"

type PlatformShellProps = {
  children: ReactNode
}

/**
 * The signed-in frame: app name, permission-gated nav (PA-R7, the server is
 * still the authority), the admin's name and sign out.
 */
export function PlatformShell({ children }: PlatformShellProps) {
  const { t } = useTranslation("platform-admin")
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { admin, hasPermission } = useCurrentAdmin()
  const logoutMutation = usePlatformLogout()
  const [signingOut, setSigningOut] = useState(false)

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await logoutMutation.mutateAsync()
    } finally {
      queryClient.removeQueries({ queryKey: getPlatformMeQueryKey() })
      await navigate({ to: "/sign-in" })
    }
  }

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex items-center gap-6 border-b border-border px-6 py-3">
        <Link
          to="/"
          className="flex items-center gap-2 text-sm font-semibold text-foreground"
        >
          <ShieldCheck className="size-4 text-primary" />
          {t("shell.appName")}
        </Link>

        <nav className="flex items-center gap-1">
          {hasPermission("read:platform-admin") && (
            <Link
              to="/admins"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              {t("shell.nav.admins")}
            </Link>
          )}
          {hasPermission("read:platform-role") && (
            <Link
              to="/roles"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              {t("shell.nav.roles")}
            </Link>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{admin?.name}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSignOut}
            disabled={signingOut}
          >
            {signingOut ? t("shell.signingOut") : t("shell.signOut")}
          </Button>
        </div>
      </header>

      <main className="flex-1 px-6 py-6">{children}</main>
    </div>
  )
}
