import {
  type ActivityLogAction,
  type PermissionKey,
  RoleErrorCode,
  WAREHOUSE_AUDIT_EVENTS,
  WAREHOUSE_RESERVED_CODES,
  WAREHOUSE_TYPE_PHYSICAL,
  WarehouseErrorCode as E,
  WarehouseOptionCursorSchema,
} from "@avuny/contracts"
import { decodeCursor, fail, ok, toCursorPage, type Result } from "@avuny/utils"
import { toWarehouseDto, toWarehouseListItemDto } from "./warehouse.mapper.js"
import { WAREHOUSE_PERMISSIONS as P } from "./warehouse.permissions.js"
import type {
  Code,
  CreateWarehouseInput,
  DeleteWarehouseResult,
  OptionListResponse,
  UpdateWarehouseInput,
  WarehouseDto,
  WarehouseOffsetListQuery,
  WarehouseOffsetListResponse,
  WarehouseOptionListQuery,
  WarehousePatch,
  WarehouseServiceDeps,
} from "./warehouse.types.js"

/** A transaction callback returns either its value or a typed failure; the service maps it to a Result. */
type Outcome<T> = { ok: true; value: T } | { ok: false; error: Code; msg: string }
const stop = (error: Code, msg: string) => ({ ok: false as const, error, msg })

const isReserved = (code: string) => (WAREHOUSE_RESERVED_CODES as readonly string[]).includes(code)

