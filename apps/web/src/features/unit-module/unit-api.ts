/**
 * The only file in this module that knows the shape of the generated API
 * client (@/api). Everything else consumes the normalized values returned here,
 * so if a hook name or response shape differs, this is the one place to fix.
 */
import { useMemo } from "react"
import { keepPreviousData, useQueryClient } from "@tanstack/react-query"

import {
  getGetUnitCollectionQueryKey,
  getListUnitCollectionOptionsQueryKey,
  getListUnitCollectionsQueryKey,
  getListUnitOptionsQueryKey,
  listUnitCollectionOptions,
  listUnitOptions,
  useCreateUnitCollection,
  useDeleteUnitCollection,
  useGetUnitCollection,
  useListUnitCollections,
  useUpdateUnitCollection,
} from "@/api"

import { useCursorOptions } from "../lib/options/use-cursor-options"
import { useResourceAbilities } from "../lib/permissions/use-resource-abilities"
import type { UnitCollectionDto, UnitCollectionListItemDto, UnitDto } from "./types"

const NO_COLLECTIONS: UnitCollectionListItemDto[] = []

export function normalizeUnitCollection(data: {
  id: string
  orgId: string
  name: string
  baseUnitId: string
  units: Array<UnitDto & { conversionFactor: string; isBase: boolean }>
  itemCount: number
  createdAt: string
  updatedAt: string
}): UnitCollectionDto {
  return {
    id: data.id,
    orgId: data.orgId,
    name: data.name,
    baseUnitId: data.baseUnitId,
    units: data.units.map((u) => ({
      id: u.id,
      name: u.name,
      symbol: u.symbol,
      type: u.type,
      conversionFactor: u.conversionFactor,
      isBase: u.isBase,
    })),
    itemCount: data.itemCount,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  }
}

/** "Meter (m)": the label the pickers show for a unit. */
export const unitLabel = (unit: { name: string; symbol: string }) =>
  `${unit.name} (${unit.symbol})`

/* --------------------------------- queries -------------------------------- */

export type UnitCollectionListParams = {
  /** 1-based. */
  page: number
  pageSize: number
  search: string
}

export function useUnitCollectionList(
  orgId: string,
  { page, pageSize, search }: UnitCollectionListParams
) {
  const query = useListUnitCollections(
    orgId,
    { page, pageSize, search: search || undefined },
    { query: { placeholderData: keepPreviousData } }
  )

  return {
    collections: query.data?.data.items ?? NO_COLLECTIONS,
    total: query.data?.data.total ?? 0,
    isLoading: query.isLoading,
  }
}

export function useUnitCollection(orgId: string, collectionId: string) {
  const query = useGetUnitCollection(orgId, collectionId)
  const data = query.data?.data
  const collection = useMemo<UnitCollectionDto | null>(
    () => (data ? normalizeUnitCollection(data) : null),
    [data]
  )

  return { collection, isLoading: query.isLoading, error: query.error }
}

/** What the signed-in user may do with units and unit collections; used to show or hide buttons. */
export function useUnitAbilities(orgId: string) {
  return useResourceAbilities(orgId, "unit")
}

/* -------------------------------- mutations ------------------------------- */

function useInvalidateUnitCollections(orgId: string) {
  const queryClient = useQueryClient()

  return (collectionId?: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: getListUnitCollectionsQueryKey(orgId) }),
      queryClient.invalidateQueries({ queryKey: getListUnitCollectionOptionsQueryKey(orgId) }),
      collectionId
        ? queryClient.invalidateQueries({
            queryKey: getGetUnitCollectionQueryKey(orgId, collectionId),
          })
        : Promise.resolve(),
    ])
}

/** `mutateAsync({ orgId, data })` */
export function useCreateUnitCollectionMutation(orgId: string) {
  const invalidate = useInvalidateUnitCollections(orgId)
  return useCreateUnitCollection({ mutation: { onSuccess: () => invalidate() } })
}

/** `mutateAsync({ orgId, collectionId, data })` */
export function useUpdateUnitCollectionMutation(orgId: string) {
  const invalidate = useInvalidateUnitCollections(orgId)
  return useUpdateUnitCollection({
    mutation: { onSuccess: (_response, variables) => invalidate(variables.collectionId) },
  })
}

/** `mutateAsync({ orgId, collectionId })` */
export function useDeleteUnitCollectionMutation(orgId: string) {
  const invalidate = useInvalidateUnitCollections(orgId)
  return useDeleteUnitCollection({ mutation: { onSuccess: () => invalidate() } })
}

/* --------------------------------- pickers -------------------------------- */

/**
 * Units picker (async combobox). `sameTypeAs` narrows it to units measuring the same thing
 * as that unit: it is part of the query key, so two filters never share a cache entry.
 */
export function useUnitOptions(orgId: string, filter: { sameTypeAs?: string } = {}) {
  const { sameTypeAs } = filter
  return useCursorOptions({
    queryKey: [...getListUnitOptionsQueryKey(orgId), { sameTypeAs }],
    fetchPage: async ({ cursor, search, limit, signal }) =>
      (await listUnitOptions(orgId, { cursor, search, limit, sameTypeAs }, { signal })).data,
    enabled: Boolean(orgId),
  })
}

export function useUnitCollectionOptions(orgId: string) {
  return useCursorOptions({
    queryKey: getListUnitCollectionOptionsQueryKey(orgId),
    fetchPage: async ({ cursor, search, limit, signal }) =>
      (await listUnitCollectionOptions(orgId, { cursor, search, limit }, { signal })).data,
    enabled: Boolean(orgId),
  })
}
