/**
 * The only file in this module that knows the shape of the generated API
 * client (@/api). Everything else consumes the normalized values returned here.
 */
import { useMemo } from "react"
import { keepPreviousData, useQueryClient } from "@tanstack/react-query"
import { hasPermission, type PermissionSnapshot, type PermissionStatement } from "@avuny/contracts"

import {
  getGetWarehouseQueryKey,
  getListWarehouseOptionsQueryKey,
  getListWarehousesQueryKey,
  listWarehouseOptions,
  useCreateWarehouse,
  useDeactivateWarehouse,
  useDeleteWarehouse,
  useGetMyPermissions,
  useGetWarehouse,
  useListWarehouses,
  useReactivateWarehouse,
  useSetDefaultWarehouse,
  useUpdateWarehouse,
} from "@/api"


import type { WarehouseAbilities } from "./lib/warehouse-rules"
import type { WarehouseDto, WarehouseListItemDto, WarehouseScope } from "./types"
import { toQueryBoolean } from "../lib/api/query-boolean"
import { useCursorOptions } from "../lib/options/use-cursor-options"

const NO_WAREHOUSES: WarehouseListItemDto[] = [] // stable empty ref: no new [] per render

// ⚠ role-module/role-api.ts has the same helper. Don't deep-import another feature's internals.
function normalizeStatement(s: {
  effect?: "allow" | "deny" | string
  resource: string
  action: string
  resourceId?: string
}): PermissionStatement {
  return {
    effect: s.effect === "deny" ? "deny" : "allow",
    resource: s.resource as PermissionStatement["resource"],
    action: s.action as PermissionStatement["action"],
    resourceId: s.resourceId ?? "*",
  }
}

/* ------------------------------ normalizers ------------------------------ */
export function normalizeWarehouse(data: {
  id: string
  code: string
  name: string
  description?: string | null
  type: string
  isDefault: boolean
  isSystem: boolean
  isActive: boolean
  addressLine?: string | null
  city?: string | null
  region?: string | null
  postalCode?: string | null
  countryCode?: string | null
  createdAt: string
  updatedAt: string
}): WarehouseDto {
  return {
    ...data,
    description: data.description ?? null,
    type: data.type as WarehouseDto["type"],
    addressLine: data.addressLine ?? null,
    city: data.city ?? null,
    region: data.region ?? null,
    postalCode: data.postalCode ?? null,
    countryCode: data.countryCode ?? null,
  }
}

export function normalizeWarehouseListItem(data: {
  id: string
  code: string
  name: string
  type: string
  isDefault: boolean
  isSystem: boolean
  isActive: boolean
  updatedAt: string
}): WarehouseListItemDto {
  return { ...data, type: data.type as WarehouseListItemDto["type"] }
}

/* -------------------------------- queries -------------------------------- */
export type WarehouseListParams = { page: number /* 1-based */; pageSize: number; scope: WarehouseScope; search: string }

export function useWarehouseList(orgId: string, { page, pageSize, scope, search }: WarehouseListParams) {
  const query = useListWarehouses(
    orgId,
    {
      page,
      pageSize,
      isActive: toQueryBoolean(scope === "all" ? undefined : scope === "active"),
      search: search || undefined,
    },
    { query: { placeholderData: keepPreviousData } } // no flash between pages
  )
  const items = query.data?.data.items
  return {
    warehouses: useMemo(() => (items ? items.map(normalizeWarehouseListItem) : NO_WAREHOUSES), [items]),
    total: query.data?.data.total ?? 0,
    isLoading: query.isLoading,
  }
}

export function useWarehouse(orgId: string, warehouseId: string) {
  const query = useGetWarehouse(orgId, warehouseId)
  const data = query.data?.data
  const warehouse = useMemo<WarehouseDto | null>(() => (data ? normalizeWarehouse(data) : null), [data])
  return { warehouse, isLoading: query.isLoading, error: query.error }
}

/** Warehouse picker source for forms in other modules (async combobox, §17). */
export function useWarehouseOptions(orgId: string) {
  return useCursorOptions({
    queryKey: getListWarehouseOptionsQueryKey(orgId),
    fetchPage: async ({ cursor, search, limit, signal }) =>
      (await listWarehouseOptions(orgId, { cursor, search, limit }, { signal })).data,
    enabled: Boolean(orgId),
  })
}

/** What the signed-in user may do; used ONLY to show/hide UI. */
export function useWarehouseAbilities(orgId: string): WarehouseAbilities {
  const query = useGetMyPermissions(orgId)
  const snapshot = query.data?.data
  return useMemo(() => {
    if (!snapshot) return { canCreate: false, canUpdate: false, canDeactivate: false, canDelete: false }
    const s: PermissionSnapshot = {
      isOwner: snapshot.isOwner,
      statements: snapshot.statements.map(normalizeStatement),
    }
    return {
      canCreate: hasPermission(s, "create:warehouse"),
      canUpdate: hasPermission(s, "update:warehouse"),
      canDeactivate: hasPermission(s, "deactivate:warehouse"),
      canDelete: hasPermission(s, "delete:warehouse"),
    }
  }, [snapshot])
}

/* ------------------------------- mutations ------------------------------- */
function useInvalidateWarehouses(orgId: string) {
  const queryClient = useQueryClient()
  return (warehouseId?: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: getListWarehousesQueryKey(orgId) }),
      // The prefix covers every search term and page of the picker.
      queryClient.invalidateQueries({ queryKey: getListWarehouseOptionsQueryKey(orgId) }),
      warehouseId
        ? queryClient.invalidateQueries({ queryKey: getGetWarehouseQueryKey(orgId, warehouseId) })
        : Promise.resolve(),
    ])
}

/** `mutateAsync({ orgId, data })` */
export function useCreateWarehouseMutation(orgId: string) {
  const invalidate = useInvalidateWarehouses(orgId)
  return useCreateWarehouse({ mutation: { onSuccess: () => invalidate() } })
}
/** `mutateAsync({ orgId, warehouseId, data })` */
export function useUpdateWarehouseMutation(orgId: string) {
  const invalidate = useInvalidateWarehouses(orgId)
  return useUpdateWarehouse({ mutation: { onSuccess: (_res, vars) => invalidate(vars.warehouseId) } })
}
/** `mutateAsync({ orgId, warehouseId })` */
export function useDeactivateWarehouseMutation(orgId: string) {
  const invalidate = useInvalidateWarehouses(orgId)
  return useDeactivateWarehouse({ mutation: { onSuccess: (_res, vars) => invalidate(vars.warehouseId) } })
}
/** `mutateAsync({ orgId, warehouseId })` */
export function useReactivateWarehouseMutation(orgId: string) {
  const invalidate = useInvalidateWarehouses(orgId)
  return useReactivateWarehouse({ mutation: { onSuccess: (_res, vars) => invalidate(vars.warehouseId) } })
}
/** `mutateAsync({ orgId, warehouseId })`. Changes two rows, so the whole list is refreshed. */
export function useSetDefaultWarehouseMutation(orgId: string) {
  const invalidate = useInvalidateWarehouses(orgId)
  return useSetDefaultWarehouse({ mutation: { onSuccess: (_res, vars) => invalidate(vars.warehouseId) } })
}
/** `mutateAsync({ orgId, warehouseId })` */
export function useDeleteWarehouseMutation(orgId: string) {
  const invalidate = useInvalidateWarehouses(orgId)
  return useDeleteWarehouse({ mutation: { onSuccess: () => invalidate() } })
}
