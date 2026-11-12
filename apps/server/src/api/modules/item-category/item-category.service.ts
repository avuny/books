import {
  ITEM_CATEGORY_AUDIT_EVENTS,
  itemCategoryOptionCursorSchema,
  type CreateItemCategoryInput,
  type ItemCategoryDto,
  type ItemCategoryOffsetListQuery,
  type ItemCategoryOffsetListResponse,
  type ItemCategoryTreeResponse,
  type OptionListQuery,
  type OptionListResponse,
  type PermissionKey,
  type UpdateItemCategoryInput,
} from "@avuny/contracts"
import { decodeCursor, fail, ok, toCursorPage, type Result } from "@avuny/utils"
import { createFailureKit } from "../shared/service-helpers.js"
import { ItemCategoryErrorCode, type ItemCategoryErrorCode as Code } from "./item-category.errors.js"
import { toItemCategoryDto, toTreeNode } from "./item-category.mapper.js"
import { itemCategoryRules } from "./item-category.rules.js"
import { DummyItemCategoryActivityLog, DummyPermissionChecker } from "./testing.js"
import type { ItemCategoryServiceDeps } from "./item-category.types.js"

export { DummyItemCategoryActivityLog, DummyPermissionChecker }

const Err = ItemCategoryErrorCode
const { failure, fromViolation, isFailure, toFail } = createFailureKit<Code>()

const MSG = {
  notFound: "Category not found",
  forbidden: "You do not have access to this category",
  parentNotFound: "The parent category does not exist",
  nameTaken: "A category with this name already exists at this level",
} as const

const writeFailure = (reason: "name_taken" | "not_found" | "parent_not_found") =>
  reason === "name_taken"
    ? failure(Err.ITEM_CATEGORY_NAME_TAKEN, MSG.nameTaken)
    : reason === "parent_not_found"
      ? failure(Err.ITEM_CATEGORY_PARENT_NOT_FOUND, MSG.parentNotFound)
      : failure(Err.ITEM_CATEGORY_NOT_FOUND, MSG.notFound)

/**
 * The service ORCHESTRATES: it takes the per-organization lock, loads the tree, asks the
 * pure `rules` (item-category.rules.ts) whether the change is allowed, then writes.
 * Authorization is enforced at the route with requirePermission(...).
 */
