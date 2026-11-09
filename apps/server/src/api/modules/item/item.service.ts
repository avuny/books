import {
  ITEM_AUDIT_EVENTS,
  UNIT_BASE_CONVERSION_FACTOR,
  itemOptionCursorSchema,
  type CreateItemInput,
  type ItemDto,
  type ItemOffsetListQuery,
  type ItemOffsetListResponse,
  type OptionListQuery,
  type OptionListResponse,
  type UpdateItemInput,
} from "@avuny/contracts"
import type { Tx } from "@avuny/db"
import { decodeCursor, fail, ok, toCursorPage, type Result } from "@avuny/utils"
import { createFailureKit, type Failure } from "../shared/service-helpers.js"
import { ItemErrorCode, type ItemErrorCode as Code } from "./item.errors.js"
import { toItemDto, toItemListItemDto } from "./item.mapper.js"
import { itemRules, type UnitSource } from "./item.rules.js"
import { DummyItemActivityLog, DummyStockHistory } from "./testing.js"
import type { ItemServiceDeps } from "./item.types.js"

export { DummyItemActivityLog, DummyStockHistory }

const Err = ItemErrorCode
const { failure, fromViolation, isFailure, toFail, failWith, abort, abortable } =
  createFailureKit<Code>()

const MSG = {
  notFound: "Item not found",
  nameTaken: "An item with this name already exists",
  unitRequired: "Provide a base unit or a unit collection",
  collectionInvalid: "The selected unit collection does not exist",
} as const

type ResolvedUnit = { baseUnitId: string; unitCollectionId: string }

/**
 * The service ORCHESTRATES: it takes the organization lock, loads rows through the
 * repositories, asks the pure `rules` (item.rules.ts) what is allowed, then writes.
 * Authorization is enforced at the route with requirePermission(...).
 *
 * Transaction discipline: a `failure(...)` returned from a transaction body COMMITS what
 * was already written, so every check runs before the first write. A failure that can
 * only be found after a write uses `abort(...)`, which rolls the transaction back.
 */
