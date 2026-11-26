import {
  Building2Icon,
  GlobeIcon,
  ClockIcon,
  ShieldCheckIcon,
  ArrowLeftIcon,
  MapPinIcon,
  HashIcon,
} from "lucide-react"
import type { OrganizationDto } from "@avuny/contracts/organization"

import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  OrganizationCombobox,
  type OrganizationComboboxCopy,
} from "../list/organization-combobox"

export type OrganizationDetailsCopy = {
  title: string
  description: string
  id: string
  code: string
  name: string
  status: string
  currency: string
  timezone: string
  country: string
  state: string
  allOrganizations: string
  switchOrganization: string
  none: string
  combobox: OrganizationComboboxCopy
}

type OrganizationDetailsViewProps = {
  organization: OrganizationDto
  allOrganizations: OrganizationDto[]
  copy: OrganizationDetailsCopy
  onSelectOrganization: (id: string) => void
  onNavigateToAll: () => void
  onNavigateToCreate: () => void
}

export function OrganizationDetailsView({
  organization,
  allOrganizations,
  copy,
  onSelectOrganization,
  onNavigateToAll,
  onNavigateToCreate,
}: OrganizationDetailsViewProps) {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 p-6 md:p-8">
      {/* Top action bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={onNavigateToAll}
          className="w-fit gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" />
          <span>{copy.allOrganizations}</span>
        </Button>

        <div className="flex items-center gap-3">
          <OrganizationCombobox
            organizations={allOrganizations}
            selectedOrgId={organization.id}
            copy={copy.combobox}
            onSelect={onSelectOrganization}
            onCreate={onNavigateToCreate}
          />
        </div>
      </div>

      {/* Main header banner */}
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex size-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Building2Icon className="size-7" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {organization.name}
              </h1>
              <Badge
                variant={
                  organization.status === "active" ? "secondary" : "outline"
                }
                className="text-xs capitalize"
              >
                {organization.status}
              </Badge>
            </div>
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">
              /{organization.code}
            </p>
          </div>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              {copy.title}
            </CardTitle>
            <CardDescription className="text-xs">
              {copy.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <HashIcon className="size-4" />
                <span>{copy.id}</span>
              </div>
              <span className="font-mono text-xs text-foreground select-all">
                {organization.id}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-border/60 pb-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building2Icon className="size-4" />
                <span>{copy.code}</span>
              </div>
              <span className="font-mono text-xs text-foreground">
                {organization.code}
              </span>
            </div>

            <div className="flex items-center justify-between pb-1 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <ShieldCheckIcon className="size-4" />
                <span>{copy.status}</span>
              </div>
              <span className="font-medium text-foreground capitalize">
                {organization.status}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Regional Settings
            </CardTitle>
            <CardDescription className="text-xs">
              Currency, timezone and geographic localization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between border-b border-border/60 pb-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <GlobeIcon className="size-4" />
                <span>{copy.currency}</span>
              </div>
              <span className="font-semibold text-foreground">
                {organization.defaultCurrency}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-border/60 pb-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <ClockIcon className="size-4" />
                <span>{copy.timezone}</span>
              </div>
              <span className="font-medium text-foreground">
                {organization.timezone}
              </span>
            </div>

            <div className="flex items-center justify-between pb-1 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPinIcon className="size-4" />
                <span>{copy.country}</span>
              </div>
              <span className="text-foreground">
                {organization.countryCode || copy.none}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
