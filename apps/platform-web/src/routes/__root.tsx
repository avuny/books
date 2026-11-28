import { Outlet, createRootRoute } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"

function NotFound() {
  const { t } = useTranslation("common")
  return <p className="p-6">{t("notFound")}</p>
}

export const Route = createRootRoute({
  component: () => <Outlet />,
  notFoundComponent: NotFound,
})
