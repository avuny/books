import {
  UNIT_AUDIT_EVENTS,
  unitOptionCursorSchema,
  type CreateUnitInput,
  type OptionListResponse,
  type PermissionKey,
  type UnitDto,
  type UnitOffsetListQuery,
  type UnitOffsetListResponse,
  type UnitOptionListQuery,
  type UpdateUnitInput,
} from "@avuny/contracts"
import { decodeCursor, fail, ok, toCursorPage, type Result } from "@avuny/utils"
import { createFailureKit } from "../shared/service-helpers.js"
import { UnitErrorCode, type UnitErrorCode as Code } from "./unit.errors.js"
import { toUnitDto } from "./unit.mapper.js"
import { unitRules } from "./unit.rules.js"
import { DummyPermissionChecker, DummyUnitActivityLog } from "./testing.js"
import type { UnitServiceDeps } from "./unit.types.js"

export { DummyPermissionChecker, DummyUnitActivityLog }

const Err = UnitErrorCode
const { failWith } = createFailureKit<Code>()

const MSG = {
  unitNotFound: "Unit not found",
  forbidden: "You do not have access to this unit",
  systemImmutable: "System units cannot be modified or deleted",
} as const

export function createUnitService(deps: UnitServiceDeps) {
  const repo = deps.repository
  const permissions = deps.permissions ?? new DummyPermissionChecker()
  const activityLog = deps.activityLog ?? new DummyUnitActivityLog()
  const rules = deps.rules ?? unitRules

  const can = (
    actorId: string,
    action: PermissionKey | readonly [PermissionKey, ...PermissionKey[]],
    orgId: string
  ) => permissions.check({ userId: actorId }, action, { orgId })

  const forbidden = () => fail({ error: Err.UNIT_FORBIDDEN, msg: MSG.forbidden })

  return {
    async listUnits(
      orgId: string,
      query: UnitOffsetListQuery,
      actorId?: string
    ): Promise<Result<UnitOffsetListResponse, Code>> {
      if (actorId && !(await can(actorId, "read:unit", orgId))) return forbidden()
      const { rows, total } = await repo.listUnits(orgId, {
        type: query.type,
        isActive: query.isActive,
        search: query.search || undefined,
        page: query.page,
        pageSize: query.pageSize,
      })
      return ok({
        data: {
          items: rows.map(toUnitDto),
          page: query.page,
          pageSize: query.pageSize,
          total,
        },
        msg: "Units retrieved successfully",
      })
    },

    async listUnitOptions(
      orgId: string,
      query: UnitOptionListQuery,
      actorId?: string
    ): Promise<Result<OptionListResponse, Code>> {
      if (actorId && !(await can(actorId, "read:unit", orgId))) return forbidden()
      const rows = await repo.listUnitOptions(orgId, {
        search: query.search,
        sameTypeAs: query.sameTypeAs,
        type: query.type,
        after: decodeCursor(query.cursor, unitOptionCursorSchema),
        limit: query.limit + 1,
      })
      const page = toCursorPage(rows, query.limit, (row) => ({ name: row.name, id: row.id }))
      return ok({
        data: {
          items: page.items.map(({ id, name }) => ({ id, name })),
          nextCursor: page.nextCursor,
        },
        msg: "Unit options retrieved successfully",
      })
    },

    async getUnit(
      orgId: string,
      id: string,
      actorId?: string
    ): Promise<Result<UnitDto, Code>> {
      if (actorId && !(await can(actorId, "read:unit", orgId))) return forbidden()
      const unit = await repo.findUnit(orgId, id)
      if (!unit) {
        return fail({ error: Err.UNIT_NOT_FOUND, msg: MSG.unitNotFound })
      }
      return ok({
        data: toUnitDto(unit),
        msg: "Unit retrieved successfully",
      })
    },

    async createUnit(
      actorId: string,
      orgId: string,
      input: CreateUnitInput
    ): Promise<Result<UnitDto, Code>> {
      if (!(await can(actorId, "create:unit", orgId))) return forbidden()
      const existing = await repo.findUnitsInScope(orgId)
      const uniqueness = rules.checkUniqueness(
        { name: input.name, symbol: input.symbol },
        existing
      )
      if (!uniqueness.ok) return failWith(uniqueness.violation)

      const created = await repo.insertUnit({
        orgId,
        name: input.name.trim(),
        symbol: input.symbol.trim(),
        type: input.type,
      })

      await activityLog.log({
        action: UNIT_AUDIT_EVENTS.UNIT_CREATED,
        actorId,
        orgId,
        resourceId: created.id,
        metadata: { name: created.name, symbol: created.symbol, type: created.type },
      })

      return ok({
        data: toUnitDto(created),
        msg: "Unit created successfully",
      })
    },

    async updateUnit(
      actorId: string,
      orgId: string,
      id: string,
      input: UpdateUnitInput
    ): Promise<Result<UnitDto, Code>> {
      const perm: PermissionKey =
        input.isActive === false ? "deactivate:unit" : "update:unit"
      if (!(await can(actorId, [perm, "update:unit"], orgId))) return forbidden()
      const unit = await repo.findUnit(orgId, id)
      if (!unit) {
        return fail({ error: Err.UNIT_NOT_FOUND, msg: MSG.unitNotFound })
      }

      const modifiable = rules.checkCanModifyUnit(unit)
      if (modifiable) return failWith(modifiable)

      if (input.name !== undefined || input.symbol !== undefined) {
        const existing = await repo.findUnitsInScope(orgId)
        const uniqueness = rules.checkUniqueness(
          { name: input.name, symbol: input.symbol },
          existing,
          unit.id
        )
        if (!uniqueness.ok) return failWith(uniqueness.violation)
      }

      const updated = await repo.updateUnit(unit.id, {
        name: input.name?.trim(),
        symbol: input.symbol?.trim(),
        isActive: input.isActive,
      })

      if (!updated) {
        return fail({ error: Err.UNIT_NOT_FOUND, msg: MSG.unitNotFound })
      }

      const action =
        input.isActive === false
          ? UNIT_AUDIT_EVENTS.UNIT_DEACTIVATED
          : UNIT_AUDIT_EVENTS.UNIT_UPDATED

      await activityLog.log({
        action,
        actorId,
        orgId,
        resourceId: updated.id,
        metadata: { name: updated.name, symbol: updated.symbol, isActive: updated.isActive },
      })

      return ok({
        data: toUnitDto(updated),
        msg: "Unit updated successfully",
      })
    },

    async deleteUnit(
      actorId: string,
      orgId: string,
      id: string
    ): Promise<Result<{ id: string }, Code>> {
      if (!(await can(actorId, "delete:unit", orgId))) return forbidden()
      const unit = await repo.findUnit(orgId, id)
      if (!unit) {
        return fail({ error: Err.UNIT_NOT_FOUND, msg: MSG.unitNotFound })
      }

      const inUse = await repo.isUnitInUse(id)
      const deletable = rules.checkCanDeleteUnit(unit, inUse)
      if (deletable) return failWith(deletable)

      await repo.deleteUnit(id)

      await activityLog.log({
        action: UNIT_AUDIT_EVENTS.UNIT_DELETED,
        actorId,
        orgId,
        resourceId: id,
        metadata: { name: unit.name, symbol: unit.symbol },
      })

      return ok({
        data: { id },
        msg: "Unit deleted successfully",
      })
    },
  }
}
