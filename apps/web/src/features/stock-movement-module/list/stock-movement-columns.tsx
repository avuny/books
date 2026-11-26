import type { ColumnDef } from "@tanstack/react-table"
import type { DisplayUnitOption, StockMovementLineHistoryItem } from "../types"
import { convertQuantityFromBase, trimDecimal } from "../lib"
import { StockMovementDirectionBadge } from "../components/stock-movement-direction-badge"
import { StockMovementTypeBadge } from "../components/stock-movement-type-badge"

export interface CreateStockMovementColumnsOptions {
  /** When true, the Item column is hidden (for single-item detail view) */
  hideItemColumn?: boolean
  /** When provided, values are converted to this unit; otherwise base unit is used */
  displayUnit?: DisplayUnitOption | null
  copy: {
    reference: string
    date: string
    item: string
    movementType: string
    warehouseLocation: string
    direction: string
    quantity: string
    runningBalance: string
  }
  formatDate: (iso: string) => string
}

function resolveWarehouseLocation(row: StockMovementLineHistoryItem): string {
  // Use resolved physical warehouse/location first
  const whName =
    row.physicalWarehouseName ||
    (row.toWarehouseType === "physical"
      ? row.toWarehouseName
      : row.fromWarehouseType === "physical"
        ? row.fromWarehouseName
        : null)

  const locCode =
    row.physicalLocationCode ||
    row.physicalLocationName ||
    (row.toWarehouseType === "physical"
      ? row.toLocationCode || row.toLocationName
      : row.fromWarehouseType === "physical"
        ? row.fromLocationCode || row.fromLocationName
        : null)

  if (whName && locCode) return `${whName} - ${locCode}`
  if (whName) return whName
  if (locCode) return locCode
  return "—"
}

export function createStockMovementColumns({
  hideItemColumn = false,
  displayUnit,
  copy,
  formatDate,
}: CreateStockMovementColumnsOptions): ColumnDef<StockMovementLineHistoryItem>[] {
  const columns: ColumnDef<StockMovementLineHistoryItem>[] = [
    // 1. Reference (Always first)
    {
      accessorKey: "sourceRef",
      id: "reference",
      header: copy.reference,
      cell: ({ row }) => {
        const ref = row.original.sourceRef || row.original.sourceType || "—"
        return (
          <span className="font-mono text-xs font-medium text-foreground">
            {ref}
          </span>
        )
      },
    },

    // 2. Date
    {
      accessorKey: "postedAt",
      id: "date",
      header: copy.date,
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {formatDate(row.original.postedAt)}
        </span>
      ),
    },
  ]

  // 3. Item (Only in general listing)
  if (!hideItemColumn) {
    columns.push({
      accessorKey: "itemName",
      id: "item",
      header: copy.item,
      cell: ({ row }) => {
        const name = row.original.itemName || row.original.itemId
        return (
          <div className="font-medium text-xs text-foreground truncate max-w-[200px]">
            {name}
          </div>
        )
      },
    })
  }

  // 4. Movement Type
  columns.push({
    accessorKey: "type",
    id: "movementType",
    header: copy.movementType,
    cell: ({ row }) => (
      <StockMovementTypeBadge type={row.original.type} />
    ),
  })

  // 5. Warehouse - Location
  columns.push({
    id: "warehouseLocation",
    header: copy.warehouseLocation,
    cell: ({ row }) => (
      <span className="text-xs text-foreground">
        {resolveWarehouseLocation(row.original)}
      </span>
    ),
  })

  // 6. Direction
  columns.push({
    accessorKey: "direction",
    id: "direction",
    header: copy.direction,
    cell: ({ row }) => (
      <StockMovementDirectionBadge direction={row.original.direction} />
    ),
  })

  // 7. Quantity
  columns.push({
    accessorKey: "quantity",
    id: "quantity",
    header: () => <div className="text-end">{copy.quantity}</div>,
    cell: ({ row }) => {
      const baseQty = row.original.quantity
      const symbol = displayUnit?.symbol || row.original.baseUnitSymbol || ""
      const factor = displayUnit?.conversionFactor
      const val = factor ? convertQuantityFromBase(baseQty, factor) : trimDecimal(baseQty)

      return (
        <div className="text-end font-mono text-xs text-foreground whitespace-nowrap">
          {val} {symbol}
        </div>
      )
    },
  })

  // 8. Running Balance (Always last)
  columns.push({
    accessorKey: "runningBalance",
    id: "runningBalance",
    header: () => <div className="text-end">{copy.runningBalance}</div>,
    cell: ({ row }) => {
      const balance = row.original.runningBalance
      if (!balance) return <div className="text-end font-mono text-xs text-muted-foreground">—</div>

      const symbol = displayUnit?.symbol || row.original.baseUnitSymbol || ""
      const factor = displayUnit?.conversionFactor
      const val = factor ? convertQuantityFromBase(balance, factor) : trimDecimal(balance)

      return (
        <div className="text-end font-mono text-xs font-medium text-foreground whitespace-nowrap">
          {val} {symbol}
        </div>
      )
    },
  })

  return columns
}