export function createItemCategoryService(deps: ItemCategoryServiceDeps) {
  const repo = deps.repository
  const permissions = deps.permissions ?? new DummyPermissionChecker()
  const activityLog = deps.activityLog ?? new DummyItemCategoryActivityLog()
  const rules = deps.rules ?? itemCategoryRules

  const can = (
    actorId: string,
    action: PermissionKey | readonly [PermissionKey, ...PermissionKey[]],
    orgId: string
  ) => permissions.check({ userId: actorId }, action, { orgId })

  const forbidden = () =>
    fail({ error: Err.ITEM_CATEGORY_FORBIDDEN, msg: MSG.forbidden })

  return {
    async list(
      orgId: string,
      query: ItemCategoryOffsetListQuery,
      actorId?: string
    ): Promise<Result<ItemCategoryOffsetListResponse, Code>> {
      if (actorId && !(await can(actorId, ["read:item-category"], orgId))) return forbidden()
      const { rows, total } = await repo.list(orgId, {
        search: query.search || undefined,
        isActive: query.isActive,
        parentId: query.parentId === "root" ? null : query.parentId,
        page: query.page,
        pageSize: query.pageSize,
      })
      return ok({
        data: {
          items: rows.map((r) => toItemCategoryDto(r.category, r)),
          page: query.page,
          pageSize: query.pageSize,
          total,
        },
        msg: "Categories retrieved successfully",
      })
    },

    async listOptions(
      orgId: string,
      query: OptionListQuery,
      actorId?: string
    ): Promise<Result<OptionListResponse, Code>> {
      if (actorId && !(await can(actorId, "read:item-category", orgId))) return forbidden()
      const rows = await repo.listOptions(orgId, {
        search: query.search,
        after: decodeCursor(query.cursor, itemCategoryOptionCursorSchema),
        limit: query.limit + 1,
      })
      const page = toCursorPage(rows, query.limit, (row) => ({ name: row.name, id: row.id }))
      return ok({
        data: {
          items: page.items.map(({ id, name }) => ({ id, name })),
          nextCursor: page.nextCursor,
        },
        msg: "Category options retrieved successfully",
      })
    },

    async tree(orgId: string, actorId?: string): Promise<Result<ItemCategoryTreeResponse, Code>> {
      if (actorId && !(await can(actorId, "read:item-category", orgId))) return forbidden()
      const nodes = await repo.listNodes(orgId)
      return ok({ data: { nodes: nodes.map(toTreeNode) }, msg: "Category tree retrieved successfully" })
    },

    async getById(orgId: string, id: string, actorId?: string): Promise<Result<ItemCategoryDto, Code>> {
      if (actorId && !(await can(actorId, "read:item-category", orgId))) return forbidden()
      const row = await repo.findById(orgId, id)
      if (!row) return fail({ error: Err.ITEM_CATEGORY_NOT_FOUND, msg: MSG.notFound })
      const counts = await repo.counts(orgId, id)
      return ok({ data: toItemCategoryDto(row, counts), msg: "Category retrieved" })
    },

    async create(
      actorId: string,
      orgId: string,
      input: CreateItemCategoryInput
    ): Promise<Result<ItemCategoryDto, Code>> {
      if (!(await can(actorId, "create:item-category", orgId))) return forbidden()
      const parentId = input.parentId ?? null

      const outcome = await repo.transaction(async (tx) => {
        await repo.lockOrgCategories(orgId, tx)
        const nodes = await repo.listNodes(orgId, tx)
        const bad = rules.checkParent({ nodes, parentId })
        if (bad) return fromViolation(bad)
        if (await repo.nameTaken(orgId, parentId, input.name, undefined, tx))
          return failure(Err.ITEM_CATEGORY_NAME_TAKEN, MSG.nameTaken)

        const res = await repo.insertCategory(
          { orgId, parentId, name: input.name, description: input.description ?? null },
          tx
        )
        return res.ok ? res.row : writeFailure(res.reason)
      })
      if (isFailure(outcome)) return toFail(outcome)

      await activityLog.log({
        action: ITEM_CATEGORY_AUDIT_EVENTS.CREATED,
        actorId,
        orgId,
        resourceId: outcome.id,
        metadata: { name: outcome.name, parentId },
      })
      return ok({
        data: toItemCategoryDto(outcome, { childCount: 0, itemCount: 0 }),
        msg: "Category created",
      })
    },

    async update(
      actorId: string,
      orgId: string,
      id: string,
      input: UpdateItemCategoryInput
    ): Promise<Result<ItemCategoryDto, Code>> {
      if (!(await can(actorId, "update:item-category", orgId))) return forbidden()
      const outcome = await repo.transaction(async (tx) => {
        await repo.lockOrgCategories(orgId, tx)
        const current = await repo.findById(orgId, id, tx)
        if (!current) return failure(Err.ITEM_CATEGORY_NOT_FOUND, MSG.notFound)

        const parentChanged = input.parentId !== undefined && input.parentId !== current.parentId
        if (parentChanged) {
          const nodes = await repo.listNodes(orgId, tx)
          const bad = rules.checkParent({ nodes, categoryId: id, parentId: input.parentId ?? null })
          if (bad) return fromViolation(bad)
        }

        const targetParent = input.parentId !== undefined ? input.parentId : current.parentId
        const targetName = input.name ?? current.name
        if (
          (parentChanged || input.name !== undefined) &&
          (await repo.nameTaken(orgId, targetParent, targetName, id, tx))
        )
          return failure(Err.ITEM_CATEGORY_NAME_TAKEN, MSG.nameTaken)

        const res = await repo.updateCategory(
          orgId,
          id,
          {
            ...(input.name !== undefined && { name: input.name }),
            ...(input.description !== undefined && { description: input.description }),
            ...(input.parentId !== undefined && { parentId: input.parentId }),
            ...(input.isActive !== undefined && { isActive: input.isActive }),
          },
          tx
        )
        if (!res.ok) return writeFailure(res.reason)
        return { row: res.row, counts: await repo.counts(orgId, id, tx) }
      })
      if (isFailure(outcome)) return toFail(outcome)

      await activityLog.log({
        action: ITEM_CATEGORY_AUDIT_EVENTS.UPDATED,
        actorId,
        orgId,
        resourceId: id,
        metadata: {
          name: input.name,
          parentId: input.parentId,
          isActive: input.isActive,
        },
      })
      return ok({ data: toItemCategoryDto(outcome.row, outcome.counts), msg: "Category updated" })
    },

    async remove(
      actorId: string,
      orgId: string,
      id: string
    ): Promise<Result<{ id: string }, Code>> {
      if (!(await can(actorId, "delete:item-category", orgId))) return forbidden()
      const outcome = await repo.transaction(async (tx) => {
        await repo.lockOrgCategories(orgId, tx)
        const current = await repo.findById(orgId, id, tx)
        if (!current) return failure(Err.ITEM_CATEGORY_NOT_FOUND, MSG.notFound)

        const bad = rules.checkDeletable(await repo.counts(orgId, id, tx))
        if (bad) return fromViolation(bad)

        const res = await repo.deleteCategory(orgId, id, tx)
        if (!res.ok)
          return res.reason === "in_use"
            ? failure(Err.ITEM_CATEGORY_IN_USE, "This category is still in use")
            : failure(Err.ITEM_CATEGORY_NOT_FOUND, MSG.notFound)
        return { name: current.name }
      })
      if (isFailure(outcome)) return toFail(outcome)

      await activityLog.log({
        action: ITEM_CATEGORY_AUDIT_EVENTS.DELETED,
        actorId,
        orgId,
        resourceId: id,
        metadata: { name: outcome.name },
      })
      return ok({ data: { id }, msg: "Category deleted" })
    },
  }
}
