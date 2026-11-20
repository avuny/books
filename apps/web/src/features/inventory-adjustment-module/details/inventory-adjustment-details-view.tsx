import { ArrowLeft, CheckCircle2, Pencil, Trash2, XCircle } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
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

// UI only. No i18n, API, auth or navigation knowledge.
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
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
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
        <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
          {errorMessage || "Adjustment not found."}
        </div>
      </div>
    )
  }

  const isDraft = adjustment.status === "DRAFT"

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="outline" size="icon" onClick={onBack} aria-label={copy.backLabel}>
              <ArrowLeft className="size-4 rtl:rotate-180" />
            </Button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                {adjustment.number}
              </h1>
              <InventoryAdjustmentStatusBadge
                status={adjustment.status}
                label={copy.getStatusLabel(adjustment.status)}
              />
            </div>
            <p className="text-sm text-muted-foreground">{adjustment.date}</p>
          </div>
        </div>

        {/* Actions */}
        {isDraft && (
          <div className="flex items-center gap-2">
            {canUpdate && onEdit && (
              <Button variant="outline" size="sm" onClick={onEdit}>
                <Pencil className="me-1 size-4" />
                {copy.actions.edit}
              </Button>
            )}
            {canConfirm && onConfirm && (
              <Button variant="default" size="sm" onClick={onConfirm}>
                <CheckCircle2 className="me-1 size-4" />
                {copy.actions.confirm}
              </Button>
            )}
            {canCancel && onCancel && (
              <Button variant="outline" size="sm" onClick={onCancel}>
                <XCircle className="me-1 size-4" />
                {copy.actions.cancel}
              </Button>
            )}
            {canDelete && onDelete && (
              <Button variant="destructive" size="sm" onClick={onDelete}>
                <Trash2 className="me-1 size-4" />
                {copy.actions.delete}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Meta cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <span className="text-xs font-medium text-muted-foreground">{copy.referenceNumber}</span>
          <p className="mt-1 text-sm font-medium text-foreground">{adjustment.referenceNumber || "—"}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <span className="text-xs font-medium text-muted-foreground">{copy.description}</span>
          <p className="mt-1 text-sm font-medium text-foreground">{adjustment.description || "—"}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <span className="text-xs font-medium text-muted-foreground">{copy.stockMovement}</span>
          <p className="mt-1 text-sm font-medium text-foreground">{adjustment.stockMovementId || "—"}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <span className="text-xs font-medium text-muted-foreground">{copy.journalEntry}</span>
          <p className="mt-1 text-sm font-medium text-foreground">{adjustment.journalEntryId || "—"}</p>
        </div>
      </div>

      {/* Lines table */}
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold text-foreground">{copy.linesTitle} ({adjustment.lines.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-start text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs font-medium text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-start">#</th>
                <th className="px-4 py-3 text-start">{copy.fields.item}</th>
                <th className="px-4 py-3 text-start">{copy.fields.location}</th>
                <th className="px-4 py-3 text-start">{copy.fields.unit}</th>
                <th className="px-4 py-3 text-start">{copy.fields.batch}</th>
                <th className="px-4 py-3 text-end">{copy.fields.systemQuantity}</th>
                <th className="px-4 py-3 text-end">{copy.fields.countedQuantity}</th>
                <th className="px-4 py-3 text-end">{copy.fields.difference}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {adjustment.lines.map((line, idx) => (
                <tr key={line.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 text-muted-foreground tabular-nums">{line.lineNo ?? idx + 1}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{line.itemId}</td>
                  <td className="px-4 py-3 text-muted-foreground">{line.locationId}</td>
                  <td className="px-4 py-3 text-muted-foreground">{line.unitId}</td>
                  <td className="px-4 py-3 text-muted-foreground">{line.batchId || "—"}</td>
                  <td className="px-4 py-3 text-end tabular-nums text-muted-foreground">{line.systemQuantityBase}</td>
                  <td className="px-4 py-3 text-end tabular-nums font-medium text-foreground">{line.countedQuantity}</td>
                  <td className="px-4 py-3 text-end tabular-nums font-semibold">
                    <span className={Number(line.quantityDeltaBase) < 0 ? "text-destructive" : Number(line.quantityDeltaBase) > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}>
                      {Number(line.quantityDeltaBase) > 0 ? `+${line.quantityDeltaBase}` : line.quantityDeltaBase}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
