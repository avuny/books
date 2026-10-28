import { createFileRoute } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { UsersIcon } from "lucide-react"

export const Route = createFileRoute("/organization/$orgId/users")({
  component: OrgUsersPage,
})

function OrgUsersPage() {
  const { orgId } = Route.useParams()
  const { t } = useTranslation("organization")

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <UsersIcon className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            {t("dashboard.nav.users")}
          </h1>
          <p className="text-sm text-muted-foreground">{orgId}</p>
        </div>
      </div>
      <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
        Users management coming soon.
      </div>
    </div>
  )
}
