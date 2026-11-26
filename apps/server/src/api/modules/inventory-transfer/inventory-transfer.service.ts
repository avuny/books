import {
  InventoryTransferErrorCode as Err,
  RoleErrorCode,
  inventoryTransferTranslationsEn,
  INVENTORY_TRANSFER_AUDIT_EVENTS as AUDIT,
  type CreateInventoryTransferInput,
  type InventoryTransferDto,
  type InventoryTransferOffsetListQuery,
  type InventoryTransferOffsetListResponse,
  type InventoryTransferOptionsQuery,
  type InventoryTransferOptionDto,
  type UpdateInventoryTransferInput,
  type ActivityLogAction,
} from "@avuny/contracts"
import { fail, ok, type Result } from "@avuny/utils"
import { multiplyDecimal } from "../inventory-adjustment/inventory-adjustment.service.js"
import { toInventoryTransferDto, toInventoryTransferListItemDto } from "./inventory-transfer.mapper.js"
import { INVENTORY_TRANSFER_PERMISSIONS as P } from "./inventory-transfer.permissions.js"
import type { Code, InventoryTransferServiceDeps, NewLine } from "./inventory-transfer.types.js"

const message = (code: Err) =>
  (inventoryTransferTranslationsEn.errors as Record<string, string>)[code] ?? code

const LOCATION_ERRORS = {
  warehouse_not_found: Err.INVENTORY_TRANSFER_WAREHOUSE_NOT_FOUND,
  warehouse_not_physical: Err.INVENTORY_TRANSFER_WAREHOUSE_NOT_PHYSICAL,
  location_not_found: Err.INVENTORY_TRANSFER_LOCATION_NOT_FOUND,
  location_not_in_warehouse: Err.INVENTORY_TRANSFER_LOCATION_NOT_IN_WAREHOUSE,
  location_not_stockable: Err.INVENTORY_TRANSFER_LOCATION_NOT_STOCKABLE,
  location_blocked: Err.INVENTORY_TRANSFER_LOCATION_BLOCKED,
} as const

const ITEM_ERRORS = {
  item_not_found: Err.INVENTORY_TRANSFER_ITEM_NOT_FOUND,
  item_inactive: Err.INVENTORY_TRANSFER_ITEM_INACTIVE,
  item_not_stocked: Err.INVENTORY_TRANSFER_ITEM_NOT_STOCKED,
  unit_not_in_collection: Err.INVENTORY_TRANSFER_UNIT_NOT_IN_COLLECTION,
} as const

type Step<T> = { ok: true; value: T } | { ok: false; error: Err }

