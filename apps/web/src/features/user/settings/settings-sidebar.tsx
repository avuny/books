import { Link, useLocation } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { SettingsIcon, UserIcon } from "lucide-react"

import { AppSidebar } from "@workspace/ui/blocks/app-sidebar"
import type {
  Direction,
  NavLinkComponent,
  NavSection,
} from "@workspace/ui/blocks/app-sidebar/types"
import { ROUTES } from "@/features/routes"

const RouterNavLink: NavLinkComponent = ({ href, children, ...rest }) => (
  <Link to={href} {...rest}>
    {children}
  </Link>
)

export function SettingsSidebar() {
  const { t, i18n } = useTranslation("user")
  const location = useLocation()
  const dir = (i18n.dir?.() ?? "ltr") as Direction

  const sections: readonly NavSection[] = [
    {
      id: "settings-section",
      label: t("settings.sections.settings"),
      items: [
        {
          id: "personal-information",
          label: t("settings.nav.personalInfo"),
          icon: <UserIcon className="size-4" />,
          href: ROUTES.user.settings,
        },
      ],
    },
  ]

  const header = (
    <div className="flex items-center gap-2 overflow-hidden px-3 py-2 text-sm font-semibold text-foreground group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
      <SettingsIcon
        className="size-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <span className="truncate group-data-[collapsible=icon]:hidden">
        {t("settings.header")}
      </span>
    </div>
  )

  return (
    <AppSidebar
      sections={sections}
      header={header}
      currentPath={location.pathname}
      linkComponent={RouterNavLink}
      dir={dir}
      navLabel={t("settings.sidebarLabel")}
    />
  )
}
