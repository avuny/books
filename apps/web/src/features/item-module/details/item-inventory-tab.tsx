"use client"

import * as React from "react"
import { useTranslation } from "react-i18next"
import { Boxes, Clock, PackageCheck, ShoppingCart, Truck } from "lucide-react"

import { Card, CardContent } from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import { useGetItemStock, useListStockBalances } from "@/api"
import { formatQuantity } from "../lib/format-quantity"
import {
  WarehouseLocationFilter,
  type WarehouseLocationFilterValue,
} from "../../warehouse-module"

export interface ItemInventoryTabProps {
  orgId: string
  itemId: string
  baseUnitSymbol: string
}

function PhysicalVirtualBadge({
  isVirtual,
  physicalLabel,
  virtualLabel,
}: {
  isVirtual: boolean
  physicalLabel: string
  virtualLabel: string
}) {
  return isVirtual ? (
    <span className="inline-flex items-center rounded-sm border border-purple-500/30 bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-medium text-purple-700 dark:text-purple-300">
      {virtualLabel}
    </span>
  ) : (
    <span className="inline-flex items-center rounded-sm border border-blue-500/30 bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300">
      {physicalLabel}
    </span>
  )
}

export function ItemInventoryTab({
  orgId,
  itemId,
  baseUnitSymbol,
}: ItemInventoryTabProps) {
  const { t, i18n } = useTranslation(["item", "warehouse"])

  const [filter, setFilter] = React.useState<WarehouseLocationFilterValue>({
    warehouseIds: [],
    locationIds: [],
  })

  const copy = React.useMemo(
    () => ({
      title: t("item:details.inventory.title", "Inventory items"),
      description: t(
        "item:details.inventory.description",
        "Stock levels across warehouses and storage locations."
      ),
      empty: t(
        "item:details.inventory.empty",
        "No inventory records found for the selected warehouse or location."
      ),
      available: t("item:details.inventory.available", "Available"),
      onHand: t("item:details.inventory.onHand", "On hand"),
      reserved: t("item:details.inventory.reserved", "Reserved"),
      onOrder: t("item:details.inventory.onOrder", "On order"),
      inTransit: t("item:details.inventory.inTransit", "In transit"),
      warehouse: t("item:details.inventory.warehouse", "Warehouse"),
      location: t("item:details.inventory.location", "Location"),
      physical: t("warehouse:labels.types.physical", "Physical"),
      virtual: t("warehouse:labels.types.virtual", "Virtual"),
      updatedAt: t("item:details.updatedAt", "Last updated"),
    }),
    [t]
  )

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso))

  // Fetch stock summary across all warehouses
  const { data: stockSummaryData, isLoading: isLoadingSummary } =
    useGetItemStock(orgId, itemId)

  const stockSummary = stockSummaryData?.data

  // Fetch inventory balances filtered by warehouse & location
  const { data: balancesData, isLoading: isLoadingBalances } =
    useListStockBalances(orgId, {
      itemId,
      warehouseId: filter.warehouseIds[0],
      locationId: filter.locationIds[0],
      pageSize: 50,
      includeSystem: "true",
      includeZero: "false",
    })

  const balances = balancesData?.data.items ?? []

  return (
    <div className="flex flex-col gap-6">
      {/* Top Filter and Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            {copy.title}
          </h2>
          <p className="text-xs text-muted-foreground">{copy.description}</p>
        </div>

        <WarehouseLocationFilter
          orgId={orgId}
          value={filter}
          onChange={setFilter}
        />
      </div>

      {/* KPI Cards: Available, On Hand, Reserved, On Order, In Transit */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {/* Available */}
        <Card className="border-border bg-card shadow-xs">
          <CardContent className="space-y-1 p-3.5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">{copy.available}</span>
              <PackageCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            {isLoadingSummary ? (
              <Skeleton className="h-6 w-16" />
            ) : (
              <p className="text-lg font-bold text-foreground tabular-nums">
                {formatQuantity(stockSummary?.available)}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  {baseUnitSymbol}
                </span>
              </p>
            )}
          </CardContent>
        </Card>

        {/* On Hand */}
        <Card className="border-border bg-card shadow-xs">
          <CardContent className="space-y-1 p-3.5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">{copy.onHand}</span>
              <Boxes className="size-4 text-blue-600 dark:text-blue-400" />
            </div>
            {isLoadingSummary ? (
              <Skeleton className="h-6 w-16" />
            ) : (
              <p className="text-lg font-bold text-foreground tabular-nums">
                {formatQuantity(stockSummary?.onHand)}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  {baseUnitSymbol}
                </span>
              </p>
            )}
          </CardContent>
        </Card>

        {/* Reserved */}
        <Card className="border-border bg-card shadow-xs">
          <CardContent className="space-y-1 p-3.5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">{copy.reserved}</span>
              <Clock className="size-4 text-amber-600 dark:text-amber-400" />
            </div>
            {isLoadingSummary ? (
              <Skeleton className="h-6 w-16" />
            ) : (
              <p className="text-lg font-bold text-foreground tabular-nums">
                {formatQuantity(stockSummary?.reserved)}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  {baseUnitSymbol}
                </span>
              </p>
            )}
          </CardContent>
        </Card>

        {/* On Order */}
        <Card className="border-border bg-card shadow-xs">
          <CardContent className="space-y-1 p-3.5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">{copy.onOrder}</span>
              <ShoppingCart className="size-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            {isLoadingSummary ? (
              <Skeleton className="h-6 w-16" />
            ) : (
              <p className="text-lg font-bold text-foreground tabular-nums">
                {formatQuantity(stockSummary?.onOrder)}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  {baseUnitSymbol}
                </span>
              </p>
            )}
          </CardContent>
        </Card>

        {/* In Transit */}
        <Card className="border-border bg-card shadow-xs">
          <CardContent className="space-y-1 p-3.5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">{copy.inTransit}</span>
              <Truck className="size-4 text-purple-600 dark:text-purple-400" />
            </div>
            {isLoadingSummary ? (
              <Skeleton className="h-6 w-16" />
            ) : (
              <p className="text-lg font-bold text-foreground tabular-nums">
                {formatQuantity(stockSummary?.inTransit)}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  {baseUnitSymbol}
                </span>
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Inventory Items Data Table */}
      <div className="rounded-md border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{copy.warehouse}</TableHead>
              <TableHead>{copy.location}</TableHead>
              <TableHead className="text-end">{copy.available}</TableHead>
              <TableHead className="text-end">{copy.onHand}</TableHead>
              <TableHead className="text-end">{copy.reserved}</TableHead>
              <TableHead className="text-end">{copy.onOrder}</TableHead>
              <TableHead className="text-end">{copy.updatedAt}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoadingBalances ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="ms-auto h-4 w-12" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="ms-auto h-4 w-12" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="ms-auto h-4 w-12" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="ms-auto h-4 w-12" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="ms-auto h-4 w-20" />
                  </TableCell>
                </TableRow>
              ))
            ) : balances.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="py-12 text-center text-sm text-muted-foreground"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Boxes className="size-8 text-muted-foreground/50" />
                    <p>{copy.empty}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              balances.map((b, idx) => {
                const isWhVirtual = b.warehouseType === "virtual"
                const isLocVirtual = b.locationType === "virtual_bin"

                return (
                  <TableRow
                    key={b.id ?? `${b.warehouseId}-${b.locationId}-${idx}`}
                  >
                    {/* Warehouse */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">
                          {b.warehouseName || b.warehouseCode || b.warehouseId}
                        </span>
                        <PhysicalVirtualBadge
                          isVirtual={isWhVirtual}
                          physicalLabel={copy.physical}
                          virtualLabel={copy.virtual}
                        />
                      </div>
                    </TableCell>

                    {/* Location */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-foreground">
                          {b.locationCode || b.locationName || b.locationId}
                        </span>
                        <PhysicalVirtualBadge
                          isVirtual={isLocVirtual}
                          physicalLabel={copy.physical}
                          virtualLabel={copy.virtual}
                        />
                      </div>
                    </TableCell>

                    {/* Available */}
                    <TableCell className="text-end font-mono font-semibold text-foreground tabular-nums">
                      {formatQuantity(b.availableQty ?? b.quantity)} {baseUnitSymbol}
                    </TableCell>

                    {/* On Hand */}
                    <TableCell className="text-end font-mono text-foreground tabular-nums">
                      {formatQuantity(b.onHandQty ?? b.quantity)} {baseUnitSymbol}
                    </TableCell>

                    {/* Reserved */}
                    <TableCell className="text-end font-mono text-muted-foreground tabular-nums">
                      {formatQuantity(b.reservedQty)} {baseUnitSymbol}
                    </TableCell>

                    {/* On Order */}
                    <TableCell className="text-end font-mono text-muted-foreground tabular-nums">
                      {formatQuantity(b.onOrderQty)} {baseUnitSymbol}
                    </TableCell>

                    {/* Updated At */}
                    <TableCell className="text-end text-xs text-muted-foreground">
                      {formatDate(b.updatedAt)}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
