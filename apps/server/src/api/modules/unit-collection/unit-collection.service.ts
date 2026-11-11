import {
  UNIT_COLLECTION_AUDIT_EVENTS,
  unitCollectionOptionCursorSchema,
  type CreateUnitCollectionInput,
  type OptionListQuery,
  type OptionListResponse,
  type UnitCollectionDto,
  type UnitCollectionOffsetListQuery,
  type UnitCollectionOffsetListResponse,
  type UpdateUnitCollectionInput,
} from "@avuny/contracts"
import type { Tx, UnitCollection } from "@avuny/db"
import { decodeCursor, fail, ok, toCursorPage, type Result } from "@avuny/utils"
import { createFailureKit } from "../shared/service-helpers.js"
import { UnitCollectionErrorCode, type UnitCollectionErrorCode as Code } from "./unit-collection.errors.js"
import { toCollectionDto, toCollectionListItemDto } from "./unit-collection.mapper.js"
import { unitCollectionRules } from "./unit-collection.rules.js"
import { DummyUnitCollectionActivityLog, DummyUnitCollectionPlanFeatures } from "./testing.js"
import type { UnitCollectionServiceDeps } from "./unit-collection.types.js"

export { DummyUnitCollectionActivityLog, DummyUnitCollectionPlanFeatures }

const Err = UnitCollectionErrorCode
const { failWith } = createFailureKit<Code>()

const MSG = {
  collectionNotFound: "Unit collection not found",
  featureUnavailable: "Extra units are not available on your plan",
} as const

export function createUnitCollectionService(deps: UnitCollectionServiceDeps) {
  const repo = deps.repository
  const features = deps.features ?? new DummyUnitCollectionPlanFeatures()
  const activityLog = deps.activityLog ?? new DummyUnitCollectionActivityLog()
  const rules = deps.rules ?? unitCollectionRules

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
        action: UNIT_COLLECTION_AUDIT_EVENTS.COLLECTION_CREATED,
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
      if (input.units !== undefined && input.units.length > 0 && !(await features.has(orgId, "extraUnits")))
        return fail({ error: Err.UNIT_FEATURE_NOT_AVAILABLE, msg: MSG.featureUnavailable })

      return repo.transaction(async (tx) => {
        await repo.lockOrgUnits(orgId, tx)

        const collection = await repo.findCollection(orgId, id, tx)
        if (!collection)
          return fail({ error: Err.UNIT_COLLECTION_NOT_FOUND, msg: MSG.collectionNotFound })

        let diffSummary: { added: number; updated: number; removed: number } | undefined
        if (input.units !== undefined) {
          const allIds = [collection.baseUnitId, ...input.units.map((u) => u.unitId)]
          const found = await repo.findUnitsByIds(allIds, tx)
          const checked = rules.checkCollectionDraft(collection.baseUnitId, input.units, found)
          if (!checked.ok) return failWith(checked.violation)

          const currentRows = (await repo.listCollectionUnits(collection.id, tx)).map((r) => ({
            unitId: r.link.unitId,
            conversionFactor: r.link.conversionFactor,
          }))
          const diff = rules.diffCollectionUnits(currentRows, input.units, collection.baseUnitId)

          if (diff.remove.length) await repo.deleteCollectionUnits(collection.id, diff.remove, tx)
          for (const u of diff.update)
            await repo.updateCollectionUnitFactor(collection.id, u.unitId, u.conversionFactor, tx)
          if (diff.add.length) await repo.insertCollectionUnits(collection.id, diff.add, tx)

          diffSummary = { added: diff.add.length, updated: diff.update.length, removed: diff.remove.length }
        }

        const nameChanged = input.name !== undefined && input.name.trim() !== collection.name
        const touchNeeded = nameChanged || (diffSummary && (diffSummary.added || diffSummary.updated || diffSummary.removed))
        const saved = touchNeeded
          ? (await repo.touchCollection(collection.id, { name: nameChanged ? input.name!.trim() : undefined }, tx))!
          : collection

        await activityLog.log({
          action: UNIT_COLLECTION_AUDIT_EVENTS.COLLECTION_UPDATED,
          actorId,
          orgId,
          resourceId: collection.id,
          metadata: { name: saved.name, ...(diffSummary ?? {}) },
        })

        return ok({
          data: await loadCollection(orgId, saved, tx),
          msg: "Unit collection updated",
        })
      })
    },

    async deleteCollection(
      actorId: string,
      orgId: string,
      id: string
    ): Promise<Result<{ id: string }, Code>> {
      return repo.transaction(async (tx) => {
        await repo.lockOrgUnits(orgId, tx)

        const collection = await repo.findCollection(orgId, id, tx)
        if (!collection)
          return fail({ error: Err.UNIT_COLLECTION_NOT_FOUND, msg: MSG.collectionNotFound })

        const itemCount = await repo.countItems(orgId, id, tx)
        const violation = rules.checkCollectionDeletable(itemCount)
        if (violation) return failWith(violation)

        const deleted = await repo.deleteCollection(orgId, id, tx)
        if (!deleted.ok) {
          if (deleted.reason === "not_found")
            return fail({ error: Err.UNIT_COLLECTION_NOT_FOUND, msg: MSG.collectionNotFound })
          return fail({
            error: Err.UNIT_COLLECTION_IN_USE,
            msg: "This unit collection is used by items and cannot be deleted",
          })
        }

        await activityLog.log({
          action: UNIT_COLLECTION_AUDIT_EVENTS.COLLECTION_DELETED,
          actorId,
          orgId,
          resourceId: id,
          metadata: { name: collection.name },
        })

        return ok({ data: { id }, msg: "Unit collection deleted" })
      })
    },
  }
}

