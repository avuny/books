import { Badge } from "@workspace/ui/components/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

import type { UnitDto } from "../types"
import type { UnitColumnsCopy } from "./unit-columns"

type UnitMobileCardProps = {
  unit: UnitDto
  copy: UnitColumnsCopy
  onSelect?: () => void
}

export function UnitMobileCard({ unit, copy, onSelect }: UnitMobileCardProps) {
  return (
    <Card
      onClick={onSelect}
      className={onSelect ? "cursor-pointer transition-colors hover:bg-muted/50" : undefined}
    >
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-base font-semibold">{unit.name}</CardTitle>
          <CardDescription>
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-semibold">
              {unit.symbol}
            </code>
          </CardDescription>
        </div>
        <div className="flex gap-1.5">
          <Badge variant={unit.isSystem ? "secondary" : "outline"}>
            {unit.isSystem ? copy.labels.system : copy.labels.custom}
          </Badge>
          <Badge variant={unit.isActive ? "default" : "destructive"}>
            {unit.isActive ? copy.labels.active : copy.labels.inactive}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">
        <div>
          {copy.type}: {copy.types[unit.type]}
        </div>
        <div>
          {copy.updated}: {copy.formatDate(unit.updatedAt)}
        </div>
      </CardContent>
    </Card>
  )
}

