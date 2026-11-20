import {
  ActivityLogAction,
  CreateInventoryAdjustmentInput,
  InventoryAdjustmentDto,
  InventoryAdjustmentErrorCode as Err,
  InventoryAdjustmentListItemDto,
  InventoryAdjustmentOffsetListQuery,
  InventoryAdjustmentOffsetListResponse,
  InventoryAdjustmentReasonDto,
  OptionListQuery,
  OptionListResponse,
  StockSnapshotDto,
  StockSnapshotQuery,
  UpdateInventoryAdjustmentInput,
  inventoryAdjustmentTranslationsEn,
  RoleErrorCode,
} from "@avuny/contracts"
import { fail, ok, toCursorPage, type Result } from "@avuny/utils"
import {
  toInventoryAdjustmentDto,
  toInventoryAdjustmentListItemDto,
  toInventoryAdjustmentReasonDto,
} from "./inventory-adjustment.mapper.js"
import { INVENTORY_ADJUSTMENT_PERMISSIONS as P } from "./inventory-adjustment.permissions.js"
import type {
  Code,
  InventoryAdjustmentServiceDeps,
} from "./inventory-adjustment.types.js"

/* ---------- Decimal String Math Helpers ---------- */

type Parsed = { n: bigint; scale: number }

const parse = (s: string): Parsed => {
  const negative = s.startsWith("-")
  const [int = "0", frac = ""] = (negative ? s.slice(1) : s).split(".")
  const n = BigInt(int + frac)
  return { n: negative ? -n : n, scale: frac.length }
}

const align = (a: Parsed, b: Parsed) => {
  const scale = Math.max(a.scale, b.scale)
  const lift = (p: Parsed) => p.n * 10n ** BigInt(scale - p.scale)
  return { x: lift(a), y: lift(b), scale }
}

const format = (n: bigint, scale: number): string => {
  const negative = n < 0n
  const absN = negative ? -n : n
  const digits = absN.toString().padStart(scale + 1, "0")
  let body = scale === 0 ? digits : `${digits.slice(0, -scale)}.${digits.slice(-scale)}`
  if (body.includes(".")) {
    body = body.replace(/0+$/, "").replace(/\.$/, "")
  }
  return negative && body !== "0" ? `-${body}` : body
}

export const compareDecimal = (a: string, b: string): -1 | 0 | 1 => {
  const { x, y } = align(parse(a), parse(b))
  return x < y ? -1 : x > y ? 1 : 0
}

export const subtractDecimal = (a: string, b: string): string => {
  const { x, y, scale } = align(parse(a), parse(b))
  return format(x - y, scale)
}

export const negateDecimal = (a: string): string => {
  const p = parse(a)
  return format(-p.n, p.scale)
}

export const multiplyDecimal = (a: string, b: string): string => {
  const pa = parse(a)
  const pb = parse(b)
  return format(pa.n * pb.n, pa.scale + pb.scale)
}

export const divideDecimal = (a: string, b: string, precision = 6): string => {
  const pa = parse(a)
  const pb = parse(b)
  if (pb.n === 0n) throw new Error("Division by zero")
  const extraScale = precision + pb.scale - pa.scale
  const scaledNum =
    extraScale >= 0
      ? pa.n * 10n ** BigInt(extraScale)
      : pa.n / 10n ** BigInt(-extraScale)
  return format(scaledNum / pb.n, precision)
}

const message = (code: Err) => inventoryAdjustmentTranslationsEn.errors[code]

