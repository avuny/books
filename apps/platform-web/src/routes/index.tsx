import { createFileRoute } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

export const Route = createFileRoute("/")({
  component: Index,
})

function Index() {
  const { t } = useTranslation("common")

  return (
    <main className="flex min-h-svh flex-col gap-2 p-6">
      <h1 className="text-lg font-medium">{t("home.title")}</h1>
      <p className="max-w-prose text-sm text-muted-foreground">{t("home.scaffold")}</p>
    </main>
  )
}
