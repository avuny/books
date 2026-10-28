import type { ComponentType } from "react"
import { useMemo } from "react"
import { Link, useLocation } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import {
  BadgeDollarSignIcon,
  BoxesIcon,
  Building2Icon,
  ChartColumnIcon,
  CircleIcon,
  ClipboardListIcon,
  ContactIcon,
  FileTextIcon,
  LayersIcon,
  PackageIcon,
  ReceiptIcon,
  RulerIcon,
  ShieldCheckIcon,
  ShieldIcon,
  ShoppingBagIcon,
  ShoppingCartIcon,
  TruckIcon,
  UserIcon,
  UsersIcon,
  UsersRoundIcon,
  WarehouseIcon,
} from "lucide-react"

import { AppSidebar } from "@workspace/ui/blocks/app-sidebar"
import type {
  Direction,
  NavLinkComponent,
  NavSection,
} from "@workspace/ui/blocks/app-sidebar/types"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { getGetMySidebarQueryKey, useGetMySidebar } from "@/api"

const RouterNavLink: NavLinkComponent = ({ href, children, ...rest }) => (
  <Link to={href} {...rest}>
    {children}
  </Link>
)

const ICON_MAP: Record<string, ComponentType<{ className?: string }>> = {
  user: UserIcon,
  users: UsersIcon,
  "users-round": UsersRoundIcon,
  role: ShieldCheckIcon,
  shield: ShieldIcon,
  "shield-check": ShieldCheckIcon,
  organization: Building2Icon,
  "building-2": Building2Icon,
  supplier: TruckIcon,
  truck: TruckIcon,
  purchaseOrder: ClipboardListIcon,
  "clipboard-list": ClipboardListIcon,
  customer: ContactIcon,
  contact: ContactIcon,
  salesOrder: ShoppingBagIcon,
  "shopping-bag": ShoppingBagIcon,
  "shopping-cart": ShoppingCartIcon,
  invoice: FileTextIcon,
  "file-text": FileTextIcon,
  receipt: ReceiptIcon,
  report: ChartColumnIcon,
  "chart-column": ChartColumnIcon,
  item: PackageIcon,
  package: PackageIcon,
  unit: RulerIcon,
  ruler: RulerIcon,
  unitCollection: LayersIcon,
  layers: LayersIcon,
  warehouse: WarehouseIcon,
  "badge-dollar-sign": BadgeDollarSignIcon,
  boxes: BoxesIcon,
}

function renderSidebarIcon(iconKey?: string | null) {
  if (!iconKey) return <CircleIcon className="size-4" />
  const Icon = ICON_MAP[iconKey] ?? CircleIcon
  return <Icon className="size-4" />
}

function resolveOptionHref(orgId: string, path: string): string {
  if (!path || path === "/") {
    return `/organization/${orgId}`
  }
  const cleanPath = path.startsWith("/") ? path : `/${path}`
  return `/organization/${orgId}${cleanPath}`
}

export function OrgDashboardSidebar({ orgId }: { orgId: string }) {
  const { t, i18n } = useTranslation("organization")
  const location = useLocation()
  const dir = (i18n.dir?.() ?? "ltr") as Direction
  const currentLang = i18n.language ?? "en"

  const { data: sidebarResponse, isLoading } = useGetMySidebar(orgId, {
    query: {
      queryKey: [...getGetMySidebarQueryKey(orgId), currentLang],
    },
  })

  const sections: readonly NavSection[] = useMemo(() => {
    if (isLoading) {
      return [
        {
          id: "org-dashboard-loading-section",
          label: t("dashboard.sections.main"),
          items: [
            {
              id: "loading-item-1",
              label: "...",
              icon: <Skeleton className="size-4 rounded" />,
              disabled: true,
            },
            {
              id: "loading-item-2",
              label: "...",
              icon: <Skeleton className="size-4 rounded" />,
              disabled: true,
            },
          ],
        },
      ]
    }

    const headings = sidebarResponse?.data ?? []
    return headings.map((heading) => ({
      id: `sidebar-heading-${heading.id}`,
      label: heading.label,
      items: heading.options.map((option) => {
        const href = resolveOptionHref(orgId, option.path)
        return {
          id: `sidebar-option-${option.id}`,
          label: option.label,
          icon: renderSidebarIcon(option.icon),
          href,
          exact: href === `/organization/${orgId}`,
        }
      }),
    }))
  }, [isLoading, sidebarResponse?.data, orgId, t])

  const header = (
    <div className="flex items-center gap-2 overflow-hidden px-3 py-2 text-sm font-semibold text-foreground group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
      <Building2Icon
        className="size-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
      <span className="truncate group-data-[collapsible=icon]:hidden">
        {t("dashboard.header")}
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
      navLabel={t("dashboard.sidebarLabel")}
    />
  )
}
