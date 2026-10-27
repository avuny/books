import {
  Building2Icon,
  ChevronRightIcon,
  PlusIcon,
  GlobeIcon,
  ClockIcon,
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
} from "./organization-combobox"

export type OrganizationListCopy = {
  title: string
  description: string
  emptyTitle: string
  emptyDescription: string
  createButton: string
  combobox: OrganizationComboboxCopy
}

type OrganizationListViewProps = {
  organizations: OrganizationDto[]
  selectedOrgId?: string
  copy: OrganizationListCopy
  onSelectOrganization: (id: string) => void
  onClickCreateOrganization: () => void
}

export function OrganizationListView({
  organizations,
  selectedOrgId,
  copy,
  onSelectOrganization,
  onClickCreateOrganization,
}: OrganizationListViewProps) {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 p-6 md:p-8">
      {/* Header and Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {copy.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {copy.description}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <OrganizationCombobox
            organizations={organizations}
            selectedOrgId={selectedOrgId}
            copy={copy.combobox}
            onSelect={onSelectOrganization}
            onCreate={onClickCreateOrganization}
          />

          <Button onClick={onClickCreateOrganization} className="gap-2">
            <PlusIcon className="size-4" />
            <span>{copy.createButton}</span>
          </Button>
        </div>
      </div>

      {/* Grid of Organizations */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {organizations.map((org) => {
          const isSelected = org.id === selectedOrgId

          return (
            <Card
              key={org.id}
              className={`group relative cursor-pointer border transition-all hover:border-primary/50 hover:shadow-md ${
                isSelected
                  ? "border-primary ring-2 ring-primary/20"
                  : "border-border"
              }`}
              onClick={() => onSelectOrganization(org.id)}
            >
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Building2Icon className="size-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold transition-colors group-hover:text-primary">
                      {org.name}
                    </CardTitle>
                    <CardDescription className="font-mono text-xs text-muted-foreground">
                      {org.code}
                    </CardDescription>
                  </div>
                </div>

                <Badge
                  variant={org.status === "active" ? "secondary" : "outline"}
                  className="capitalize"
                >
                  {org.status}
                </Badge>
              </CardHeader>

              <CardContent className="pt-2">
                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <GlobeIcon className="size-3.5" />
                    <span>{org.defaultCurrency}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <ClockIcon className="size-3.5" />
                    <span>{org.timezone}</span>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3 text-xs font-medium text-primary">
                  <span>Open dashboard</span>
                  <ChevronRightIcon className="size-4 transition-transform group-hover:translate-x-1" />
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
