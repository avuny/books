import type { ReactNode } from "react"
import { ArrowLeft } from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"

import { ItemStatusBadge, ItemTrackingBadges } from "../components"
import { trimDecimal } from "../../unit-collection-module/lib"
import type { ItemDto } from "../types"
import { ItemInventoryTab } from "./item-inventory-tab"
import { ItemStockMovementsTab } from "./item-stock-movements-tab"

export type ItemDetailsViewCopy = {
  backLabel: string
  tabOverview: string
  tabInventory: string
  tabMovements: string
  activeLabel: string
  inactiveLabel: string
  trackedLabel: string
  untrackedLabel: string
  batchLabel: string
  expiryLabel: string
  categoryLabel: string
  baseUnitLabel: string
  valuationLabel: string
  reorderPointLabel: string
  negativeStockLabel: string
  settingsTitle: string
  flagsTitle: string
  /** Prices section. */
  pricesTitle: string
  pricesUnitHeader: string
  pricesCostHeader: string
  pricesSellingHeader: string
  assemblableLabel: string
  returnableLabel: string
  createdLabel: string
  updatedLabel: string
  /** Shown when no reorder point is set. */
  noneLabel: string
  /** "Allowed" / "Not allowed" */
  allowedLabel: string
  notAllowedLabel: string
}

export interface ItemDetailsViewProps {
  orgId: string
  item: ItemDto | null
  isLoading: boolean
  /** Already localized. Shown instead of the item when loading failed. */
  errorMessage?: string | null
  copy: ItemDetailsViewCopy
  /** Already localized: "Kilogram (kg)". */
  baseUnitText: string
  /** Already localized: "First in, first out (FIFO)". */
  valuationText: string
  /** Already formatted for the current locale. */
  createdAt: string
  updatedAt: string
  onBack?: () => void
  /** Usually <ItemButton />; omit when the user can't edit. */
  editAction?: ReactNode
}

export function ItemDetailsView({
  orgId,
  item,
  isLoading,
  errorMessage,
  copy,
  baseUnitText,
  valuationText,
  createdAt,
  updatedAt,
  onBack,
  editAction,
}: ItemDetailsViewProps) {
  const unitText = (u: { name: string; symbol: string | null }) =>
    u.symbol ? `${u.name} (${u.symbol})` : u.name
  const priceRows = item
    ? [
        {
          id: item.baseUnit.id,
          unit: baseUnitText,
          costPrice: item.costPrice,
          sellingPrice: item.sellingPrice,
        },
        ...item.unitPrices.map((p) => ({
          id: p.unit.id,
          unit: unitText(p.unit),
          costPrice: p.costPrice,
          sellingPrice: p.sellingPrice,
        })),
      ]
    : []
  const hasPrices = priceRows.some((r) => r.costPrice || r.sellingPrice)

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
          <Skeleton className="h-32 w-full" />
        </div>
      ) : !item ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold text-foreground">
                  {item.name}
                </h1>
                <ItemStatusBadge
                  isActive={item.isActive}
                  activeLabel={copy.activeLabel}
                  inactiveLabel={copy.inactiveLabel}
                />
              </div>
              {item.description ? (
                <p className="text-sm text-muted-foreground">
                  {item.description}
                </p>
              ) : null}
            </div>
            {editAction}
          </div>

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="overview">{copy.tabOverview}</TabsTrigger>
              <TabsTrigger value="inventory">{copy.tabInventory}</TabsTrigger>
              <TabsTrigger value="movements">{copy.tabMovements}</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-muted-foreground">
                    {copy.categoryLabel}
                  </dt>
                  <dd className="text-foreground">{item.categoryName}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">
                    {copy.baseUnitLabel}
                  </dt>
                  <dd className="text-foreground">{baseUnitText}</dd>
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
                  {copy.settingsTitle}
                </h2>
                <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      {copy.valuationLabel}
                    </dt>
                    <dd className="text-foreground">{valuationText}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      {copy.reorderPointLabel}
                    </dt>
                    <dd className="text-foreground tabular-nums">
                      {item.reorderPoint ?? copy.noneLabel}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      {copy.negativeStockLabel}
                    </dt>
                    <dd className="text-foreground">
                      {item.allowNegativeStock
                        ? copy.allowedLabel
                        : copy.notAllowedLabel}
                    </dd>
                  </div>
                </dl>
              </section>

              {hasPrices ? (
                <section className="grid gap-3">
                  <h2 className="text-sm font-medium text-foreground">
                    {copy.pricesTitle}
                  </h2>
                  <div className="overflow-x-auto rounded-md border border-border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-start text-xs text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-start font-medium">
                            {copy.pricesUnitHeader}
                          </th>
                          <th className="px-3 py-2 text-start font-medium">
                            {copy.pricesCostHeader}
                          </th>
                          <th className="px-3 py-2 text-start font-medium">
                            {copy.pricesSellingHeader}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {priceRows.map((row) => (
                          <tr key={row.id} className="border-t border-border">
                            <td className="px-3 py-2 text-foreground">
                              {row.unit}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground tabular-nums">
                              {row.costPrice
                                ? trimDecimal(row.costPrice)
                                : copy.noneLabel}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground tabular-nums">
                              {row.sellingPrice
                                ? trimDecimal(row.sellingPrice)
                                : copy.noneLabel}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}

              <section className="grid gap-2">
                <h2 className="text-sm font-medium text-foreground">
                  {copy.flagsTitle}
                </h2>
                <div className="flex flex-wrap gap-2">
                  <ItemTrackingBadges
                    isInventoryTracked={item.isInventoryTracked}
                    isBatchTracked={item.isBatchTracked}
                    isExpiryTracked={item.isExpiryTracked}
                    trackedLabel={copy.trackedLabel}
                    untrackedLabel={copy.untrackedLabel}
                    batchLabel={copy.batchLabel}
                    expiryLabel={copy.expiryLabel}
                  />
                  {item.canAssembled ? (
                    <Badge variant="outline">{copy.assemblableLabel}</Badge>
                  ) : null}
                  {item.isReturnable ? (
                    <Badge variant="outline">{copy.returnableLabel}</Badge>
                  ) : null}
                </div>
              </section>
            </TabsContent>

            <TabsContent value="inventory" className="pt-2">
              <ItemInventoryTab
                orgId={orgId}
                itemId={item.id}
                baseUnitSymbol={item.baseUnit.symbol}
              />
            </TabsContent>

            <TabsContent value="movements" className="pt-2">
              <ItemStockMovementsTab
                orgId={orgId}
                itemId={item.id}
                baseUnitSymbol={item.baseUnit.symbol}
              />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}
