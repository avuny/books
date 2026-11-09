import {
  UNIT_AUDIT_EVENTS,
  unitCollectionOptionCursorSchema,
  unitOptionCursorSchema,
  type CreateUnitCollectionInput,
  type OptionListQuery,
  type OptionListResponse,
  type UnitCollectionDto,
  type UnitCollectionOffsetListQuery,
  type UnitCollectionOffsetListResponse,
  type UnitOffsetListQuery,
  type UnitOffsetListResponse,
  type UnitOptionListQuery,
  type UpdateUnitCollectionInput,
} from "@avuny/contracts"
import type { Tx, UnitCollection } from "@avuny/db"
import { decodeCursor, fail, ok, toCursorPage, type Result } from "@avuny/utils"
import { createFailureKit } from "../shared/service-helpers.js"
import { UnitErrorCode, type UnitErrorCode as Code } from "./unit.errors.js"
import { toCollectionDto, toCollectionListItemDto, toUnitDto } from "./unit.mapper.js"
import { unitRules } from "./unit.rules.js"
import { DummyUnitActivityLog, DummyUnitPlanFeatures } from "./testing.js"
import type { UnitServiceDeps } from "./unit.types.js"

export { DummyUnitActivityLog, DummyUnitPlanFeatures }

const Err = UnitErrorCode
const { failure, fromViolation, isFailure, toFail, failWith } = createFailureKit<Code>()

const MSG = {
  collectionNotFound: "Unit collection not found",
  featureUnavailable: "Extra units are not available on your plan",
} as const

/**
 * The service ORCHESTRATES: it loads data, asks `rules` (pure, in unit.rules.ts) whether
 * the change is allowed, then performs the writes in one transaction and logs the audit
 * event. Authorization is enforced at the route with requirePermission(...).
 */
