import {
  ArrowLeft,
  Boxes,
  Building2,
  Calendar,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Hash,
  Layers,
  MapPin,
  Pencil,
  Scale,
  Tag,
  Trash2,
  TrendingDown,
  TrendingUp,
  User,
  XCircle,
} from "lucide-react"

import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"

import { InventoryAdjustmentStatusBadge } from "../components"
import type {
  InventoryAdjustmentDto,
  InventoryAdjustmentStatus,
} from "../types"

export type InventoryAdjustmentDetailsViewCopy = {
  backLabel: string
  title: string
  date: string
  referenceNumber: string
  warehouse: string
  reason: string
  description: string
  status: string
  linesTitle: string
  stockMovement: string
  journalEntry: string
  confirmedBy: string
  confirmedAt: string
  createdBy: string
  createdAt: string
  overview: string
  documentInfo: string
  auditInfo: string
  totalLines: string
  increases: string
  decreases: string
  noChange: string
  netDifference: string
  pendingPosting: string
  noItems: string
  fields: {
    item: string
    location: string
    unit: string
    batch: string
    countedQuantity: string
    systemQuantity: string
    difference: string
    notes: string
  }
  actions: {
    edit: string
    confirm: string
    cancel: string
    delete: string
  }
  getStatusLabel: (status: InventoryAdjustmentStatus | string) => string
}

export interface InventoryAdjustmentDetailsViewProps {
  adjustment: InventoryAdjustmentDto | null
  isLoading: boolean
  errorMessage?: string | null
  copy: InventoryAdjustmentDetailsViewCopy
  canUpdate?: boolean
  canConfirm?: boolean
  canCancel?: boolean
  canDelete?: boolean
  onBack?: () => void
  onEdit?: () => void
  onConfirm?: () => void
  onCancel?: () => void
  onDelete?: () => void
}