export function createInventoryTransferService(deps: InventoryTransferServiceDeps) {
  const repo = deps.repository

  const can = (actorId: string, action: string, orgId: string, resourceId = orgId) =>
    deps.permissions.check({ userId: actorId }, action as any, { resourceId, orgId })

  const forbidden = () =>
    fail({
      error: RoleErrorCode.ROLE_PERMISSION_DENIED,
      msg: "You do not have permission to perform this action",
    })

  const audit = (orgId: string, actorId: string, action: string, resourceId: string) =>
    deps.activityLog.record({ orgId, actorId, action: action as ActivityLogAction, resourceId })

  /** Validates warehouses and lines and converts quantities to the item's base unit. */
  async function buildLines(
    orgId: string,
    sourceWarehouseId: string,
    destinationWarehouseId: string,
    input: CreateInventoryTransferInput["lines"],
    tx: Parameters<typeof deps.locations.validateLocation>[3]
  ): Promise<Step<NewLine[]>> {
    if (input.length === 0) return { ok: false, error: Err.INVENTORY_TRANSFER_NO_LINES }
    const seen = new Set<string>()
    for (const l of input) {
      const key = `${l.itemId}:${l.sourceLocationId}:${l.destinationLocationId}`
      if (seen.has(key)) return { ok: false, error: Err.INVENTORY_TRANSFER_DUPLICATE_LINES }
      seen.add(key)
    }
    const out: NewLine[] = []
    for (const l of input) {
      if (l.sourceLocationId === l.destinationLocationId) {
        return { ok: false, error: Err.INVENTORY_TRANSFER_SAME_LOCATION }
      }
      const src = await deps.locations.validateLocation(orgId, sourceWarehouseId, l.sourceLocationId, tx)
      if (!src.ok) return { ok: false, error: LOCATION_ERRORS[src.reason] }
      const dst = await deps.locations.validateLocation(orgId, destinationWarehouseId, l.destinationLocationId, tx)
      if (!dst.ok) return { ok: false, error: LOCATION_ERRORS[dst.reason] }

      const item = await deps.items.resolveUnitConversion(orgId, l.itemId, l.unitId, tx)
      if (!item.ok) return { ok: false, error: ITEM_ERRORS[item.reason] }

      const base = multiplyDecimal(l.quantity, item.factor)
      const [, frac = ""] = base.split(".")
      if (base.startsWith("-") || base === "0" || frac.length > 6 || base.replace(".", "").length > 18) {
        return { ok: false, error: Err.INVENTORY_TRANSFER_INVALID_QUANTITY }
      }
      out.push({
        lineNo: out.length + 1,
        itemId: l.itemId,
        sourceLocationId: l.sourceLocationId,
        destinationLocationId: l.destinationLocationId,
        unitId: l.unitId,
        baseUnitId: item.baseUnitId,
        requestedQty: l.quantity,
        requestedBaseQty: base,
        dispatchedBaseQty: "0",
        notes: l.notes ?? null,
      })
    }
    return { ok: true, value: out }
  }

  const detailDto = async (orgId: string, id: string, tx?: Parameters<typeof repo.findDetail>[2]) => {
    const d = await repo.findDetail(orgId, id, tx)
    return d ? toInventoryTransferDto(d) : null
  }

  return {
    async create(
      actorId: string,
      orgId: string,
      input: CreateInventoryTransferInput
    ): Promise<Result<InventoryTransferDto, Code>> {
      if (!(await can(actorId, P.CREATE, orgId))) return forbidden()

      const outcome = await repo.transaction(async (tx): Promise<Step<InventoryTransferDto>> => {
        const lines = await buildLines(
          orgId,
          input.sourceWarehouseId,
          input.destinationWarehouseId,
          input.lines,
          tx
        )
        if (!lines.ok) return lines

        const number = await repo.nextDocumentNumber(orgId, tx)
        const inserted = await repo.insertAggregate(
          orgId,
          {
            number,
            referenceNumber: input.referenceNumber ?? null,
            date: input.date,
            sourceWarehouseId: input.sourceWarehouseId,
            destinationWarehouseId: input.destinationWarehouseId,
            description: input.description ?? null,
            status: "DRAFT",
            createdBy: actorId,
          },
          lines.value,
          tx
        )
        if (!inserted.ok) return { ok: false, error: Err.INVENTORY_TRANSFER_NUMBER_TAKEN }
        const dto = await detailDto(orgId, inserted.row.id, tx)
        return dto ? { ok: true, value: dto } : { ok: false, error: Err.INVENTORY_TRANSFER_NOT_FOUND }
      })

      if (!outcome.ok) return fail({ error: outcome.error, msg: message(outcome.error) })
      await audit(orgId, actorId, AUDIT.CREATED, outcome.value.id)
      return ok({ data: outcome.value, msg: "Inventory transfer created successfully" })
    },

    async update(
      actorId: string,
      orgId: string,
      id: string,
      input: UpdateInventoryTransferInput
    ): Promise<Result<InventoryTransferDto, Code>> {
      if (!(await can(actorId, P.UPDATE, orgId, id))) return forbidden()

      const outcome = await repo.transaction(async (tx): Promise<Step<InventoryTransferDto>> => {
        const current = await repo.findAggregate(orgId, id, tx, { forUpdate: true })
        if (!current) return { ok: false, error: Err.INVENTORY_TRANSFER_NOT_FOUND }
        if (current.row.status !== "DRAFT") return { ok: false, error: Err.INVENTORY_TRANSFER_NOT_EDITABLE }

        const sourceWarehouseId = input.sourceWarehouseId ?? current.row.sourceWarehouseId
        const destinationWarehouseId = input.destinationWarehouseId ?? current.row.destinationWarehouseId
        const warehousesChanged =
          sourceWarehouseId !== current.row.sourceWarehouseId ||
          destinationWarehouseId !== current.row.destinationWarehouseId

        // Changing a warehouse without resending lines would leave lines in the wrong warehouse.
        const lineInput =
          input.lines ??
          (warehousesChanged
            ? current.lines.map((l) => ({
                itemId: l.itemId,
                sourceLocationId: l.sourceLocationId,
                destinationLocationId: l.destinationLocationId,
                unitId: l.unitId,
                quantity: l.requestedQty,
                notes: l.notes,
              }))
            : undefined)

        if (lineInput) {
          const lines = await buildLines(orgId, sourceWarehouseId, destinationWarehouseId, lineInput, tx)
          if (!lines.ok) return lines
          await repo.replaceLines(orgId, id, lines.value, tx)
        }

        const patch: Record<string, unknown> = {}
        if (input.referenceNumber !== undefined) patch.referenceNumber = input.referenceNumber
        if (input.date !== undefined) patch.date = input.date
        if (input.sourceWarehouseId !== undefined) patch.sourceWarehouseId = input.sourceWarehouseId
        if (input.destinationWarehouseId !== undefined) patch.destinationWarehouseId = input.destinationWarehouseId
        if (input.description !== undefined) patch.description = input.description
        const updated = await repo.updateAggregate(orgId, id, patch, tx)
        if (!updated) return { ok: false, error: Err.INVENTORY_TRANSFER_NOT_FOUND }
        const dto = await detailDto(orgId, id, tx)
        return dto ? { ok: true, value: dto } : { ok: false, error: Err.INVENTORY_TRANSFER_NOT_FOUND }
      })

      if (!outcome.ok) return fail({ error: outcome.error, msg: message(outcome.error) })
      await audit(orgId, actorId, AUDIT.UPDATED, id)
      return ok({ data: outcome.value, msg: "Inventory transfer updated successfully" })
    },

    async delete(actorId: string, orgId: string, id: string): Promise<Result<{ id: string }, Code>> {
      if (!(await can(actorId, P.DELETE, orgId, id))) return forbidden()

      const outcome = await repo.transaction(async (tx): Promise<Step<{ id: string }>> => {
        const current = await repo.findAggregate(orgId, id, tx, { forUpdate: true })
        if (!current) return { ok: false, error: Err.INVENTORY_TRANSFER_NOT_FOUND }
        if (current.row.status !== "DRAFT") return { ok: false, error: Err.INVENTORY_TRANSFER_NOT_DELETABLE }
        const deleted = await repo.delete(orgId, id, tx)
        if (!deleted.ok) return { ok: false, error: Err.INVENTORY_TRANSFER_NOT_FOUND }
        return { ok: true, value: { id } }
      })

      if (!outcome.ok) return fail({ error: outcome.error, msg: message(outcome.error) })
      await audit(orgId, actorId, AUDIT.DELETED, id)
      return ok({ data: { id }, msg: "Inventory transfer deleted successfully" })
    },

    /** Cancels a draft. Cancelling after dispatch is a return or write-off (later phases). */
    async cancel(actorId: string, orgId: string, id: string): Promise<Result<InventoryTransferDto, Code>> {
      if (!(await can(actorId, P.CANCEL, orgId, id))) return forbidden()

      const outcome = await repo.transaction(async (tx): Promise<Step<InventoryTransferDto>> => {
        const current = await repo.findAggregate(orgId, id, tx, { forUpdate: true })
        if (!current) return { ok: false, error: Err.INVENTORY_TRANSFER_NOT_FOUND }
        if (current.row.status === "CANCELLED") return { ok: false, error: Err.INVENTORY_TRANSFER_ALREADY_CANCELLED }
        if (current.row.status !== "DRAFT") return { ok: false, error: Err.INVENTORY_TRANSFER_NOT_DRAFT }
        await repo.updateAggregate(orgId, id, { status: "CANCELLED" }, tx)
        const dto = await detailDto(orgId, id, tx)
        return dto ? { ok: true, value: dto } : { ok: false, error: Err.INVENTORY_TRANSFER_NOT_FOUND }
      })

      if (!outcome.ok) return fail({ error: outcome.error, msg: message(outcome.error) })
      await audit(orgId, actorId, AUDIT.CANCELLED, id)
      return ok({ data: outcome.value, msg: "Inventory transfer cancelled successfully" })
    },

    async get(actorId: string, orgId: string, id: string): Promise<Result<InventoryTransferDto, Code>> {
      if (!(await can(actorId, P.READ, orgId, id))) return forbidden()
      const dto = await detailDto(orgId, id)
      if (!dto) return fail({ error: Err.INVENTORY_TRANSFER_NOT_FOUND, msg: message(Err.INVENTORY_TRANSFER_NOT_FOUND) })
      return ok({ data: dto, msg: "Inventory transfer retrieved successfully" })
    },

    async list(
      actorId: string,
      orgId: string,
      query: InventoryTransferOffsetListQuery
    ): Promise<Result<InventoryTransferOffsetListResponse, Code>> {
      if (!(await can(actorId, P.READ, orgId))) return forbidden()
      const { rows, total } = await repo.list(orgId, {
        page: query.page,
        pageSize: query.pageSize,
        search: query.search || undefined,
        sourceWarehouseId: query.sourceWarehouseId,
        destinationWarehouseId: query.destinationWarehouseId,
        status: query.status,
        fromDate: query.fromDate,
        toDate: query.toDate,
      })
      return ok({
        data: { items: rows.map(toInventoryTransferListItemDto), page: query.page, pageSize: query.pageSize, total },
        msg: "Inventory transfers retrieved successfully",
      })
    },

    async listOptions(
      actorId: string,
      orgId: string,
      query: InventoryTransferOptionsQuery
    ): Promise<Result<{ items: InventoryTransferOptionDto[] }, Code>> {
      if (!(await can(actorId, P.READ, orgId))) return forbidden()
      const rows = await repo.listOptions(orgId, { search: query.search, status: query.status, limit: query.limit })
      return ok({
        data: { items: rows as InventoryTransferOptionDto[] },
        msg: "Inventory transfer options retrieved successfully",
      })
    },
  }
}

export type InventoryTransferService = ReturnType<typeof createInventoryTransferService>
