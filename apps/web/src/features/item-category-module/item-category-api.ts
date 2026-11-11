/**
 * The only file in this module that knows the shape of the generated API
 * client (@/api). Everything else consumes the normalized values returned here,
 * so if a hook name or response shape differs, this is the one place to fix.
 */
import { useMemo } from "react"
import { keepPreviousData, useQueryClient } from "@tanstack/react-query"

import {
  getGetItemCategoryQueryKey,
  getGetItemCategoryTreeQueryKey,
  getListItemCategoriesQueryKey,
  getListItemCategoryOptionsQueryKey,
  listItemCategoryOptions,
  useCreateItemCategory,
  useDeleteItemCategory,
  useGetItemCategory,
  useListItemCategories,
  useUpdateItemCategory,
} from "@/api"

import { useCursorOptions } from "../lib/options/use-cursor-options"
import { useResourceAbilities } from "../lib/permissions/use-resource-abilities"
import type {
  ItemCategoryDto,
  ItemCategoryListItemDto,
  ItemCategoryStatus,
} from "./types"

const NO_CATEGORIES: ItemCategoryListItemDto[] = []

export function normalizeItemCategory(data: {
  id: string
  orgId: string
  parentId?: string | null
  name: string
  description?: string | null
  isActive: boolean
  childCount: number
  itemCount: number
  createdAt: string
  updatedAt: string
}): ItemCategoryDto {
  return {
    id: data.id,
    orgId: data.orgId,
    parentId: data.parentId ?? null,
    name: data.name,
    description: data.description ?? null,
    isActive: data.isActive,
    childCount: data.childCount,
    itemCount: data.itemCount,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  }
}

/** The list query carries booleans as "true" / "false" strings. */
export function statusToIsActive(
  status: ItemCategoryStatus
): "true" | "false" | undefined {
  return status === "all" ? undefined : status === "active" ? "true" : "false"
}

/* --------------------------------- queries -------------------------------- */

export type ItemCategoryListParams = {
  /** 1-based. */
  page: number
  pageSize: number
  status: ItemCategoryStatus
  search: string
}

export function useItemCategoryList(
  orgId: string,
  { page, pageSize, status, search }: ItemCategoryListParams
) {
  const query = useListItemCategories(
    orgId,
    {
      page,
      pageSize,
      isActive: statusToIsActive(status),
      search: search || undefined,
    },
    { query: { placeholderData: keepPreviousData } }
  )

  return {
    categories: query.data?.data.items ?? NO_CATEGORIES,
    total: query.data?.data.total ?? 0,
    isLoading: query.isLoading,
  }
}

/** `enabled: false` is for optional lookups (e.g. the parent of the category being edited). */
export function useItemCategory(
  orgId: string,
  categoryId: string | null | undefined,
  options: { enabled?: boolean } = {}
) {
  const query = useGetItemCategory(orgId, categoryId ?? "", {
    query: { enabled: Boolean(categoryId) && (options.enabled ?? true) },
  })
  const data = query.data?.data
  const category = useMemo<ItemCategoryDto | null>(
    () => (data ? normalizeItemCategory(data) : null),
    [data]
  )

  return { category, isLoading: query.isLoading, error: query.error }
}

/** What the signed-in user may do with categories; used to show or hide buttons. */
export function useItemCategoryAbilities(orgId: string) {
  return useResourceAbilities(orgId, "item-category")
}

/* -------------------------------- mutations ------------------------------- */

function useInvalidateItemCategories(orgId: string) {
  const queryClient = useQueryClient()

  return (categoryId?: string) =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: getListItemCategoriesQueryKey(orgId),
      }),
      queryClient.invalidateQueries({
        queryKey: getGetItemCategoryTreeQueryKey(orgId),
      }),
      // the prefix covers every search term and page of the picker
      queryClient.invalidateQueries({
        queryKey: getListItemCategoryOptionsQueryKey(orgId),
      }),
      categoryId
        ? queryClient.invalidateQueries({
            queryKey: getGetItemCategoryQueryKey(orgId, categoryId),
          })
        : Promise.resolve(),
    ])
}

/** `mutateAsync({ orgId, data })` */
export function useCreateItemCategoryMutation(orgId: string) {
  const invalidate = useInvalidateItemCategories(orgId)
  return useCreateItemCategory({ mutation: { onSuccess: () => invalidate() } })
}

/** `mutateAsync({ orgId, categoryId, data })` */
export function useUpdateItemCategoryMutation(orgId: string) {
  const invalidate = useInvalidateItemCategories(orgId)
  return useUpdateItemCategory({
    mutation: {
      onSuccess: (_response, variables) => invalidate(variables.categoryId),
    },
  })
}

/** `mutateAsync({ orgId, categoryId })` */
export function useDeleteItemCategoryMutation(orgId: string) {
  const invalidate = useInvalidateItemCategories(orgId)
  return useDeleteItemCategory({ mutation: { onSuccess: () => invalidate() } })
}

/** Source for the async combobox (parent picker, item category picker). */
export function useItemCategoryOptions(orgId: string) {
  return useCursorOptions({
    queryKey: getListItemCategoryOptionsQueryKey(orgId),
    fetchPage: async ({ cursor, search, limit, signal }) =>
      (
        await listItemCategoryOptions(
          orgId,
          { cursor, search, limit },
          { signal }
        )
      ).data,
    enabled: Boolean(orgId),
  })
}
