/**
 * The only file in this module that knows the shape of the generated API
 * client (@/api). Everything else consumes the normalized values returned here.
 */
import { useMemo } from "react"
import { keepPreviousData, useQueryClient } from "@tanstack/react-query"

import {
  getGetUnitQueryKey,
  getListUnitOptionsQueryKey,
  getListUnitsQueryKey,
  listUnitOptions,
  useCreateUnit,
  useDeleteUnit,
  useGetUnit,
  useListUnits,
  useUpdateUnit,
} from "@/api"

import { useCursorOptions } from "../lib/options/use-cursor-options"
import { useResourceAbilities } from "../lib/permissions/use-resource-abilities"
import type {
  UnitDto,
  UnitListItemDto,
  UnitOffsetListQuery,
  UnitType,
} from "./types"

const NO_UNITS: UnitListItemDto[] = []

export function normalizeUnit(data: {
  id: string
  orgId: string | null
  name: string
  symbol: string
  type: UnitType
  isActive: boolean
  isSystem: boolean
  createdAt: string
  updatedAt: string
}): UnitDto {
  return {
    id: data.id,
    orgId: data.orgId ?? null,
    name: data.name,
    symbol: data.symbol,
    type: data.type,
    isActive: data.isActive,
    isSystem: data.isSystem,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  }
}

/* --------------------------------- queries -------------------------------- */

export function useUnitList(orgId: string, params: UnitOffsetListQuery) {
  const query = useListUnits(
    orgId,
    {
      page: params.page,
      pageSize: params.pageSize,
      search: params.search,
      type: params.type,
      isActive: params.isActive,
    },
    {
      query: {
        placeholderData: keepPreviousData,
      },
    }
  )

  const raw = query.data?.data
  const items = useMemo<UnitListItemDto[]>(
    () => (raw?.items ? raw.items.map(normalizeUnit) : NO_UNITS),
    [raw]
  )

  return {
    items,
    total: raw?.total ?? 0,
    page: raw?.page ?? params.page,
    pageSize: raw?.pageSize ?? params.pageSize,
    isLoading: query.isLoading,
    isPlaceholderData: query.isPlaceholderData,
    error: query.error,
  }
}

export function useUnit(orgId: string, unitId: string) {
  const query = useGetUnit(orgId, unitId)
  const data = query.data?.data
  const unit = useMemo<UnitDto | null>(
    () => (data ? normalizeUnit(data) : null),
    [data]
  )

  return { unit, isLoading: query.isLoading, error: query.error }
}

export function useUnitAbilities(orgId: string) {
  return useResourceAbilities(orgId, "unit")
}

/* -------------------------------- mutations ------------------------------- */

function useInvalidateUnits(orgId: string) {
  const queryClient = useQueryClient()

  return (unitId?: string) =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: getListUnitsQueryKey(orgId),
      }),
      queryClient.invalidateQueries({
        queryKey: getListUnitOptionsQueryKey(orgId),
      }),
      unitId
        ? queryClient.invalidateQueries({
            queryKey: getGetUnitQueryKey(orgId, unitId),
          })
        : Promise.resolve(),
    ])
}

/** `mutateAsync({ orgId, data })` */
export function useCreateUnitMutation(orgId: string) {
  const invalidate = useInvalidateUnits(orgId)
  return useCreateUnit({
    mutation: { onSuccess: () => invalidate() },
  })
}

/** `mutateAsync({ orgId, unitId, data })` */
export function useUpdateUnitMutation(orgId: string) {
  const invalidate = useInvalidateUnits(orgId)
  return useUpdateUnit({
    mutation: {
      onSuccess: (_data, variables) => invalidate(variables.unitId),
    },
  })
}

/** `mutateAsync({ orgId, unitId })` */
export function useDeleteUnitMutation(orgId: string) {
  const invalidate = useInvalidateUnits(orgId)
  return useDeleteUnit({
    mutation: {
      onSuccess: (_data, variables) => invalidate(variables.unitId),
    },
  })
}

/* ----------------------------- combobox picker ---------------------------- */

export function useUnitOptions(
  orgId: string,
  filter: { type?: UnitType; sameTypeAs?: string } = {}
) {
  const { type, sameTypeAs } = filter
  return useCursorOptions({
    queryKey: [...getListUnitOptionsQueryKey(orgId), { type, sameTypeAs }],
    fetchPage: async ({ cursor, search, limit, signal }) =>
      (
        await listUnitOptions(
          orgId,
          { cursor, search, limit, type, sameTypeAs },
          { signal }
        )
      ).data,
    enabled: Boolean(orgId),
  })
}

export { unitLabel } from "./lib/unit-label"

