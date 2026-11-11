import { ArrowLeftIcon } from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import type { UnitDto, UnitType } from "../types"

export type UnitDetailsCopy = {
  back: string
  name: string
  symbol: string
  type: string
  status: string
  scope: string
  createdAt: string
  updatedAt: string
  systemNotice: string
  types: Record<UnitType, string>
  labels: {
    system: string
    custom: string
    active: string
    inactive: string
  }
  formatDate: (iso: string) => string
}

type UnitDetailsViewProps = {
  unit: UnitDto
  copy: UnitDetailsCopy
  onBack?: () => void
  actions?: React.ReactNode
}

export function UnitDetailsView({
  unit,
  copy,
  onBack,
  actions,
}: UnitDetailsViewProps) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {onBack && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="gap-2 rtl:rotate-180"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              <span>{copy.back}</span>
            </Button>
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {unit.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              <code className="rounded bg-muted px-1.5 py-0.5 font-semibold">
                {unit.symbol}
              </code>
            </p>
          </div>
        </div>

        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      {unit.isSystem && (
        <div className="rounded-md bg-muted/60 p-4 text-sm text-muted-foreground border">
          {copy.systemNotice}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{unit.name}</CardTitle>
          <CardDescription>
            {copy.types[unit.type] ?? unit.type}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                {copy.name}
              </dt>
              <dd className="mt-1 text-sm text-foreground">{unit.name}</dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                {copy.symbol}
              </dt>
              <dd className="mt-1 text-sm text-foreground">
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold">
                  {unit.symbol}
                </code>
              </dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                {copy.type}
              </dt>
              <dd className="mt-1 text-sm text-foreground">
                {copy.types[unit.type] ?? unit.type}
              </dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                {copy.scope}
              </dt>
              <dd className="mt-1">
                <Badge variant={unit.isSystem ? "secondary" : "outline"}>
                  {unit.isSystem ? copy.labels.system : copy.labels.custom}
                </Badge>
              </dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                {copy.status}
              </dt>
              <dd className="mt-1">
                <Badge variant={unit.isActive ? "default" : "destructive"}>
                  {unit.isActive ? copy.labels.active : copy.labels.inactive}
                </Badge>
              </dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                {copy.createdAt}
              </dt>
              <dd className="mt-1 text-sm text-foreground">
                {copy.formatDate(unit.createdAt)}
              </dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                {copy.updatedAt}
              </dt>
              <dd className="mt-1 text-sm text-foreground">
                {copy.formatDate(unit.updatedAt)}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}