export function InventoryAdjustmentDetailsView({
  adjustment,
  isLoading,
  errorMessage,
  copy,
  canUpdate,
  canConfirm,
  canCancel,
  canDelete,
  onBack,
  onEdit,
  onConfirm,
  onCancel,
  onDelete,
}: InventoryAdjustmentDetailsViewProps) {
  if (isLoading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-md" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  if (errorMessage || !adjustment) {
    return (
      <div className="space-y-4">
        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="me-2 size-4 rtl:rotate-180" />
            {copy.backLabel}
          </Button>
        )}
        <div
          role="alert"
          className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive"
        >
          {errorMessage || "Adjustment not found."}
        </div>
      </div>
    )
  }

  const isDraft = adjustment.status === "DRAFT"
  const isConfirmed = adjustment.status === "CONFIRMED"
  const lines = adjustment.lines ?? []

  let increasesCount = 0
  let decreasesCount = 0
  let netDelta = 0

  for (const line of lines) {
    const delta = Number(line.quantityDeltaBase || 0)
    if (delta > 0) increasesCount++
    else if (delta < 0) decreasesCount++
    netDelta += delta
  }

  const formatDelta = (val: number | string) => {
    const num = Number(val)
    if (Number.isNaN(num)) return "0"
    return num > 0 ? `+${num}` : `${num}`
  }

  return (
    <div className="space-y-6">
      {/* Top Header & Actions Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          {onBack && (
            <Button
              variant="outline"
              size="icon"
              className="mt-0.5 size-9 shrink-0"
              onClick={onBack}
              aria-label={copy.backLabel}
            >
              <ArrowLeft className="size-4 rtl:rotate-180" />
            </Button>
          )}
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-2xl font-bold tracking-tight text-foreground">
                {adjustment.number}
              </h1>
              <InventoryAdjustmentStatusBadge
                status={adjustment.status}
                label={copy.getStatusLabel(adjustment.status)}
              />
              {adjustment.referenceNumber && (
                <Badge
                  variant="outline"
                  className="font-mono text-xs text-muted-foreground"
                >
                  <Hash className="me-1 size-3 text-muted-foreground" />
                  {adjustment.referenceNumber}
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="size-3.5" />
                <span>
                  {copy.date}: {adjustment.date}
                </span>
              </span>
              {adjustment.warehouseName && (
                <span className="flex items-center gap-1">
                  <Building2 className="size-3.5" />
                  <span>{adjustment.warehouseName}</span>
                </span>
              )}
              {adjustment.reasonName && (
                <span className="flex items-center gap-1">
                  <Tag className="size-3.5" />
                  <span>{adjustment.reasonName}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Toolbar */}
        {isDraft && (
          <div className="flex flex-wrap items-center gap-2">
            {canUpdate && onEdit && (
              <Button variant="outline" size="sm" onClick={onEdit}>
                <Pencil className="me-1.5 size-4" />
                {copy.actions.edit}
              </Button>
            )}
            {canConfirm && onConfirm && (
              <Button variant="default" size="sm" onClick={onConfirm}>
                <CheckCircle2 className="me-1.5 size-4" />
                {copy.actions.confirm}
              </Button>
            )}
            {canCancel && onCancel && (
              <Button variant="outline" size="sm" onClick={onCancel}>
                <XCircle className="me-1.5 size-4" />
                {copy.actions.cancel}
              </Button>
            )}
            {canDelete && onDelete && (
              <Button variant="destructive" size="sm" onClick={onDelete}>
                <Trash2 className="me-1.5 size-4" />
                {copy.actions.delete}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Metric / KPI Bar */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="p-4 shadow-none">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <Layers className="size-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                {copy.totalLines}
              </p>
              <p className="font-mono text-xl font-bold tracking-tight text-foreground">
                {lines.length}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4 shadow-none">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="size-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                {copy.increases}
              </p>
              <p className="font-mono text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                {increasesCount}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4 shadow-none">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-destructive/10 p-2 text-destructive">
              <TrendingDown className="size-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                {copy.decreases}
              </p>
              <p className="font-mono text-xl font-bold tracking-tight text-destructive">
                {decreasesCount}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4 shadow-none">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-muted p-2 text-muted-foreground">
              <Scale className="size-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                {copy.netDifference}
              </p>
              <p
                className={`font-mono text-xl font-bold tracking-tight ${
                  netDelta > 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : netDelta < 0
                      ? "text-destructive"
                      : "text-foreground"
                }`}
              >
                {formatDelta(netDelta)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Details Grid: Document Details & Postings/Audit */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Document Details Card */}
        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-muted-foreground" />
              <CardTitle className="text-base font-semibold">
                {copy.documentInfo}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3.5 text-sm">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <span className="text-muted-foreground">{copy.warehouse}</span>
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-foreground">
                  {adjustment.warehouseName || adjustment.warehouseId}
                </span>
                {adjustment.warehouseCode && (
                  <Badge variant="outline" className="font-mono text-xs">
                    {adjustment.warehouseCode}
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <span className="text-muted-foreground">{copy.reason}</span>
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-foreground">
                  {adjustment.reasonName || adjustment.reasonId}
                </span>
                {adjustment.reasonCode && (
                  <Badge variant="outline" className="font-mono text-xs">
                    {adjustment.reasonCode}
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <span className="text-muted-foreground">{copy.date}</span>
              <span className="font-medium tabular-nums text-foreground">
                {adjustment.date}
              </span>
            </div>

            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <span className="text-muted-foreground">{copy.referenceNumber}</span>
              <span className="font-medium text-foreground">
                {adjustment.referenceNumber || "—"}
              </span>
            </div>

            {adjustment.description && (
              <div className="pt-1">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">
                  {copy.description}
                </span>
                <p className="rounded-md bg-muted/40 p-2.5 text-xs text-foreground leading-relaxed">
                  {adjustment.description}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Audit & Linked Postings Card */}
        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Boxes className="size-4 text-muted-foreground" />
              <CardTitle className="text-base font-semibold">
                {copy.auditInfo}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3.5 text-sm">
            {/* Stock Movement Link */}
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Boxes className="size-4 text-muted-foreground" />
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">
                      {copy.stockMovement}
                    </span>
                    <p className="font-mono text-xs font-semibold text-foreground">
                      {adjustment.stockMovementId || copy.pendingPosting}
                    </p>
                  </div>
                </div>
                {adjustment.stockMovementId && (
                  <Badge
                    variant="secondary"
                    className="border-0 bg-emerald-500/10 text-xs text-emerald-600 dark:text-emerald-400"
                  >
                    <CheckCircle2 className="me-1 size-3" />
                    Posted
                  </Badge>
                )}
              </div>
            </div>

            {/* Journal Entry Link */}
            <div className="rounded-lg border border-border bg-muted/20 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <FileSpreadsheet className="size-4 text-muted-foreground" />
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">
                      {copy.journalEntry}
                    </span>
                    <p className="font-mono text-xs font-semibold text-foreground">
                      {adjustment.journalEntryNumber ||
                        adjustment.journalEntryId ||
                        copy.pendingPosting}
                    </p>
                  </div>
                </div>
                {adjustment.journalEntryId && (
                  <Badge
                    variant="secondary"
                    className="border-0 bg-emerald-500/10 text-xs text-emerald-600 dark:text-emerald-400"
                  >
                    <CheckCircle2 className="me-1 size-3" />
                    Posted
                  </Badge>
                )}
              </div>
            </div>

            {/* Created / Confirmed Meta */}
            <div className="space-y-2 pt-1 text-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <User className="size-3.5" />
                  {copy.createdBy}
                </span>
                <span className="font-medium text-foreground">
                  {adjustment.createdByName || adjustment.createdBy || "—"}
                </span>
              </div>

              {isConfirmed && (
                <>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                      {copy.confirmedBy}
                    </span>
                    <span className="font-medium text-foreground">
                      {adjustment.confirmedByName ||
                        adjustment.confirmedBy ||
                        "—"}
                    </span>
                  </div>
                  {adjustment.confirmedAt && (
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>{copy.confirmedAt}</span>
                      <span className="font-medium tabular-nums text-foreground">
                        {new Date(adjustment.confirmedAt).toLocaleString()}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lines / Items Table */}
      <Card className="overflow-hidden shadow-none">
        <CardHeader className="border-b border-border/80 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-semibold text-foreground">
                {copy.linesTitle}
              </CardTitle>
              <Badge variant="secondary" className="font-mono text-xs">
                {lines.length}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {lines.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {copy.noItems}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-start text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs font-medium text-muted-foreground">
                  <tr>
                    <th className="w-12 px-4 py-3 text-start">#</th>
                    <th className="px-4 py-3 text-start">{copy.fields.item}</th>
                    <th className="px-4 py-3 text-start">
                      {copy.fields.location}
                    </th>
                    <th className="px-4 py-3 text-start">{copy.fields.unit}</th>
                    <th className="px-4 py-3 text-start">
                      {copy.fields.batch}
                    </th>
                    <th className="px-4 py-3 text-end">
                      {copy.fields.systemQuantity}
                    </th>
                    <th className="px-4 py-3 text-end">
                      {copy.fields.countedQuantity}
                    </th>
                    <th className="px-4 py-3 text-end">
                      {copy.fields.difference}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {lines.map((line, idx) => {
                    const deltaNum = Number(line.quantityDeltaBase || 0)
                    const unitLabel =
                      line.unitSymbol || line.unitName || undefined

                    return (
                      <tr key={line.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground tabular-nums">
                          {line.lineNo ?? idx + 1}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">
                            {line.itemName || line.itemId}
                          </div>
                          {line.notes && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {line.notes}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
                            <span className="font-medium text-foreground">
                              {line.locationName || line.locationId}
                            </span>
                            {line.locationCode && (
                              <Badge
                                variant="outline"
                                className="font-mono text-xs"
                              >
                                {line.locationCode}
                              </Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="secondary"
                            className="font-mono text-xs"
                          >
                            {line.unitSymbol || line.unitName || line.unitId}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {line.batchNumber ? (
                            <Badge
                              variant="outline"
                              className="font-mono text-xs"
                            >
                              <Tag className="me-1 size-3 text-muted-foreground" />
                              {line.batchNumber}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-end font-mono text-xs text-muted-foreground tabular-nums">
                          <span>{line.systemQuantityBase}</span>
                          {unitLabel && (
                            <span className="ms-1 text-[11px] text-muted-foreground">
                              {unitLabel}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-end font-mono text-xs font-semibold text-foreground tabular-nums">
                          <span>{line.countedQuantity}</span>
                          {unitLabel && (
                            <span className="ms-1 text-[11px] font-normal text-muted-foreground">
                              {unitLabel}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-end">
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-xs font-semibold tabular-nums ${
                              deltaNum > 0
                                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : deltaNum < 0
                                  ? "border-destructive/20 bg-destructive/10 text-destructive"
                                  : "border-border bg-muted text-muted-foreground"
                            }`}
                          >
                            {deltaNum > 0
                              ? `+${line.quantityDeltaBase}`
                              : line.quantityDeltaBase}
                            {unitLabel && (
                              <span className="ms-1 text-[11px] font-normal opacity-80">
                                {unitLabel}
                              </span>
                            )}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