export function createWarehouseService(deps: WarehouseServiceDeps) {
  const repo = deps.repository
  const permissions = deps.permissions
  const usage = deps.usage

  const can = (actorId: string, action: PermissionKey, orgId: string) =>
    permissions.check({ userId: actorId }, action, { resourceId: orgId, orgId })

  const forbidden = () =>
    fail({
      error: RoleErrorCode.ROLE_PERMISSION_DENIED,
      msg: "You do not have permission to perform this action",
    })

  // Audit rows are written only after the transaction committed.
  const audit = (
    orgId: string,
    actorId: string,
    action: ActivityLogAction,
    resourceId: string,
    metadata?: Record<string, unknown>
  ) => deps.activityLog.record({ orgId, actorId, action, resourceId, metadata })

  const toFailure = (o: { error: Code; msg: string }) => fail({ error: o.error, msg: o.msg })

  return {
    /**
     * Creates a warehouse.
     * Business logic:
     *  - requires create:warehouse.
     *  - TRANSIT (and other reserved codes) belong to system warehouses, so users cannot take them.
     *  - the first physical warehouse of an organization becomes its default automatically;
     *    virtual warehouses are never the default.
     *  - createDefaultLocation also creates one stockable bin (MAIN) in the same transaction, so a
     *    simple business can post stock without designing a location tree.
     *  - code is unique per organization (case-insensitive) and enforced by a named unique index.
     *  - if two "first" warehouses race for the default flag, the loser retries once as non-default.
     */
    async create(
      actorId: string,
      orgId: string,
      input: CreateWarehouseInput
    ): Promise<Result<WarehouseDto, Code>> {
      if (!(await can(actorId, P.CREATE, orgId))) return forbidden()
      if (isReserved(input.code)) {
        return fail({ error: E.WAREHOUSE_CODE_RESERVED, msg: "This code is reserved" })
      }

      let outcome: Outcome<WarehouseDto> | null = null
      for (let attempt = 0; attempt < 2 && !outcome; attempt++) {
        const forceNonDefault = attempt > 0
        const result = await repo.transaction(async (tx): Promise<Outcome<WarehouseDto> | "retry"> => {
          const existingDefault = await repo.findDefault(orgId, tx)
          const isDefault =
            !forceNonDefault && input.type === WAREHOUSE_TYPE_PHYSICAL && !existingDefault
          const inserted = await repo.insert(
            orgId,
            {
              code: input.code,
              name: input.name,
              description: input.description ?? null,
              type: input.type,
              isDefault,
              addressLine: input.addressLine ?? null,
              city: input.city ?? null,
              region: input.region ?? null,
              postalCode: input.postalCode ?? null,
              countryCode: input.countryCode ?? null,
            },
            tx
          )
          if (!inserted.ok) {
            if (inserted.reason === "default_taken") return "retry"
            return stop(E.WAREHOUSE_CODE_TAKEN, "A warehouse with this code already exists")
          }
          if (input.createDefaultLocation) await repo.insertDefaultLocation(orgId, inserted.row, tx)
          return { ok: true, value: toWarehouseDto(inserted.row) }
        })
        if (result !== "retry") outcome = result
      }
      if (!outcome) return fail({ error: E.WAREHOUSE_CODE_TAKEN, msg: "Could not create the warehouse" })
      if (!outcome.ok) return toFailure(outcome)

      await audit(orgId, actorId, WAREHOUSE_AUDIT_EVENTS.CREATED, outcome.value.id, {
        code: outcome.value.code,
        type: outcome.value.type,
        isDefault: outcome.value.isDefault,
        createDefaultLocation: input.createDefaultLocation,
      })
      return ok({ data: outcome.value, msg: "Warehouse created successfully" })
    },

    /**
     * Lists warehouses for the data table.
     * Business logic: requires read:warehouse; offset pagination with total; optional search on
     * name/code and filters by type and active state; always scoped to the organization.
     */
    async list(
      actorId: string,
      orgId: string,
      query: WarehouseOffsetListQuery
    ): Promise<Result<WarehouseOffsetListResponse, Code>> {
      if (!(await can(actorId, P.READ, orgId))) return forbidden()
      const { rows, total } = await repo.list(orgId, {
        type: query.type,
        isActive: query.isActive,
        search: query.search || undefined,
        page: query.page,
        pageSize: query.pageSize,
      })
      return ok({
        data: { items: rows.map(toWarehouseListItemDto), page: query.page, pageSize: query.pageSize, total },
        msg: "Warehouses retrieved successfully",
      })
    },

    /**
     * Options for the warehouse select combobox.
     * Business logic: requires read:warehouse; only ACTIVE warehouses are offered; system
     * warehouses (transit) are hidden unless includeSystem is set; keyset pagination by
     * (label, id) so scrolling stays stable while warehouses change.
     */
    async listOptions(
      actorId: string,
      orgId: string,
      query: WarehouseOptionListQuery
    ): Promise<Result<OptionListResponse, Code>> {
      if (!(await can(actorId, P.READ, orgId))) return forbidden()
      const rows = await repo.listOptions(orgId, {
        search: query.search,
        type: query.type,
        includeSystem: query.includeSystem ?? false,
        after: decodeCursor(query.cursor, WarehouseOptionCursorSchema),
        limit: query.limit + 1,
      })
      const page = toCursorPage(rows, query.limit, (row) => ({ name: row.name, id: row.id }))
      return ok({
        data: { items: page.items.map(({ id, name }) => ({ id, name })), nextCursor: page.nextCursor },
        msg: "Warehouse options retrieved successfully",
      })
    },

    /**
     * Reads one warehouse.
     * Business logic: requires read:warehouse; a warehouse of another organization behaves as not found.
     */
    async get(actorId: string, orgId: string, id: string): Promise<Result<WarehouseDto, Code>> {
      if (!(await can(actorId, P.READ, orgId))) return forbidden()
      const row = await repo.find(orgId, id)
      if (!row) return fail({ error: E.WAREHOUSE_NOT_FOUND, msg: "Warehouse not found" })
      return ok({ data: toWarehouseDto(row), msg: "Warehouse retrieved successfully" })
    },

    /**
     * Updates name, description, code and address.
     * Business logic:
     *  - requires update:warehouse; system warehouses cannot be edited by users.
     *  - the type (physical/virtual) is immutable, so it is not part of the input.
     *  - a reserved code cannot be taken; virtual warehouses cannot gain an address.
     *  - the row is locked while it is read and written so concurrent edits serialize.
     */
    async update(
      actorId: string,
      orgId: string,
      id: string,
      input: UpdateWarehouseInput
    ): Promise<Result<WarehouseDto, Code>> {
      if (!(await can(actorId, P.UPDATE, orgId))) return forbidden()
      if (input.code !== undefined && isReserved(input.code)) {
        return fail({ error: E.WAREHOUSE_CODE_RESERVED, msg: "This code is reserved" })
      }

      const outcome = await repo.transaction(async (tx): Promise<Outcome<WarehouseDto>> => {
        const current = await repo.find(orgId, id, tx, { forUpdate: true })
        if (!current) return stop(E.WAREHOUSE_NOT_FOUND, "Warehouse not found")
        if (current.isSystem) return stop(E.WAREHOUSE_SYSTEM_PROTECTED, "System warehouses cannot be changed")

        const touchesAddress = [input.addressLine, input.city, input.region, input.postalCode, input.countryCode]
          .some((v) => v !== undefined && v !== null)
        if (current.type === "virtual" && touchesAddress) {
          return stop(E.WAREHOUSE_ADDRESS_NOT_ALLOWED, "Virtual warehouses cannot have an address")
        }

        const patch: WarehousePatch = {}
        for (const key of ["code", "name", "description", "addressLine", "city", "region", "postalCode", "countryCode"] as const) {
          if (input[key] !== undefined) patch[key] = input[key] as never
        }
        const updated = await repo.update(orgId, id, patch, tx)
        if (!updated.ok) return stop(E.WAREHOUSE_CODE_TAKEN, "A warehouse with this code already exists")
        return { ok: true, value: toWarehouseDto(updated.row) }
      })
      if (!outcome.ok) return toFailure(outcome)

      await audit(orgId, actorId, WAREHOUSE_AUDIT_EVENTS.UPDATED, id, {
        changedFields: Object.keys(input).filter((k) => input[k as keyof UpdateWarehouseInput] !== undefined),
      })
      return ok({ data: outcome.value, msg: "Warehouse updated successfully" })
    },

    /**
     * Deactivates (retires) a warehouse.
     * Business logic:
     *  - requires deactivate:warehouse; system warehouses and the organization default are protected
     *    (pick another default first); an already inactive warehouse is a conflict.
     *  - it must hold no stock and have no open documents: other modules answer through the usage
     *    registry, so "empty" is decided by whoever owns the stock.
     *  - locations are left untouched; they become unusable because their warehouse is inactive,
     *    and history stays readable.
     */
    async deactivate(actorId: string, orgId: string, id: string): Promise<Result<WarehouseDto, Code>> {
      if (!(await can(actorId, P.DEACTIVATE, orgId))) return forbidden()

      const outcome = await repo.transaction(async (tx): Promise<Outcome<WarehouseDto>> => {
        const current = await repo.find(orgId, id, tx, { forUpdate: true })
        if (!current) return stop(E.WAREHOUSE_NOT_FOUND, "Warehouse not found")
        if (current.isSystem) return stop(E.WAREHOUSE_SYSTEM_PROTECTED, "System warehouses cannot be changed")
        if (!current.isActive) return stop(E.WAREHOUSE_ALREADY_INACTIVE, "The warehouse is already inactive")
        if (current.isDefault) {
          return stop(E.WAREHOUSE_DEFAULT_PROTECTED, "Choose another default warehouse first")
        }
        const u = await usage.warehouseUsage(orgId, id, tx)
        if (u.hasStock) return stop(E.WAREHOUSE_NOT_EMPTY, "The warehouse still holds stock")
        if (u.hasOpenDocuments) return stop(E.WAREHOUSE_IN_USE, "Open documents reference this warehouse")

        const updated = await repo.update(orgId, id, { isActive: false }, tx)
        if (!updated.ok) return stop(E.WAREHOUSE_IN_USE, "Could not deactivate the warehouse")
        return { ok: true, value: toWarehouseDto(updated.row) }
      })
      if (!outcome.ok) return toFailure(outcome)

      await audit(orgId, actorId, WAREHOUSE_AUDIT_EVENTS.DEACTIVATED, id)
      return ok({ data: outcome.value, msg: "Warehouse deactivated successfully" })
    },

    /**
     * Reactivates a retired warehouse.
     * Business logic: authorized by deactivate:warehouse (reactivate is a logged-only action in the
     * registry); system warehouses are protected; reactivating an active warehouse is a conflict.
     * It does not become the default again; that is an explicit choice.
     */
    async reactivate(actorId: string, orgId: string, id: string): Promise<Result<WarehouseDto, Code>> {
      if (!(await can(actorId, P.DEACTIVATE, orgId))) return forbidden()

      const outcome = await repo.transaction(async (tx): Promise<Outcome<WarehouseDto>> => {
        const current = await repo.find(orgId, id, tx, { forUpdate: true })
        if (!current) return stop(E.WAREHOUSE_NOT_FOUND, "Warehouse not found")
        if (current.isSystem) return stop(E.WAREHOUSE_SYSTEM_PROTECTED, "System warehouses cannot be changed")
        if (current.isActive) return stop(E.WAREHOUSE_ALREADY_ACTIVE, "The warehouse is already active")
        const updated = await repo.update(orgId, id, { isActive: true }, tx)
        if (!updated.ok) return stop(E.WAREHOUSE_ALREADY_ACTIVE, "Could not reactivate the warehouse")
        return { ok: true, value: toWarehouseDto(updated.row) }
      })
      if (!outcome.ok) return toFailure(outcome)

      await audit(orgId, actorId, WAREHOUSE_AUDIT_EVENTS.REACTIVATED, id)
      return ok({ data: outcome.value, msg: "Warehouse reactivated successfully" })
    },

    /**
     * Makes a warehouse the organization default (the default receiving warehouse).
     * Business logic:
     *  - requires update:warehouse (default_changed is a logged-only action in the registry).
     *  - only an active, physical, non-system warehouse is eligible.
     *  - already the default: nothing changes and nothing is logged.
     *  - the old default is cleared first, then the new one set, in one transaction, because a
     *    partial unique index allows only one default per organization.
     */
    async setDefault(actorId: string, orgId: string, id: string): Promise<Result<WarehouseDto, Code>> {
      if (!(await can(actorId, P.UPDATE, orgId))) return forbidden()

      const outcome = await repo.transaction(
        async (tx): Promise<Outcome<{ dto: WarehouseDto; previousId: string | null; changed: boolean }>> => {
          const current = await repo.find(orgId, id, tx, { forUpdate: true })
          if (!current) return stop(E.WAREHOUSE_NOT_FOUND, "Warehouse not found")
          if (!current.isActive || current.isSystem || current.type !== WAREHOUSE_TYPE_PHYSICAL) {
            return stop(E.WAREHOUSE_DEFAULT_NOT_ELIGIBLE, "Only an active physical warehouse can be the default")
          }
          if (current.isDefault) {
            return { ok: true, value: { dto: toWarehouseDto(current), previousId: id, changed: false } }
          }
          const previous = await repo.findDefault(orgId, tx)
          await repo.clearDefault(orgId, tx)
          const updated = await repo.update(orgId, id, { isDefault: true }, tx)
          if (!updated.ok) return stop(E.WAREHOUSE_DEFAULT_NOT_ELIGIBLE, "Could not change the default warehouse")
          return {
            ok: true,
            value: { dto: toWarehouseDto(updated.row), previousId: previous?.id ?? null, changed: true },
          }
        }
      )
      if (!outcome.ok) return toFailure(outcome)

      if (outcome.value.changed) {
        await audit(orgId, actorId, WAREHOUSE_AUDIT_EVENTS.DEFAULT_CHANGED, id, {
          previousDefaultId: outcome.value.previousId,
        })
      }
      return ok({ data: outcome.value.dto, msg: "Default warehouse changed successfully" })
    },

    /**
     * Hard-deletes a warehouse that was never used.
     * Business logic:
     *  - requires delete:warehouse; system warehouses and the default are protected.
     *  - never used means: no locations at all (even inactive ones) and nothing in other modules
     *    references it (usage registry: history, documents, per-warehouse item settings).
     *  - a database foreign key (restrict) is the last line of defence and also maps to "in use".
     *  - anything that was used is deactivated instead, so history stays intact.
     */
    async delete(actorId: string, orgId: string, id: string): Promise<Result<DeleteWarehouseResult, Code>> {
      if (!(await can(actorId, P.DELETE, orgId))) return forbidden()

      const outcome = await repo.transaction(async (tx): Promise<Outcome<{ code: string }>> => {
        const current = await repo.find(orgId, id, tx, { forUpdate: true })
        if (!current) return stop(E.WAREHOUSE_NOT_FOUND, "Warehouse not found")
        if (current.isSystem) return stop(E.WAREHOUSE_SYSTEM_PROTECTED, "System warehouses cannot be changed")
        if (current.isDefault) {
          return stop(E.WAREHOUSE_DEFAULT_PROTECTED, "Choose another default warehouse first")
        }
        if (await repo.hasLocations(orgId, id, tx)) {
          return stop(E.WAREHOUSE_IN_USE, "The warehouse has locations; deactivate it instead")
        }
        const u = await usage.warehouseUsage(orgId, id, tx)
        if (u.isReferenced || u.hasStock || u.hasOpenDocuments) {
          return stop(E.WAREHOUSE_IN_USE, "The warehouse is used by other records; deactivate it instead")
        }
        const deleted = await repo.delete(orgId, id, tx)
        if (!deleted.ok) return stop(E.WAREHOUSE_IN_USE, "The warehouse is used by other records")
        return { ok: true, value: { code: current.code } }
      })
      if (!outcome.ok) return toFailure(outcome)

      await audit(orgId, actorId, WAREHOUSE_AUDIT_EVENTS.DELETED, id, { code: outcome.value.code })
      return ok({ data: { id }, msg: "Warehouse deleted successfully" })
    },
  }
}
