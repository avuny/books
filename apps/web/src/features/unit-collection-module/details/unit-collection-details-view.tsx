import type { ReactNode } from "react"
import { ArrowLeft } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { BaseUnitBadge } from "../components"
import type { UnitCollectionDto } from "../types"

export type UnitCollectionDetailsViewCopy = {
  backLabel: string
  baseLabel: string
  itemsLabel: string
  createdLabel: string
  updatedLabel: string
  unitsTitle: string
  unitHeader: string
  symbolHeader: string
  typeHeader: string
  factorHeader: string
  /** Explains why a collection that items use cannot be deleted. */
  inUseHint: string
}

export interface UnitCollectionDetailsViewProps {
  collection: UnitCollectionDto | null
  isLoading: boolean
  /** Already localized. Shown instead of the collection when loading failed. */
  errorMessage?: string | null
  copy: UnitCollectionDetailsViewCopy
  /** Already localized: "Length", "Weight", ... */
  getTypeLabel: (type: string) => string
  /** Already localized: "1 cm = 0.01 m". Empty for the base unit. */
  getConversionLabel: (unit: UnitCollectionDto["units"][number]) => string
  /** Already formatted for the current locale. */
  createdAt: string
  updatedAt: string
  onBack?: () => void
  /** Usually <UnitCollectionButton />; omit when the user can't edit. */
  editAction?: ReactNode
}

export function UnitCollectionDetailsView({
  collection,
  isLoading,
  errorMessage,
  copy,
  getTypeLabel,
  getConversionLabel,
  createdAt,
  updatedAt,
  onBack,
  editAction,
}: UnitCollectionDetailsViewProps) {
  return (
    <div className="flex flex-col gap-6">
      {onBack ? (
        <div>
          <Button type="button" variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
            {copy.backLabel}
          </Button>
        </div>
      ) : null}

      {isLoading ? (
        <div className="grid gap-4" aria-busy>
          <Skeleton className="h-7 w-1/3" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : !collection ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="min-w-0 text-xl font-semibold text-foreground">
              {collection.name}
            </h1>
            {editAction}
          </div>

          {collection.itemCount > 0 ? (
            <p className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              {copy.inUseHint}
            </p>
          ) : null}

          <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">
                {copy.itemsLabel}
              </dt>
              <dd className="text-foreground tabular-nums">
                {collection.itemCount}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                {copy.createdLabel}
              </dt>
              <dd className="text-foreground">{createdAt}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                {copy.updatedLabel}
              </dt>
              <dd className="text-foreground">{updatedAt}</dd>
            </div>
          </dl>

          <section className="grid gap-3">
            <h2 className="text-sm font-medium text-foreground">
              {copy.unitsTitle}
            </h2>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-start text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-start font-medium">
                      {copy.unitHeader}
                    </th>
                    <th className="px-3 py-2 text-start font-medium">
                      {copy.symbolHeader}
                    </th>
                    <th className="px-3 py-2 text-start font-medium">
                      {copy.typeHeader}
                    </th>
                    <th className="px-3 py-2 text-start font-medium">
                      {copy.factorHeader}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {collection.units.map((unit) => (
                    <tr key={unit.id} className="border-t border-border">
                      <td className="px-3 py-2 text-foreground">
                        <span className="me-2">{unit.name}</span>
                        {unit.isBase ? (
                          <BaseUnitBadge label={copy.baseLabel} />
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {unit.symbol}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {getTypeLabel(unit.type)}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground tabular-nums">
                        {getConversionLabel(unit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