export function createInventoryAdjustmentService(deps: InventoryAdjustmentServiceDeps) {
  const repo = deps.repository

  const can = (actorId: string, action: string, orgId: string, resourceId = orgId) =>
    deps.permissions.check({ userId: actorId }, action as any, { resourceId, orgId })

  const forbidden = () =>
    fail({
      error: RoleErrorCode.ROLE_PERMISSION_DENIED,
      msg: "You do not have permission to perform this action",
    })

  const audit = (
    orgId: string,
    actorId: string,
    action: ActivityLogAction,
    resourceId: string,
    metadata?: Record<string, unknown>
  ) => deps.activityLog.record({ orgId, actorId, action, resourceId, metadata })

  const makeSnapshotToken = (systemQuantityBase: string) =>
    `${systemQuantityBase}:${Date.now()}`

  return {
    async create(
      actorId: string,
      orgId: string,
      input: CreateInventoryAdjustmentInput
    ): Promise<Result<InventoryAdjustmentDto, Code>> {
      if (!(await can(actorId, P.CREATE, orgId))) return forbidden()

      if (input.lines.length === 0) {
        return fail({ error: Err.INVENTORY_ADJUSTMENT_NO_LINES, msg: message(Err.INVENTORY_ADJUSTMENT_NO_LINES) })
      }

      // Check duplicate dimensions
      const dimensionKeys = new Set<string>()
      for (const line of input.lines) {
        const key = `${line.itemId}:${line.locationId}:${line.batchId ?? ""}`
        if (dimensionKeys.has(key)) {
          return fail({
            error: Err.INVENTORY_ADJUSTMENT_DUPLICATE_LINES,
            msg: message(Err.INVENTORY_ADJUSTMENT_DUPLICATE_LINES),
          })
        }
        dimensionKeys.add(key)
      }

      const outcome = await repo.transaction(async (tx) => {
        // 1. Validate reason
        const reason = await repo.findReason(orgId, input.reasonId, tx)
        if (!reason) {
          return { ok: false as const, error: Err.INVENTORY_ADJUSTMENT_REASON_NOT_FOUND }
        }
        if (!reason.isActive) {
          return { ok: false as const, error: Err.INVENTORY_ADJUSTMENT_REASON_INACTIVE }
        }

        // 2. Validate lines
        const validatedLines = []
        for (const line of input.lines) {
          const locCheck = await deps.warehouseLocation.validateLocation(
            orgId,
            input.warehouseId,
            line.locationId,
            tx
          )
          if (!locCheck.ok) {
            const errMap = {
              warehouse_not_found: Err.INVENTORY_ADJUSTMENT_WAREHOUSE_NOT_FOUND,
              warehouse_not_physical: Err.INVENTORY_ADJUSTMENT_WAREHOUSE_NOT_PHYSICAL,
              location_not_found: Err.INVENTORY_ADJUSTMENT_LOCATION_NOT_FOUND,
              location_not_in_warehouse: Err.INVENTORY_ADJUSTMENT_LOCATION_NOT_IN_WAREHOUSE,
              location_not_stockable: Err.INVENTORY_ADJUSTMENT_LOCATION_NOT_STOCKABLE,
              location_blocked: Err.INVENTORY_ADJUSTMENT_LOCATION_BLOCKED,
            } as const
            return { ok: false as const, error: errMap[locCheck.reason] }
          }

          const itemCheck = await deps.itemConversion.resolveUnitConversion(
            orgId,
            line.itemId,
            line.unitId,
            tx
          )
          if (!itemCheck.ok) {
            const errMap = {
              item_not_found: Err.INVENTORY_ADJUSTMENT_ITEM_NOT_FOUND,
              item_inactive: Err.INVENTORY_ADJUSTMENT_ITEM_INACTIVE,
              item_not_stocked: Err.INVENTORY_ADJUSTMENT_ITEM_NOT_STOCKED,
              unit_not_in_collection: Err.INVENTORY_ADJUSTMENT_UNIT_NOT_IN_COLLECTION,
            } as const
            return { ok: false as const, error: errMap[itemCheck.reason] }
          }

          if (itemCheck.isBatchTracked && !line.batchId) {
            return { ok: false as const, error: Err.INVENTORY_ADJUSTMENT_BATCH_REQUIRED }
          }
          if (!itemCheck.isBatchTracked && line.batchId) {
            return { ok: false as const, error: Err.INVENTORY_ADJUSTMENT_BATCH_NOT_TRACKED }
          }

          if (line.batchId) {
            const batchCheck = await deps.batch.validateBatch(orgId, line.itemId, line.batchId, tx)
            if (!batchCheck.ok) {
              return { ok: false as const, error: Err.INVENTORY_ADJUSTMENT_BATCH_NOT_FOUND }
            }
          }

          // Compute base quantities
          const currentStock = await repo.findCurrentStock(
            orgId,
            line.itemId,
            line.locationId,
            line.batchId,
            tx
          )
          const systemQuantityBase = currentStock.onHandQty
          const countedQuantityBase = multiplyDecimal(line.countedQuantity, itemCheck.factor)
          const quantityDeltaBase = subtractDecimal(countedQuantityBase, systemQuantityBase)

          validatedLines.push({
            lineNo: validatedLines.length + 1,
            itemId: line.itemId,
            locationId: line.locationId,
            unitId: line.unitId,
            batchId: line.batchId ?? null,
            countedQuantity: line.countedQuantity,
            baseUnitId: itemCheck.baseUnitId,
            systemQuantityBase,
            countedQuantityBase,
            quantityDeltaBase,
            snapshotToken: line.snapshotToken || makeSnapshotToken(systemQuantityBase),
            notes: line.notes ?? null,
          })
        }

        const docNumber = await repo.nextDocumentNumber(orgId, tx)
        const inserted = await repo.insertAggregate(
          orgId,
          {
            number: docNumber,
            referenceNumber: input.referenceNumber ?? null,
            date: input.date,
            warehouseId: input.warehouseId,
            reasonId: input.reasonId,
            description: input.description ?? null,
            status: "DRAFT",
            createdBy: actorId,
          },
          validatedLines,
          tx
        )

        if (!inserted.ok) {
          return { ok: false as const, error: Err.INVENTORY_ADJUSTMENT_NUMBER_TAKEN }
        }

        return { ok: true as const, value: toInventoryAdjustmentDto(inserted.row, inserted.lines) }
      })

      if (!outcome.ok) return fail({ error: outcome.error, msg: message(outcome.error) })
      await audit(orgId, actorId, "inventory_adjustment.created" as any, outcome.value.id)
      return ok({ data: outcome.value, msg: "Inventory adjustment created successfully" })
    },

    async update(
      actorId: string,
      orgId: string,
      id: string,
      input: UpdateInventoryAdjustmentInput
    ): Promise<Result<InventoryAdjustmentDto, Code>> {
      if (!(await can(actorId, P.UPDATE, orgId, id))) return forbidden()

      const outcome = await repo.transaction(async (tx) => {
        const current = await repo.findAggregate(orgId, id, tx, { forUpdate: true })
        if (!current) return { ok: false as const, error: Err.INVENTORY_ADJUSTMENT_NOT_FOUND }
        if (current.row.status !== "DRAFT") {
          return { ok: false as const, error: Err.INVENTORY_ADJUSTMENT_NOT_EDITABLE }
        }

        const warehouseId = input.warehouseId ?? current.row.warehouseId
        const reasonId = input.reasonId ?? current.row.reasonId

        if (input.reasonId) {
          const reason = await repo.findReason(orgId, reasonId, tx)
          if (!reason) return { ok: false as const, error: Err.INVENTORY_ADJUSTMENT_REASON_NOT_FOUND }
          if (!reason.isActive) return { ok: false as const, error: Err.INVENTORY_ADJUSTMENT_REASON_INACTIVE }
        }

        let newLines = current.lines
        if (input.lines) {
          const dimensionKeys = new Set<string>()
          for (const line of input.lines) {
            const key = `${line.itemId}:${line.locationId}:${line.batchId ?? ""}`
            if (dimensionKeys.has(key)) {
              return { ok: false as const, error: Err.INVENTORY_ADJUSTMENT_DUPLICATE_LINES }
            }
            dimensionKeys.add(key)
          }

          const validatedLines = []
          for (const line of input.lines) {
            const locCheck = await deps.warehouseLocation.validateLocation(
              orgId,
              warehouseId,
              line.locationId,
              tx
            )
            if (!locCheck.ok) {
              const errMap = {
                warehouse_not_found: Err.INVENTORY_ADJUSTMENT_WAREHOUSE_NOT_FOUND,
                warehouse_not_physical: Err.INVENTORY_ADJUSTMENT_WAREHOUSE_NOT_PHYSICAL,
                location_not_found: Err.INVENTORY_ADJUSTMENT_LOCATION_NOT_FOUND,
                location_not_in_warehouse: Err.INVENTORY_ADJUSTMENT_LOCATION_NOT_IN_WAREHOUSE,
                location_not_stockable: Err.INVENTORY_ADJUSTMENT_LOCATION_NOT_STOCKABLE,
                location_blocked: Err.INVENTORY_ADJUSTMENT_LOCATION_BLOCKED,
              } as const
              return { ok: false as const, error: errMap[locCheck.reason] }
            }

            const itemCheck = await deps.itemConversion.resolveUnitConversion(
              orgId,
              line.itemId,
              line.unitId,
              tx
            )
            if (!itemCheck.ok) {
              const errMap = {
                item_not_found: Err.INVENTORY_ADJUSTMENT_ITEM_NOT_FOUND,
                item_inactive: Err.INVENTORY_ADJUSTMENT_ITEM_INACTIVE,
                item_not_stocked: Err.INVENTORY_ADJUSTMENT_ITEM_NOT_STOCKED,
                unit_not_in_collection: Err.INVENTORY_ADJUSTMENT_UNIT_NOT_IN_COLLECTION,
              } as const
              return { ok: false as const, error: errMap[itemCheck.reason] }
            }

            if (itemCheck.isBatchTracked && !line.batchId) {
              return { ok: false as const, error: Err.INVENTORY_ADJUSTMENT_BATCH_REQUIRED }
            }
            if (!itemCheck.isBatchTracked && line.batchId) {
              return { ok: false as const, error: Err.INVENTORY_ADJUSTMENT_BATCH_NOT_TRACKED }
            }

            if (line.batchId) {
              const batchCheck = await deps.batch.validateBatch(orgId, line.itemId, line.batchId, tx)
              if (!batchCheck.ok) {
                return { ok: false as const, error: Err.INVENTORY_ADJUSTMENT_BATCH_NOT_FOUND }
              }
            }

            const currentStock = await repo.findCurrentStock(
              orgId,
              line.itemId,
              line.locationId,
              line.batchId,
              tx
            )
            const systemQuantityBase = currentStock.onHandQty
            const countedQuantityBase = multiplyDecimal(line.countedQuantity, itemCheck.factor)
            const quantityDeltaBase = subtractDecimal(countedQuantityBase, systemQuantityBase)

            validatedLines.push({
              lineNo: validatedLines.length + 1,
              itemId: line.itemId,
              locationId: line.locationId,
              unitId: line.unitId,
              batchId: line.batchId ?? null,
              countedQuantity: line.countedQuantity,
              baseUnitId: itemCheck.baseUnitId,
              systemQuantityBase,
              countedQuantityBase,
              quantityDeltaBase,
              snapshotToken: line.snapshotToken || makeSnapshotToken(systemQuantityBase),
              notes: line.notes ?? null,
            })
          }

          newLines = await repo.replaceLines(orgId, id, validatedLines, tx)
        }

        const patch: Record<string, unknown> = {}
        if (input.referenceNumber !== undefined) patch.referenceNumber = input.referenceNumber
        if (input.date !== undefined) patch.date = input.date
        if (input.warehouseId !== undefined) patch.warehouseId = input.warehouseId
        if (input.reasonId !== undefined) patch.reasonId = input.reasonId
        if (input.description !== undefined) patch.description = input.description

        const updated = await repo.updateAggregate(orgId, id, patch, tx)
        if (!updated) return { ok: false as const, error: Err.INVENTORY_ADJUSTMENT_NOT_FOUND }

        return { ok: true as const, value: toInventoryAdjustmentDto(updated, newLines) }
      })

      if (!outcome.ok) return fail({ error: outcome.error, msg: message(outcome.error) })
      await audit(orgId, actorId, "inventory_adjustment.updated" as any, id)
      return ok({ data: outcome.value, msg: "Inventory adjustment updated successfully" })
    },

    async delete(actorId: string, orgId: string, id: string): Promise<Result<{ id: string }, Code>> {
      if (!(await can(actorId, P.DELETE, orgId, id))) return forbidden()

      const outcome = await repo.transaction(async (tx) => {
        const current = await repo.findAggregate(orgId, id, tx, { forUpdate: true })
        if (!current) return { ok: false as const, error: Err.INVENTORY_ADJUSTMENT_NOT_FOUND }
        if (current.row.status !== "DRAFT") {
          return { ok: false as const, error: Err.INVENTORY_ADJUSTMENT_NOT_DELETABLE }
        }

        const deleted = await repo.delete(orgId, id, tx)
        if (!deleted.ok) {
          return { ok: false as const, error: Err.INVENTORY_ADJUSTMENT_NOT_FOUND }
        }
        return { ok: true as const, value: { id } }
      })

      if (!outcome.ok) return fail({ error: outcome.error, msg: message(outcome.error) })
      await audit(orgId, actorId, "inventory_adjustment.deleted" as any, id)
      return ok({ data: { id }, msg: "Inventory adjustment deleted successfully" })
    },

    async listOptions(
      actorId: string,
      orgId: string,
      query: OptionListQuery
    ): Promise<Result<OptionListResponse, Code>> {
      if (!(await can(actorId, P.READ, orgId))) return forbidden()
      const rows = await repo.listOptions(orgId, {
        search: query.search,
        limit: query.limit + 1,
      })
      const page = toCursorPage(rows, query.limit, (row) => ({ name: row.name, id: row.id }))
      return ok({
        data: {
          items: page.items.map(({ id, name }) => ({ id, name })),
          nextCursor: page.nextCursor,
        },
        msg: "Inventory adjustment options retrieved successfully",
      })
    },

    async list(
      actorId: string,
      orgId: string,
      query: InventoryAdjustmentOffsetListQuery
    ): Promise<Result<InventoryAdjustmentOffsetListResponse, Code>> {
      if (!(await can(actorId, P.READ, orgId))) return forbidden()
      const { rows, total } = await repo.list(orgId, {
        page: query.page,
        pageSize: query.pageSize,
        search: query.search || undefined,
        warehouseId: query.warehouseId,
        reasonId: query.reasonId,
        status: query.status,
        fromDate: query.fromDate,
        toDate: query.toDate,
      })

      return ok({
        data: {
          items: rows.map(({ adjustment, lineCount }) =>
            toInventoryAdjustmentListItemDto(adjustment, lineCount)
          ),
          page: query.page,
          pageSize: query.pageSize,
          total,
        },
        msg: "Inventory adjustments retrieved successfully",
      })
    },

    async get(actorId: string, orgId: string, id: string): Promise<Result<InventoryAdjustmentDto, Code>> {
      if (!(await can(actorId, P.READ, orgId, id))) return forbidden()
      const aggregate = await repo.findAggregate(orgId, id)
      if (!aggregate) {
        return fail({ error: Err.INVENTORY_ADJUSTMENT_NOT_FOUND, msg: message(Err.INVENTORY_ADJUSTMENT_NOT_FOUND) })
      }
      return ok({
        data: toInventoryAdjustmentDto(aggregate.row, aggregate.lines),
        msg: "Inventory adjustment retrieved successfully",
      })
    },

    /* ---------- Domain operations: confirm, cancel, snapshot, reasons ---------- */

    async confirm(actorId: string, orgId: string, id: string): Promise<Result<InventoryAdjustmentDto, Code>> {
      if (!(await can(actorId, P.CONFIRM, orgId, id))) return forbidden()

      const outcome = await repo.transaction(async (tx) => {
        const current = await repo.findAggregate(orgId, id, tx, { forUpdate: true })
        if (!current) return { ok: false as const, error: Err.INVENTORY_ADJUSTMENT_NOT_FOUND }
        if (current.row.status === "CONFIRMED") {
          return { ok: false as const, error: Err.INVENTORY_ADJUSTMENT_ALREADY_CONFIRMED }
        }
        if (current.row.status === "CANCELLED") {
          return { ok: false as const, error: Err.INVENTORY_ADJUSTMENT_ALREADY_CANCELLED }
        }
        if (current.lines.length === 0) {
          return { ok: false as const, error: Err.INVENTORY_ADJUSTMENT_NO_LINES }
        }

        const reason = await repo.findReason(orgId, current.row.reasonId, tx)
        if (!reason || !reason.isActive) {
          return { ok: false as const, error: Err.INVENTORY_ADJUSTMENT_REASON_INACTIVE }
        }

        // Validate lines & stale count protection
        const movementLines = []
        let hasNonZeroDiff = false

        for (const line of current.lines) {
          const currentStock = await repo.findCurrentStock(
            orgId,
            line.itemId,
            line.locationId,
            line.batchId,
            tx
          )

          // Stale count validation: system stock must match snapshot
          if (compareDecimal(currentStock.onHandQty, line.systemQuantityBase) !== 0) {
            return { ok: false as const, error: Err.INVENTORY_ADJUSTMENT_STALE_COUNT }
          }

          const delta = line.quantityDeltaBase
          const comp = compareDecimal(delta, "0")

          if (comp !== 0) {
            hasNonZeroDiff = true
            // Check direction compatibility
            if (reason.direction === "INCREASE" && comp < 0) {
              return { ok: false as const, error: Err.INVENTORY_ADJUSTMENT_DIRECTION_MISMATCH }
            }
            if (reason.direction === "DECREASE" && comp > 0) {
              return { ok: false as const, error: Err.INVENTORY_ADJUSTMENT_DIRECTION_MISMATCH }
            }

            if (comp > 0) {
              // Gain: toLocation is the warehouse location, from is null (resolved to adjustment system location)
              movementLines.push({
                itemId: line.itemId,
                batchId: line.batchId,
                toLocationId: line.locationId,
                quantity: delta,
              })
            } else {
              // Loss: fromLocation is the warehouse location, to is null (resolved to adjustment system location)
              movementLines.push({
                itemId: line.itemId,
                batchId: line.batchId,
                fromLocationId: line.locationId,
                quantity: negateDecimal(delta),
              })
            }
          }
        }

        if (!hasNonZeroDiff || movementLines.length === 0) {
          return { ok: false as const, error: Err.INVENTORY_ADJUSTMENT_NO_DIFFERENCE }
        }

        // Post stock movement
        const moveResult = await deps.stockMovement.post(
          actorId,
          orgId,
          {
            type: "adjustment",
            sourceType: "inventory_adjustment",
            sourceId: current.row.id,
            sourceRef: current.row.number,
            lines: movementLines,
          },
          tx
        )
        if (!moveResult.success) {
          return { ok: false as const, error: moveResult.error as Err }
        }

        const movement = moveResult.data

        // Post accounting journal entry
        const isDecrease = reason.direction === "DECREASE" || (reason.direction === "BOTH" && movementLines[0]?.fromLocationId)
        const eventKind = reason.code === "DAMAGE" ? "damage" : isDecrease ? "shortage" : "value_increase"

        const acctResult = await deps.accounting.postBusinessEvent(
          actorId,
          orgId,
          {
            event: "inventory_adjustment",
            kind: eventKind as any,
            sourceId: current.row.id,
            date: current.row.date,
            amountMinor: "0",
          },
          tx
        )

        const journalEntryId = acctResult.success ? acctResult.data.id : null

        // Mark CONFIRMED
        const now = new Date()
        const confirmed = await repo.updateAggregate(
          orgId,
          id,
          {
            status: "CONFIRMED",
            confirmedBy: actorId,
            confirmedAt: now,
            stockMovementId: movement.id,
            journalEntryId,
          },
          tx
        )

        if (!confirmed) {
          return { ok: false as const, error: Err.INVENTORY_ADJUSTMENT_NOT_FOUND }
        }

        return { ok: true as const, value: toInventoryAdjustmentDto(confirmed, current.lines) }
      })

      if (!outcome.ok) return fail({ error: outcome.error, msg: message(outcome.error) })
      await audit(orgId, actorId, "inventory_adjustment.confirmed" as any, id)
      return ok({ data: outcome.value, msg: "Inventory adjustment confirmed successfully" })
    },

    async cancel(actorId: string, orgId: string, id: string): Promise<Result<InventoryAdjustmentDto, Code>> {
      if (!(await can(actorId, P.CANCEL, orgId, id))) return forbidden()

      const outcome = await repo.transaction(async (tx) => {
        const current = await repo.findAggregate(orgId, id, tx, { forUpdate: true })
        if (!current) return { ok: false as const, error: Err.INVENTORY_ADJUSTMENT_NOT_FOUND }
        if (current.row.status === "CONFIRMED") {
          return { ok: false as const, error: Err.INVENTORY_ADJUSTMENT_CANNOT_CANCEL_CONFIRMED }
        }
        if (current.row.status === "CANCELLED") {
          return { ok: false as const, error: Err.INVENTORY_ADJUSTMENT_ALREADY_CANCELLED }
        }

        const cancelled = await repo.updateAggregate(orgId, id, { status: "CANCELLED" }, tx)
        if (!cancelled) return { ok: false as const, error: Err.INVENTORY_ADJUSTMENT_NOT_FOUND }

        return { ok: true as const, value: toInventoryAdjustmentDto(cancelled, current.lines) }
      })

      if (!outcome.ok) return fail({ error: outcome.error, msg: message(outcome.error) })
      await audit(orgId, actorId, "inventory_adjustment.cancelled" as any, id)
      return ok({ data: outcome.value, msg: "Inventory adjustment cancelled successfully" })
    },

    async getSnapshot(
      actorId: string,
      orgId: string,
      query: StockSnapshotQuery
    ): Promise<Result<StockSnapshotDto, Code>> {
      if (!(await can(actorId, P.READ, orgId))) return forbidden()

      const locCheck = await deps.warehouseLocation.validateLocation(
        orgId,
        query.warehouseId,
        query.locationId
      )
      if (!locCheck.ok) {
        const errMap = {
          warehouse_not_found: Err.INVENTORY_ADJUSTMENT_WAREHOUSE_NOT_FOUND,
          warehouse_not_physical: Err.INVENTORY_ADJUSTMENT_WAREHOUSE_NOT_PHYSICAL,
          location_not_found: Err.INVENTORY_ADJUSTMENT_LOCATION_NOT_FOUND,
          location_not_in_warehouse: Err.INVENTORY_ADJUSTMENT_LOCATION_NOT_IN_WAREHOUSE,
          location_not_stockable: Err.INVENTORY_ADJUSTMENT_LOCATION_NOT_STOCKABLE,
          location_blocked: Err.INVENTORY_ADJUSTMENT_LOCATION_BLOCKED,
        } as const
        return fail({ error: errMap[locCheck.reason], msg: message(errMap[locCheck.reason]) })
      }

      const itemCheck = await deps.itemConversion.resolveUnitConversion(
        orgId,
        query.itemId,
        query.unitId
      )
      if (!itemCheck.ok) {
        const errMap = {
          item_not_found: Err.INVENTORY_ADJUSTMENT_ITEM_NOT_FOUND,
          item_inactive: Err.INVENTORY_ADJUSTMENT_ITEM_INACTIVE,
          item_not_stocked: Err.INVENTORY_ADJUSTMENT_ITEM_NOT_STOCKED,
          unit_not_in_collection: Err.INVENTORY_ADJUSTMENT_UNIT_NOT_IN_COLLECTION,
        } as const
        return fail({ error: errMap[itemCheck.reason], msg: message(errMap[itemCheck.reason]) })
      }

      if (itemCheck.isBatchTracked && !query.batchId) {
        return fail({ error: Err.INVENTORY_ADJUSTMENT_BATCH_REQUIRED, msg: message(Err.INVENTORY_ADJUSTMENT_BATCH_REQUIRED) })
      }
      if (!itemCheck.isBatchTracked && query.batchId) {
        return fail({ error: Err.INVENTORY_ADJUSTMENT_BATCH_NOT_TRACKED, msg: message(Err.INVENTORY_ADJUSTMENT_BATCH_NOT_TRACKED) })
      }

      if (query.batchId) {
        const batchCheck = await deps.batch.validateBatch(orgId, query.itemId, query.batchId)
        if (!batchCheck.ok) {
          return fail({ error: Err.INVENTORY_ADJUSTMENT_BATCH_NOT_FOUND, msg: message(Err.INVENTORY_ADJUSTMENT_BATCH_NOT_FOUND) })
        }
      }

      const currentStock = await repo.findCurrentStock(
        orgId,
        query.itemId,
        query.locationId,
        query.batchId
      )
      const systemQuantityBase = currentStock.onHandQty
      const systemQuantitySelectedUnit = divideDecimal(systemQuantityBase, itemCheck.factor)
      const snapshotToken = makeSnapshotToken(systemQuantityBase)

      return ok({
        data: {
          itemId: query.itemId,
          locationId: query.locationId,
          batchId: query.batchId ?? null,
          baseUnitId: itemCheck.baseUnitId,
          selectedUnitId: query.unitId,
          conversionFactor: itemCheck.factor,
          systemQuantityBase,
          systemQuantitySelectedUnit,
          snapshotToken,
        },
        msg: "Stock snapshot retrieved successfully",
      })
    },

    async listReasons(
      actorId: string,
      orgId: string
    ): Promise<Result<{ items: InventoryAdjustmentReasonDto[] }, Code>> {
      if (!(await can(actorId, P.READ, orgId))) return forbidden()
      const reasons = await repo.listReasons(orgId)
      return ok({
        data: {
          items: reasons.map(toInventoryAdjustmentReasonDto),
        },
        msg: "Adjustment reasons retrieved successfully",
      })
    },
  }
}

export type InventoryAdjustmentService = ReturnType<typeof createInventoryAdjustmentService>