export function createUnitService(deps: UnitServiceDeps) {
  const repo = deps.repository
  const features = deps.features ?? new DummyUnitPlanFeatures()
  const activityLog = deps.activityLog ?? new DummyUnitActivityLog()
  const rules = deps.rules ?? unitRules

  const loadCollection = async (
    orgId: string,
    collection: UnitCollection,
    tx?: Tx
  ): Promise<UnitCollectionDto> => {
    const records = await repo.listCollectionUnits(collection.id, tx)
    const itemCount = await repo.countItems(orgId, collection.id, tx)
    return toCollectionDto(collection, records, itemCount)
  }

  return {
    async listUnits(query: UnitOffsetListQuery): Promise<Result<UnitOffsetListResponse, Code>> {
      const { rows, total } = await repo.listUnits({
        type: query.type,
        search: query.search || undefined,
        page: query.page,
        pageSize: query.pageSize,
      })
      return ok({
        data: { items: rows.map(toUnitDto), page: query.page, pageSize: query.pageSize, total },
        msg: "Units retrieved successfully",
      })
    },

    async listCollections(
      orgId: string,
      query: UnitCollectionOffsetListQuery
    ): Promise<Result<UnitCollectionOffsetListResponse, Code>> {
      const { rows, total } = await repo.listCollections(orgId, {
        search: query.search || undefined,
        page: query.page,
        pageSize: query.pageSize,
      })
      return ok({
        data: {
          items: rows.map(toCollectionListItemDto),
          page: query.page,
          pageSize: query.pageSize,
          total,
        },
        msg: "Unit collections retrieved successfully",
      })
    },

    async listUnitOptions(query: UnitOptionListQuery): Promise<Result<OptionListResponse, Code>> {
      const rows = await repo.listUnitOptions({
        search: query.search,
        sameTypeAs: query.sameTypeAs,
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

    async listCollectionOptions(
      orgId: string,
      query: OptionListQuery
    ): Promise<Result<OptionListResponse, Code>> {
      const rows = await repo.listCollectionOptions(orgId, {
        search: query.search,
        after: decodeCursor(query.cursor, unitCollectionOptionCursorSchema),
        limit: query.limit + 1,
      })
      const page = toCursorPage(rows, query.limit, (row) => ({ name: row.name, id: row.id }))
      return ok({
        data: {
          items: page.items.map(({ id, name }) => ({ id, name })),
          nextCursor: page.nextCursor,
        },
        msg: "Unit collection options retrieved successfully",
      })
    },

    async getCollection(orgId: string, id: string): Promise<Result<UnitCollectionDto, Code>> {
      const collection = await repo.findCollection(orgId, id)
      if (!collection)
        return fail({ error: Err.UNIT_COLLECTION_NOT_FOUND, msg: MSG.collectionNotFound })
      return ok({
        data: await loadCollection(orgId, collection),
        msg: "Unit collection retrieved",
      })
    },

    async createCollection(
      actorId: string,
      orgId: string,
      input: CreateUnitCollectionInput
    ): Promise<Result<UnitCollectionDto, Code>> {
      if (input.units.length > 0 && !(await features.has(orgId, "extraUnits")))
        return fail({ error: Err.UNIT_FEATURE_NOT_AVAILABLE, msg: MSG.featureUnavailable })

      const found = await repo.findUnitsByIds([input.baseUnitId, ...input.units.map((u) => u.unitId)])
      const checked = rules.checkCollectionDraft(input.baseUnitId, input.units, found)
      if (!checked.ok) return failWith(checked.violation)
      const base = checked.value

      const collection = await repo.transaction(async (tx) => {
        const created = await repo.insertCollection(
          { orgId, baseUnitId: base.id, name: rules.collectionName(input.name, base) },
          tx
        )
        await repo.insertCollectionUnits(
          created.id,
          rules.buildCollectionRows(base.id, input.units),
          tx
        )
        return created
      })

      await activityLog.log({
        action: UNIT_AUDIT_EVENTS.COLLECTION_CREATED,
        actorId,
        orgId,
        resourceId: collection.id,
        metadata: { name: collection.name, units: input.units.length + 1 },
      })
      return ok({
        data: await loadCollection(orgId, collection),
        msg: "Unit collection created",
      })
    },

    /** `units`, when given, REPLACES the non-base units; the base unit row is never touched. */
    async updateCollection(
      actorId: string,
      orgId: string,
      id: string,
      input: UpdateUnitCollectionInput
    ): Promise<Result<UnitCollectionDto, Code>> {
      if (input.units && input.units.length > 0 && !(await features.has(orgId, "extraUnits")))
        return fail({ error: Err.UNIT_FEATURE_NOT_AVAILABLE, msg: MSG.featureUnavailable })

      const outcome = await repo.transaction(async (tx) => {
        await repo.lockOrgUnits(orgId, tx)
        const collection = await repo.findCollection(orgId, id, tx)
        if (!collection) return failure(Err.UNIT_COLLECTION_NOT_FOUND, MSG.collectionNotFound)

        // Read and validate everything BEFORE the first write.
        let diff = null as ReturnType<typeof rules.diffCollectionUnits> | null
        if (input.units) {
          const found = await repo.findUnitsByIds(
            [collection.baseUnitId, ...input.units.map((u) => u.unitId)],
            tx
          )
          const checked = rules.checkCollectionDraft(collection.baseUnitId, input.units, found)
          if (!checked.ok) return fromViolation(checked.violation)
          const current = await repo.listCollectionUnits(collection.id, tx)
          diff = rules.diffCollectionUnits(
            current.map((r) => ({ unitId: r.link.unitId, conversionFactor: r.link.conversionFactor })),
            input.units,
            collection.baseUnitId
          )
        }

        if (diff) {
          await repo.deleteCollectionUnits(collection.id, diff.remove, tx)
          for (const row of diff.update)
            await repo.updateCollectionUnitFactor(collection.id, row.unitId, row.conversionFactor, tx)
          await repo.insertCollectionUnits(collection.id, diff.add, tx)
        }

        const nameChanged = input.name !== undefined && input.name !== collection.name
        const unitsChanged = diff !== null && rules.diffHasChanges(diff)
        const saved =
          nameChanged || unitsChanged
            ? ((await repo.touchCollection(
                collection.id,
                nameChanged && input.name !== undefined ? { name: input.name } : {},
                tx
              )) ?? collection)
            : collection

        return { collection: saved, dto: await loadCollection(orgId, saved, tx) }
      })
      if (isFailure(outcome)) return toFail(outcome)

      await activityLog.log({
        action: UNIT_AUDIT_EVENTS.COLLECTION_UPDATED,
        actorId,
        orgId,
        resourceId: id,
        metadata: { name: input.name, unitsReplaced: !!input.units },
      })
      return ok({ data: outcome.dto, msg: "Unit collection updated" })
    },

    async deleteCollection(
      actorId: string,
      orgId: string,
      id: string
    ): Promise<Result<{ id: string }, Code>> {
      const outcome = await repo.transaction(async (tx) => {
        await repo.lockOrgUnits(orgId, tx)
        const collection = await repo.findCollection(orgId, id, tx)
        if (!collection) return failure(Err.UNIT_COLLECTION_NOT_FOUND, MSG.collectionNotFound)

        const bad = rules.checkCollectionDeletable(await repo.countItems(orgId, id, tx))
        if (bad) return fromViolation(bad)

        const res = await repo.deleteCollection(orgId, id, tx)
        if (!res.ok)
          return res.reason === "in_use"
            ? failure(Err.UNIT_COLLECTION_IN_USE, "This unit collection is used by items")
            : failure(Err.UNIT_COLLECTION_NOT_FOUND, MSG.collectionNotFound)
        return { name: collection.name }
      })
      if (isFailure(outcome)) return toFail(outcome)

      await activityLog.log({
        action: UNIT_AUDIT_EVENTS.COLLECTION_DELETED,
        actorId,
        orgId,
        resourceId: id,
        metadata: { name: outcome.name },
      })
      return ok({ data: { id }, msg: "Unit collection deleted" })
    },
  }
}
