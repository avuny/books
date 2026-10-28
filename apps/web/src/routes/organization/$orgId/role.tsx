import { createFileRoute } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { ShieldIcon } from "lucide-react"

export const Route = createFileRoute("/organization/$orgId/role")({
  component: RolePage,
})

function RolePage() {
  const { t } = useTranslation("organization")

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <ShieldIcon className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            {t("dashboard.nav.roles")}
          </h1>
        </div>
      </div>
      <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
        Role management coming soon.
      </div>
    </div>
  )
}
