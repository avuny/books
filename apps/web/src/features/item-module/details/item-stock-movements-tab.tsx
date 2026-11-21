"use client"

import * as React from "react"
import { useTranslation } from "react-i18next"
import { ChevronLeft, ChevronRight, History } from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"

import { useListStockMovements } from "@/api"
import {
  WarehouseLocationFilter,
  type WarehouseLocationFilterValue,
} from "../../warehouse-module"

export interface ItemStockMovementsTabProps {
  orgId: string
  itemId: string
  baseUnitSymbol: string
}

const TYPE_COLORS: Record<string, string> = {
  opening:
    "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  purchase:
    "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  purchase_return:
    "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800",
  sale: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
  sale_return:
    "bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800",
  transfer:
    "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  adjustment:
    "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800",
  assembly_consume:
    "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800",
  assembly_produce:
    "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800",
}

export function ItemStockMovementsTab({
  orgId,
  itemId,
  baseUnitSymbol,
}: ItemStockMovementsTabProps) {
  const { t, i18n } = useTranslation("item")

  const [filter, setFilter] = React.useState<WarehouseLocationFilterValue>({
    warehouseIds: [],
    locationIds: [],
  })
  const [page, setPage] = React.useState(1)
  const pageSize = 20

  const copy = React.useMemo(
    () => ({
      title: t("details.movements.title", "Stock movements"),
      description: t(
        "details.movements.description",
        "Stock history, receipts, transfers, adjustments, and issues."
      ),
      empty: t(
        "details.movements.empty",
        "No stock movements recorded for this item."
      ),
      date: t("details.movements.date", "Date"),
      type: t("details.movements.type", "Type"),
      reference: t("details.movements.reference", "Reference"),
      from: t("details.movements.from", "From"),
      to: t("details.movements.to", "To"),
      quantity: t("details.movements.quantity", "Quantity"),
      reversal: t("details.movements.reversal", "Reversal"),
      note: t("details.movements.note", "Note"),
      previous: t("pagination.previous", "Previous"),
      next: t("pagination.next", "Next"),
      summary: (from: number, to: number, total: number) =>
        t("pagination.summary", {
          from,
          to,
          total,
          defaultValue: `${from}–${to} of ${total}`,
        }),
    }),
    [t]
  )

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso))

  // Fetch stock movements
  const { data: movementsData, isLoading } = useListStockMovements(orgId, {
    itemId,
    warehouseId: filter.warehouseIds[0],
    locationId: filter.locationIds[0],
    page,
    pageSize,
  })

  const movements = movementsData?.data.items ?? []
  const total = movementsData?.data.total ?? 0
  const totalPages = Math.ceil(total / pageSize)

  const fromCount = total === 0 ? 0 : (page - 1) * pageSize + 1
  const toCount = Math.min(page * pageSize, total)

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
          onChange={(next) => {
            setFilter(next)
            setPage(1)
          }}
        />
      </div>

      {/* Movements Data Table */}
      <div className="rounded-md border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{copy.date}</TableHead>
              <TableHead>{copy.type}</TableHead>
              <TableHead>{copy.reference}</TableHead>
              <TableHead>{copy.from}</TableHead>
              <TableHead>{copy.to}</TableHead>
              <TableHead className="text-end">{copy.quantity}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="ms-auto h-4 w-16" />
                  </TableCell>
                </TableRow>
              ))
            ) : movements.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-12 text-center text-sm text-muted-foreground"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <History className="size-8 text-muted-foreground/50" />
                    <p>{copy.empty}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              movements.map((m) => {
                const badgeColor =
                  TYPE_COLORS[m.type] ??
                  "bg-muted text-muted-foreground border-border"

                const fromDisplay =
                  m.fromWarehouseName && m.fromLocationCode
                    ? `${m.fromWarehouseName} · ${m.fromLocationCode}`
                    : m.fromLocationCode ||
                      m.fromLocationName ||
                      m.fromLocationId

                const toDisplay =
                  m.toWarehouseName && m.toLocationCode
                    ? `${m.toWarehouseName} · ${m.toLocationCode}`
                    : m.toLocationCode || m.toLocationName || m.toLocationId

                return (
                  <TableRow key={m.lineId}>
                    {/* Date */}
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(m.postedAt)}
                    </TableCell>

                    {/* Type + Reversal Badge */}
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-medium capitalize ${badgeColor}`}
                        >
                          {m.type.replace(/_/g, " ")}
                        </span>
                        {m.isReversal ? (
                          <Badge variant="destructive" className="text-[10px]">
                            {copy.reversal}
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>

                    {/* Reference / Source */}
                    <TableCell className="text-xs">
                      {m.sourceRef ? (
                        <span className="font-mono font-medium text-foreground">
                          {m.sourceRef}
                        </span>
                      ) : m.sourceType ? (
                        <span className="text-muted-foreground capitalize">
                          {m.sourceType}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    {/* From */}
                    <TableCell className="text-xs text-muted-foreground">
                      {fromDisplay}
                    </TableCell>

                    {/* To */}
                    <TableCell className="text-xs text-muted-foreground">
                      {toDisplay}
                    </TableCell>

                    {/* Quantity */}
                    <TableCell className="text-end font-mono font-semibold text-foreground tabular-nums">
                      {m.quantity} {baseUnitSymbol}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{copy.summary(fromCount, toCount, total)}</span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="gap-1"
            >
              <ChevronLeft className="size-4 rtl:rotate-180" />
              <span>{copy.previous}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage((p) => p + 1)}
              className="gap-1"
            >
              <span>{copy.next}</span>
              <ChevronRight className="size-4 rtl:rotate-180" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
