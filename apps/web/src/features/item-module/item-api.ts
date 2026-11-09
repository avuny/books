/**
 * The only file in this module that knows the shape of the generated API
 * client (@/api). Everything else consumes the normalized values returned here,
 * so if a hook name or response shape differs, this is the one place to fix.
 */
import { useMemo } from "react"
import { keepPreviousData, useQueryClient } from "@tanstack/react-query"

import {
  getGetItemQueryKey,
  getListItemOptionsQueryKey,
  getListItemsQueryKey,
  listItemOptions,
  useCreateItem,
  useDeleteItem,
  useGetItem,
  useListItems,
  useUpdateItem,
} from "@/api"

import { useCursorOptions } from "../lib/options/use-cursor-options"
import { useResourceAbilities } from "../lib/permissions/use-resource-abilities"
import type { ItemDto, ItemListItemDto, ItemStatus } from "./types"

const NO_ITEMS: ItemListItemDto[] = []

export function normalizeItem(data: Omit<ItemDto, "description" | "reorderPoint"> & {
  description?: string | null
  reorderPoint?: string | null
}): ItemDto {
  return {
    ...data,
    description: data.description ?? null,
    reorderPoint: data.reorderPoint ?? null,
  }
}

/** The list query carries booleans as "true" / "false" strings. */
export function statusToIsActive(status: ItemStatus): "true" | "false" | undefined {
  return status === "all" ? undefined : status === "active" ? "true" : "false"
}

/* --------------------------------- queries -------------------------------- */

export type ItemListParams = {
  /** 1-based. */
  page: number
  pageSize: number
  status: ItemStatus
  search: string
}

export function useItemList(orgId: string, { page, pageSize, status, search }: ItemListParams) {
  const query = useListItems(
    orgId,
    { page, pageSize, isActive: statusToIsActive(status), search: search || undefined },
    { query: { placeholderData: keepPreviousData } }
  )

  return {
    items: query.data?.data.items ?? NO_ITEMS,
    total: query.data?.data.total ?? 0,
    isLoading: query.isLoading,
  }
}

export function useItem(orgId: string, itemId: string) {
  const query = useGetItem(orgId, itemId)
  const data = query.data?.data
  const item = useMemo<ItemDto | null>(() => (data ? normalizeItem(data) : null), [data])

  return { item, isLoading: query.isLoading, error: query.error }
}

/** What the signed-in user may do with items; used to show or hide buttons. */
export function useItemAbilities(orgId: string) {
  return useResourceAbilities(orgId, "item")
}

/* -------------------------------- mutations ------------------------------- */

function useInvalidateItems(orgId: string) {
  const queryClient = useQueryClient()

  return (itemId?: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: getListItemsQueryKey(orgId) }),
      queryClient.invalidateQueries({ queryKey: getListItemOptionsQueryKey(orgId) }),
      itemId
        ? queryClient.invalidateQueries({ queryKey: getGetItemQueryKey(orgId, itemId) })
        : Promise.resolve(),
    ])
}

/** `mutateAsync({ orgId, data })` */
export function useCreateItemMutation(orgId: string) {
  const invalidate = useInvalidateItems(orgId)
  return useCreateItem({ mutation: { onSuccess: () => invalidate() } })
}

/** `mutateAsync({ orgId, itemId, data })` */
export function useUpdateItemMutation(orgId: string) {
  const invalidate = useInvalidateItems(orgId)
  return useUpdateItem({
    mutation: { onSuccess: (_response, variables) => invalidate(variables.itemId) },
  })
}

/** `mutateAsync({ orgId, itemId })` */
export function useDeleteItemMutation(orgId: string) {
  const invalidate = useInvalidateItems(orgId)
  return useDeleteItem({ mutation: { onSuccess: () => invalidate() } })
}

/** Source for the async combobox (documents pick items with it). */
export function useItemOptions(orgId: string) {
  return useCursorOptions({
    queryKey: getListItemOptionsQueryKey(orgId),
    fetchPage: async ({ cursor, search, limit, signal }) =>
      (await listItemOptions(orgId, { cursor, search, limit }, { signal })).data,
    enabled: Boolean(orgId),
  })
}