export function createItemService(deps: ItemServiceDeps) {
  const repo = deps.repository
  const unitRepo = deps.unitRepository
  const categoryRepo = deps.categoryRepository
  const stock = deps.stockHistory ?? new DummyStockHistory()
  const activityLog = deps.activityLog ?? new DummyItemActivityLog()
  const rules = deps.rules ?? itemRules

  /** Turns "which unit" into a (base unit, collection) pair, creating the collection if needed. */
  async function resolveUnit(
    orgId: string,
    source: UnitSource,
    tx: Tx
  ): Promise<Failure<Code> | ResolvedUnit> {
    if (source.kind === "collection") {
      const collection = await unitRepo.findCollection(orgId, source.collectionId, tx)
      if (!collection) return failure(Err.ITEM_UNIT_COLLECTION_INVALID, MSG.collectionInvalid)
      return { baseUnitId: collection.baseUnitId, unitCollectionId: collection.id }
    }

    const [found] = await unitRepo.findUnitsByIds([source.baseUnitId], tx)
    const checked = rules.requireBaseUnit(found)
    if (!checked.ok) return fromViolation(checked.violation)

    // The collection of a single-unit item is created together with it (see the unit schema docs).
    const collection = await unitRepo.insertCollection(
      { orgId, baseUnitId: checked.value.id, name: rules.autoCollectionName(checked.value) },
      tx
    )
    await unitRepo.insertCollectionUnits(
      collection.id,
      [{ unitId: checked.value.id, conversionFactor: UNIT_BASE_CONVERSION_FACTOR }],
      tx
    )
    return { baseUnitId: checked.value.id, unitCollectionId: collection.id }
  }

  const loadDetail = async (orgId: string, id: string) => {
    const row = await repo.findDetail(orgId, id)
    return row ? toItemDto(row) : null
  }

  return {
    async list(orgId: string, query: ItemOffsetListQuery): Promise<Result<ItemOffsetListResponse, Code>> {
      const { rows, total } = await repo.list(orgId, {
        search: query.search || undefined,
        categoryId: query.categoryId,
        includeSubcategories: query.includeSubcategories,
        isActive: query.isActive,
        page: query.page,
        pageSize: query.pageSize,
      })
      return ok({
        data: {
          items: rows.map(toItemListItemDto),
          page: query.page,
          pageSize: query.pageSize,
          total,
        },
        msg: "Items retrieved successfully",
      })
    },

    async listOptions(
      orgId: string,
      query: OptionListQuery
    ): Promise<Result<OptionListResponse, Code>> {
      const rows = await repo.listOptions(orgId, {
        search: query.search,
        after: decodeCursor(query.cursor, itemOptionCursorSchema),
        limit: query.limit + 1,
      })
      const page = toCursorPage(rows, query.limit, (row) => ({ name: row.name, id: row.id }))
      return ok({
        data: {
          items: page.items.map((r) => ({ id: r.id, name: r.name })),
          nextCursor: page.nextCursor,
        },
        msg: "Item options retrieved successfully",
      })
    },

    async getById(orgId: string, id: string): Promise<Result<ItemDto, Code>> {
      const dto = await loadDetail(orgId, id)
      if (!dto) return fail({ error: Err.ITEM_NOT_FOUND, msg: MSG.notFound })
      return ok({ data: dto, msg: "Item retrieved" })
    },

    async create(actorId: string, orgId: string, input: CreateItemInput): Promise<Result<ItemDto, Code>> {
      const trackingViolation = rules.checkTracking(input)
      if (trackingViolation) return failWith(trackingViolation)
      const source = rules.selectUnitSource(input)
      if (!source) return fail({ error: Err.ITEM_UNIT_INVALID, msg: MSG.unitRequired })

      const outcome = await abortable(() =>
        repo.transaction(async (tx) => {
          await repo.lockOrgItems(orgId, tx)

          // checks first (reads only) ...
          const category = rules.requireCategory(await categoryRepo.findById(orgId, input.categoryId, tx))
          if (!category.ok) return fromViolation(category.violation)
          if (await repo.nameTaken(orgId, input.name, undefined, tx))
            return failure(Err.ITEM_NAME_TAKEN, MSG.nameTaken)
          const unit = await resolveUnit(orgId, source, tx)
          if (isFailure(unit)) return unit

          // ... then writes
          const res = await repo.insertItem(
            {
              orgId,
              name: input.name,
              description: input.description ?? null,
              categoryId: input.categoryId,
              baseUnitId: unit.baseUnitId,
              unitCollectionId: unit.unitCollectionId,
              canAssembled: input.canAssembled,
              isReturnable: input.isReturnable,
              isInventoryTracked: input.isInventoryTracked,
              isBatchTracked: input.isBatchTracked,
              inventoryValuationMethod: input.inventoryValuationMethod,
            },
            tx
          )
          if (!res.ok) return abort(failure(Err.ITEM_NAME_TAKEN, MSG.nameTaken))
          await repo.upsertSettings(
            orgId,
            res.row.id,
            { allowNegativeStock: input.allowNegativeStock, reorderPoint: input.reorderPoint ?? null },
            tx
          )
          return { id: res.row.id, name: res.row.name }
        })
      )
      if (isFailure(outcome)) return toFail(outcome)

      const dto = await loadDetail(orgId, outcome.id)
      if (!dto) return fail({ error: Err.ITEM_NOT_FOUND, msg: MSG.notFound })
      await activityLog.log({
        action: ITEM_AUDIT_EVENTS.CREATED,
        actorId,
        orgId,
        resourceId: outcome.id,
        metadata: { name: outcome.name, categoryId: input.categoryId },
      })
      return ok({ data: dto, msg: "Item created" })
    },

    async update(
      actorId: string,
      orgId: string,
      itemId: string,
      input: UpdateItemInput
    ): Promise<Result<ItemDto, Code>> {
      const outcome = await abortable(() =>
        repo.transaction(async (tx) => {
          await repo.lockOrgItems(orgId, tx)
          const current = await repo.findById(orgId, itemId, tx)
          if (!current) return failure(Err.ITEM_NOT_FOUND, MSG.notFound)

          // checks first (reads only) ...
          if (input.categoryId !== undefined && input.categoryId !== current.categoryId) {
            const category = rules.requireCategory(await categoryRepo.findById(orgId, input.categoryId, tx))
            if (!category.ok) return fromViolation(category.violation)
          }
          if (
            input.name !== undefined &&
            input.name !== current.name &&
            (await repo.nameTaken(orgId, input.name, itemId, tx))
          )
            return failure(Err.ITEM_NAME_TAKEN, MSG.nameTaken)

          const trackingViolation = rules.checkTracking(rules.effectiveTracking(current, input))
          if (trackingViolation) return fromViolation(trackingViolation)

          const unitChange = rules.pickUnitChange(current, input)
          const changed = rules.changedLockedFields(current, input, unitChange !== null)
          if (changed.length > 0) {
            const lock = rules.checkLock(changed, await stock.hasMovements(orgId, itemId))
            if (lock) return fromViolation(lock)
          }

          let unit: ResolvedUnit | null = null
          if (unitChange) {
            const resolved = await resolveUnit(orgId, unitChange, tx)
            if (isFailure(resolved)) return resolved
            unit = resolved
          }

          // ... then writes
          const res = await repo.updateItem(
            orgId,
            itemId,
            {
              ...(input.name !== undefined && { name: input.name }),
              ...(input.description !== undefined && { description: input.description }),
              ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
              ...(unit && { baseUnitId: unit.baseUnitId, unitCollectionId: unit.unitCollectionId }),
              ...(input.canAssembled !== undefined && { canAssembled: input.canAssembled }),
              ...(input.isReturnable !== undefined && { isReturnable: input.isReturnable }),
              ...(input.isInventoryTracked !== undefined && {
                isInventoryTracked: input.isInventoryTracked,
              }),
              ...(input.isBatchTracked !== undefined && { isBatchTracked: input.isBatchTracked }),
              ...(input.inventoryValuationMethod !== undefined && {
                inventoryValuationMethod: input.inventoryValuationMethod,
              }),
              ...(input.isActive !== undefined && { isActive: input.isActive }),
            },
            tx
          )
          if (!res.ok)
            return abort(
              res.reason === "name_taken"
                ? failure(Err.ITEM_NAME_TAKEN, MSG.nameTaken)
                : failure(Err.ITEM_NOT_FOUND, MSG.notFound)
            )

          if (input.allowNegativeStock !== undefined || input.reorderPoint !== undefined)
            await repo.upsertSettings(
              orgId,
              itemId,
              {
                ...(input.allowNegativeStock !== undefined && {
                  allowNegativeStock: input.allowNegativeStock,
                }),
                ...(input.reorderPoint !== undefined && { reorderPoint: input.reorderPoint }),
              },
              tx
            )
          return { id: itemId }
        })
      )
      if (isFailure(outcome)) return toFail(outcome)

      const dto = await loadDetail(orgId, itemId)
      if (!dto) return fail({ error: Err.ITEM_NOT_FOUND, msg: MSG.notFound })
      await activityLog.log({
        action: ITEM_AUDIT_EVENTS.UPDATED,
        actorId,
        orgId,
        resourceId: itemId,
        metadata: { name: input.name, isActive: input.isActive },
      })
      return ok({ data: dto, msg: "Item updated" })
    },

    async remove(actorId: string, orgId: string, itemId: string): Promise<Result<{ id: string }, Code>> {
      const outcome = await repo.transaction(async (tx) => {
        await repo.lockOrgItems(orgId, tx)
        const item = await repo.findById(orgId, itemId, tx)
        if (!item) return failure(Err.ITEM_NOT_FOUND, MSG.notFound)

        const bad = rules.checkDeletable(await stock.hasMovements(orgId, itemId))
        if (bad) return fromViolation(bad)

        const res = await repo.deleteItem(orgId, itemId, tx)
        if (!res.ok)
          return res.reason === "has_history"
            ? failure(Err.ITEM_HAS_HISTORY, "This item has stock history")
            : failure(Err.ITEM_NOT_FOUND, MSG.notFound)
        return { name: item.name }
      })
      if (isFailure(outcome)) return toFail(outcome)

      await activityLog.log({
        action: ITEM_AUDIT_EVENTS.DELETED,
        actorId,
        orgId,
        resourceId: itemId,
        metadata: { name: outcome.name },
      })
      return ok({ data: { id: itemId }, msg: "Item deleted" })
    },
  }
}
