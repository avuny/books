import type {
  InventoryAdjustment,
  InventoryAdjustmentLine,
  InventoryAdjustmentReason,
  NewInventoryAdjustment,
  NewInventoryAdjustmentLine,
} from "@avuny/db"
import { fail, ok } from "@avuny/utils"
import { isPositiveQuantity, StockMovementErrorCode } from "@avuny/contracts"
import type {
  AccountingPort,
  ActivityLogPort,
  BatchPort,
  InventoryAdjustmentRepository,
  InventoryCostingPort,
  ItemConversionPort,
  StockMovementPort,
  WarehouseLocationPort,
} from "./inventory-adjustment.types.js"

export class InMemoryInventoryAdjustmentRepository implements InventoryAdjustmentRepository {
  adjustments: InventoryAdjustment[] = []
  lines: InventoryAdjustmentLine[] = []
  reasons: InventoryAdjustmentReason[] = []
  stock: Map<string, string> = new Map() // key: locationId:itemId:batchId -> onHandQty
  seq = 0

  async transaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    return fn(this)
  }

  async nextDocumentNumber(_orgId: string): Promise<string> {
    this.seq += 1
    return `ADJ-${String(this.seq).padStart(6, "0")}`
  }

  async insertAggregate(
    orgId: string,
    values: Omit<NewInventoryAdjustment, "orgId" | "id">,
    lines: readonly Omit<NewInventoryAdjustmentLine, "orgId" | "id" | "adjustmentId">[]
  ) {
    const existing = this.adjustments.find((a) => a.orgId === orgId && a.number === values.number)
    if (existing) {
      return { ok: false as const, reason: "number_taken" as const }
    }

    const id = `adj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const now = new Date()
    const adjustment: InventoryAdjustment = {
      id,
      orgId,
      number: values.number,
      referenceNumber: values.referenceNumber ?? null,
      date: values.date,
      warehouseId: values.warehouseId,
      reasonId: values.reasonId,
      description: values.description ?? null,
      status: values.status ?? "DRAFT",
      createdBy: values.createdBy ?? null,
      confirmedBy: values.confirmedBy ?? null,
      confirmedAt: values.confirmedAt ?? null,
      stockMovementId: values.stockMovementId ?? null,
      journalEntryId: values.journalEntryId ?? null,
      createdAt: now,
      updatedAt: now,
    }
    this.adjustments.push(adjustment)

    const insertedLines: InventoryAdjustmentLine[] = lines.map((l, index) => ({
      id: `line-${Date.now()}-${index}`,
      orgId,
      adjustmentId: id,
      lineNo: index + 1,
      itemId: l.itemId,
      locationId: l.locationId,
      unitId: l.unitId,
      batchId: l.batchId ?? null,
      countedQuantity: l.countedQuantity,
      baseUnitId: l.baseUnitId,
      systemQuantityBase: l.systemQuantityBase,
      countedQuantityBase: l.countedQuantityBase,
      quantityDeltaBase: l.quantityDeltaBase,
      snapshotToken: l.snapshotToken ?? null,
      notes: l.notes ?? null,
      createdAt: now,
      updatedAt: now,
    }))
    this.lines.push(...insertedLines)

    return { ok: true as const, row: adjustment, lines: insertedLines }
  }

  async findAggregate(orgId: string, id: string) {
    const row = this.adjustments.find((a) => a.orgId === orgId && a.id === id)
    if (!row) return null
    const lines = this.lines
      .filter((l) => l.orgId === orgId && l.adjustmentId === id)
      .sort((a, b) => a.lineNo - b.lineNo)
    return { row, lines }
  }

  async findDetail(orgId: string, id: string) {
    return this.findAggregate(orgId, id) as any
  }

  async updateAggregate(orgId: string, id: string, patch: Partial<NewInventoryAdjustment>) {
    const idx = this.adjustments.findIndex((a) => a.orgId === orgId && a.id === id)
    if (idx === -1) return null
    const current = this.adjustments[idx]!
    const updated: InventoryAdjustment = {
      ...current,
      ...patch,
      updatedAt: new Date(),
    }
    this.adjustments[idx] = updated
    return updated
  }

  async replaceLines(
    orgId: string,
    adjustmentId: string,
    lines: readonly Omit<NewInventoryAdjustmentLine, "orgId" | "id" | "adjustmentId">[]
  ) {
    this.lines = this.lines.filter((l) => !(l.orgId === orgId && l.adjustmentId === adjustmentId))
    const now = new Date()
    const insertedLines: InventoryAdjustmentLine[] = lines.map((l, index) => ({
      id: `line-${Date.now()}-${index}`,
      orgId,
      adjustmentId,
      lineNo: index + 1,
      itemId: l.itemId,
      locationId: l.locationId,
      unitId: l.unitId,
      batchId: l.batchId ?? null,
      countedQuantity: l.countedQuantity,
      baseUnitId: l.baseUnitId,
      systemQuantityBase: l.systemQuantityBase,
      countedQuantityBase: l.countedQuantityBase,
      quantityDeltaBase: l.quantityDeltaBase,
      snapshotToken: l.snapshotToken ?? null,
      notes: l.notes ?? null,
      createdAt: now,
      updatedAt: now,
    }))
    this.lines.push(...insertedLines)
    return insertedLines
  }

  async delete(orgId: string, id: string) {
    const idx = this.adjustments.findIndex((a) => a.orgId === orgId && a.id === id)
    if (idx === -1) return { ok: false, reason: "not_found" as const }
    this.adjustments.splice(idx, 1)
    this.lines = this.lines.filter((l) => !(l.orgId === orgId && l.adjustmentId === id))
    return { ok: true }
  }

  async list(orgId: string, filters: { page: number; pageSize: number }) {
    const filtered = this.adjustments.filter((a) => a.orgId === orgId)
    const rows = filtered
      .slice((filters.page - 1) * filters.pageSize, filters.page * filters.pageSize)
      .map((adjustment) => ({
        adjustment,
        lineCount: this.lines.filter((l) => l.adjustmentId === adjustment.id).length,
      }))
    return { rows, total: filtered.length }
  }

  async listOptions(orgId: string, filters: { limit: number }) {
    return this.adjustments
      .filter((a) => a.orgId === orgId)
      .slice(0, filters.limit)
      .map((a) => ({ id: a.id, name: a.number }))
  }

  async listReasons(orgId: string) {
    return this.reasons.filter(
      (r) => (r.orgId === null || r.orgId === orgId) && r.isActive
    )
  }

  async findReason(orgId: string, reasonId: string) {
    return (
      this.reasons.find(
        (r) => r.id === reasonId && (r.orgId === null || r.orgId === orgId)
      ) ?? null
    )
  }

  async findCurrentStock(orgId: string, itemId: string, locationId: string, batchId?: string | null) {
    const key = `${locationId}:${itemId}:${batchId ?? ""}`
    return { onHandQty: this.stock.get(key) ?? "0" }
  }

  async findInventoryItemRecord(orgId: string, warehouseId: string, locationId: string, itemId: string) {
    return { id: `inv-item-${itemId}-${locationId}` }
  }

  async findInventoryItemBatchRecord(orgId: string, inventoryItemId: string, itemId: string, batchId: string) {
    return { id: `inv-batch-${batchId}` }
  }
}

export const dummyItemConversion: ItemConversionPort = {
  async resolveUnitConversion(_orgId, itemId, unitId) {
    return {
      ok: true,
      baseUnitId: unitId,
      factor: "1",
      tracksStock: true,
      isBatchTracked: false,
      allowNegativeStock: false,
    }
  },
}

export const dummyWarehouseLocation: WarehouseLocationPort = {
  async validateLocation() {
    return { ok: true }
  },
}

export const dummyBatch: BatchPort = {
  async validateBatch() {
    return { ok: true }
  },
}

export const dummyStockMovement: StockMovementPort = {
  async post(_actorId, _orgId, input) {
    if (input.lines.some((l) => !isPositiveQuantity(l.quantity))) {
      return fail({
        error: StockMovementErrorCode.STOCK_MOVEMENT_INVALID_QUANTITY,
        msg: "The quantity is not valid",
      })
    }
    const now = new Date().toISOString()
    return ok({
      data: {
        id: "movement-1",
        number: "SM-000001",
        type: input.type,
        sourceType: input.sourceType ?? null,
        sourceId: input.sourceId ?? null,
        sourceRef: input.sourceRef ?? null,
        reversalOfId: null,
        reversedById: null,
        postedAt: now,
        createdBy: null,
        createdAt: now,
        note: null,
        lines: input.lines.map((l, i) => ({
          id: `mv-line-${i}`,
          lineNo: i + 1,
          itemId: l.itemId,
          batchId: l.batchId ?? null,
          quantity: l.quantity,
          fromLocationId: (l as any).fromLocationId ?? "sys-adj",
          toLocationId: (l as any).toLocationId ?? "sys-adj",
        })),
      },
    })
  },
}

export const dummyInventoryCosting: InventoryCostingPort = {
  async createCostLayer(input) {
    return {
      id: "cost-layer-1",
      orgId: input.orgId,
      inventoryItemId: input.inventoryItemId,
      itemId: input.itemId,
      inventoryItemBatchId: input.inventoryItemBatchId,
      sourceMovementLineId: input.sourceMovementLineId,
      originCostLayerId: input.originCostLayerId,
      receivedQty: input.receivedQty,
      remainingQty: input.receivedQty,
      receivedValue: input.receivedValue,
      remainingValue: input.receivedValue,
      currency: input.currency,
      receivedAt: input.receivedAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  },
  async recordAllocation() {},
  async getFifoLayers() {
    return []
  },
}

export const dummyAccounting: AccountingPort = {
  async postBusinessEvent() {
    return ok({
      data: {
        id: "je-1",
        entryNumber: "JE-000001",
        date: "2026-11-20",
        sourceType: "inventory_adjustment",
        sourceId: "adj-1",
        status: "POSTED",
        lines: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any,
    })
  },
}

export const dummyPermissions = {
  async check() {
    return true
  },
}

export const dummyActivityLog = {
  async record() {},
}
