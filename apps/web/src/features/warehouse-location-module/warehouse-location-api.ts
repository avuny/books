/**
 * The only file in this module that knows the shape of the generated API
 * client (@/api). Everything else consumes the normalized values returned here.
 */
import { useMemo } from "react"
import { keepPreviousData, useQueryClient } from "@tanstack/react-query"
import { hasPermission, type PermissionSnapshot, type PermissionStatement } from "@avuny/contracts"

import {
  getGetWarehouseLocationQueryKey,
  getGetWarehouseLocationTreeQueryKey,
  getListWarehouseLocationOptionsQueryKey,
  getListWarehouseLocationsQueryKey,
  getNextWarehouseLocationCode,
  listWarehouseLocationOptions,
  useBlockWarehouseLocation,
  useBulkCreateWarehouseLocations,
  useChangeWarehouseLocationBarcode,
  useCreateWarehouseLocation,
  useDeactivateWarehouseLocation,
  useDeleteWarehouseLocation,
  useGetMyPermissions,
  useGetWarehouse,
  useGetWarehouseLocation,
  useGetWarehouseLocationTree,
  useListWarehouseLocations,
  useMoveWarehouseLocation,
  useReactivateWarehouseLocation,
  useUnblockWarehouseLocation,
  useUpdateWarehouseLocation,
} from "@/api"
import { toQueryBoolean } from "@/features/lib/api/query-boolean"
import { useCursorOptions } from "@/features/lib/options/use-cursor-options"

import type { LocationAbilities } from "./lib/location-rules"
import type {
  LocationScope,
  LocationWarehouse,
  WarehouseLocationDetailDto,
  WarehouseLocationListItemDto,
  WarehouseLocationTreeNode,
} from "./types"

const NO_LOCATIONS: WarehouseLocationListItemDto[] = [] // stable empty ref: no new [] per render
const NO_NODES: WarehouseLocationTreeNode[] = []

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
type Loose<T, K extends keyof T> = Omit<T, K> & { [P in K]: string }

export function normalizeLocationListItem(
  data: Loose<WarehouseLocationListItemDto, "type" | "purpose">
): WarehouseLocationListItemDto {
  return {
    ...data,
    type: data.type as WarehouseLocationListItemDto["type"],
    purpose: data.purpose as WarehouseLocationListItemDto["purpose"],
  }
}

export function normalizeLocationTreeNode(data: Loose<WarehouseLocationTreeNode, "type" | "purpose">): WarehouseLocationTreeNode {
  return {
    ...data,
    type: data.type as WarehouseLocationTreeNode["type"],
    purpose: data.purpose as WarehouseLocationTreeNode["purpose"],
  }
}

export function normalizeLocationDetail(
  data: Omit<WarehouseLocationDetailDto, "type" | "purpose" | "path" | "warehouse"> & {
    type: string
    purpose: string
    path: { id: string; code: string; name: string; type: string }[]
    warehouse: { id: string; code: string; name: string; type: string; isActive: boolean }
  }
): WarehouseLocationDetailDto {
  return {
    ...data,
    type: data.type as WarehouseLocationDetailDto["type"],
    purpose: data.purpose as WarehouseLocationDetailDto["purpose"],
    path: data.path.map((p) => ({ ...p, type: p.type as WarehouseLocationDetailDto["type"] })),
    warehouse: { ...data.warehouse, type: data.warehouse.type as LocationWarehouse["type"] },
  }
}

/* -------------------------------- queries -------------------------------- */
export type LocationListParams = {
  warehouseId: string
  page: number // 1-based
  pageSize: number
  scope: LocationScope
  search: string
}

const SCOPE_FILTERS: Record<LocationScope, { isStockable?: boolean; isBlocked?: boolean; isActive?: boolean }> = {
  all: {},
  stockable: { isStockable: true },
  blocked: { isBlocked: true },
  inactive: { isActive: false },
}

export function useLocationList(orgId: string, { warehouseId, page, pageSize, scope, search }: LocationListParams) {
  const filters = SCOPE_FILTERS[scope]
  const query = useListWarehouseLocations(
    orgId,
    {
      warehouseId,
      page,
      pageSize,
      isStockable: toQueryBoolean(filters.isStockable),
      isBlocked: toQueryBoolean(filters.isBlocked),
      isActive: toQueryBoolean(filters.isActive),
      search: search || undefined,
    },
    { query: { placeholderData: keepPreviousData } } // no flash between pages
  )
  const items = query.data?.data.items
  return {
    locations: useMemo(() => (items ? items.map(normalizeLocationListItem) : NO_LOCATIONS), [items]),
    total: query.data?.data.total ?? 0,
    isLoading: query.isLoading,
  }
}

export function useLocation(orgId: string, locationId: string) {
  const query = useGetWarehouseLocation(orgId, locationId)
  const data = query.data?.data
  const location = useMemo<WarehouseLocationDetailDto | null>(() => (data ? normalizeLocationDetail(data) : null), [data])
  return { location, isLoading: query.isLoading, error: query.error }
}

/** One level of the tree: the roots (no parentId) or the direct children of `parentId`. Loaded lazily. */
export function useLocationTreeLevel(orgId: string, warehouseId: string, parentId: string | undefined, enabled = true) {
  const query = useGetWarehouseLocationTree(
    orgId,
    warehouseId,
    { parentId, depth: 1 },
    { query: { enabled } }
  )
  const items = query.data?.data.items
  return {
    nodes: useMemo(() => (items ? items.map(normalizeLocationTreeNode) : NO_NODES), [items]),
    isLoading: query.isLoading,
    error: query.error,
  }
}

/** The warehouse a location screen belongs to (type, active, system). Shares the warehouse detail cache. */
export function useLocationWarehouse(orgId: string, warehouseId: string) {
  const query = useGetWarehouse(orgId, warehouseId)
  const data = query.data?.data
  const warehouse = useMemo<LocationWarehouse | null>(
    () =>
      data
        ? {
            id: data.id,
            code: data.code,
            name: data.name,
            type: data.type as LocationWarehouse["type"],
            isActive: data.isActive,
            isSystem: data.isSystem,
          }
        : null,
    [data]
  )
  return { warehouse, isLoading: query.isLoading }
}

/** Parent picker and similar sources (async combobox, §17). Filters are part of the cache key. */
export type LocationOptionFilters = {
  warehouseId?: string
  /** Only locations that can have children. */
  containerOnly?: boolean
  stockableOnly?: boolean
  pickableOnly?: boolean
  receivableOnly?: boolean
}

export function useLocationOptions(orgId: string, filters: LocationOptionFilters = {}) {
  return useCursorOptions({
    queryKey: [...getListWarehouseLocationOptionsQueryKey(orgId), filters],
    fetchPage: async ({ cursor, search, limit, signal }) =>
      (
        await listWarehouseLocationOptions(
          orgId,
          {
            cursor,
            search,
            limit,
            warehouseId: filters.warehouseId,
            containerOnly: toQueryBoolean(filters.containerOnly),
            stockableOnly: toQueryBoolean(filters.stockableOnly),
            pickableOnly: toQueryBoolean(filters.pickableOnly),
            receivableOnly: toQueryBoolean(filters.receivableOnly),
          },
          { signal }
        )
      ).data,
    enabled: Boolean(orgId),
  })
}

/** "Suggest next code" for a sibling prefix (imperative: called from a button, not on mount). */
export async function fetchNextLocationCode(
  orgId: string,
  warehouseId: string,
  params: { parentId?: string; prefix: string; pad?: number }
): Promise<string> {
  const response = await getNextWarehouseLocationCode(orgId, warehouseId, {
    parentId: params.parentId,
    prefix: params.prefix,
    pad: params.pad ?? 2,
  })
  return response.data.code
}

/** What the signed-in user may do; used ONLY to show/hide UI. */
export function useLocationAbilities(orgId: string): LocationAbilities {
  const query = useGetMyPermissions(orgId)
  const snapshot = query.data?.data
  return useMemo(() => {
    if (!snapshot) {
      return { canCreate: false, canUpdate: false, canDeactivate: false, canDelete: false, canMove: false, canBlock: false, canChangeBarcode: false }
    }
    const s: PermissionSnapshot = {
      isOwner: snapshot.isOwner,
      statements: snapshot.statements.map(normalizeStatement),
    }
    return {
      canCreate: hasPermission(s, "create:warehouse-location"),
      canUpdate: hasPermission(s, "update:warehouse-location"),
      canDeactivate: hasPermission(s, "deactivate:warehouse-location"),
      canDelete: hasPermission(s, "delete:warehouse-location"),
      canMove: hasPermission(s, "move:warehouse-location"),
      canBlock: hasPermission(s, "block:warehouse-location"),
      // ⚠ underscore action token; if hasPermission rejects it, rename the action in the MODULES registry.
      canChangeBarcode: hasPermission(s, "change_barcode:warehouse-location"),
    }
  }, [snapshot])
}

/* ------------------------------- mutations ------------------------------- */
function useInvalidateLocations(orgId: string, warehouseId: string) {
  const queryClient = useQueryClient()
  return (locationId?: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: getListWarehouseLocationsQueryKey(orgId) }),
      // The prefix covers every expanded level of the warehouse's tree.
      queryClient.invalidateQueries({ queryKey: getGetWarehouseLocationTreeQueryKey(orgId, warehouseId) }),
      // …and every search term and page of the pickers.
      queryClient.invalidateQueries({ queryKey: getListWarehouseLocationOptionsQueryKey(orgId) }),
      locationId
        ? queryClient.invalidateQueries({ queryKey: getGetWarehouseLocationQueryKey(orgId, locationId) })
        : Promise.resolve(),
    ])
}

/** `mutateAsync({ orgId, warehouseId, data })` */
export function useCreateLocationMutation(orgId: string, warehouseId: string) {
  const invalidate = useInvalidateLocations(orgId, warehouseId)
  return useCreateWarehouseLocation({ mutation: { onSuccess: () => invalidate() } })
}
/** `mutateAsync({ orgId, warehouseId, data })`; with `dryRun: true` nothing is written. */
export function useBulkCreateLocationsMutation(orgId: string, warehouseId: string) {
  const invalidate = useInvalidateLocations(orgId, warehouseId)
  return useBulkCreateWarehouseLocations({
    mutation: { onSuccess: (res) => (res.data.dryRun ? undefined : invalidate()) },
  })
}
/** `mutateAsync({ orgId, locationId, data })` */
export function useUpdateLocationMutation(orgId: string, warehouseId: string) {
  const invalidate = useInvalidateLocations(orgId, warehouseId)
  return useUpdateWarehouseLocation({ mutation: { onSuccess: (_res, vars) => invalidate(vars.locationId) } })
}
/** `mutateAsync({ orgId, locationId, data })` */
export function useMoveLocationMutation(orgId: string, warehouseId: string) {
  const invalidate = useInvalidateLocations(orgId, warehouseId)
  return useMoveWarehouseLocation({ mutation: { onSuccess: (_res, vars) => invalidate(vars.locationId) } })
}
/** `mutateAsync({ orgId, locationId, data })` */
export function useBlockLocationMutation(orgId: string, warehouseId: string) {
  const invalidate = useInvalidateLocations(orgId, warehouseId)
  return useBlockWarehouseLocation({ mutation: { onSuccess: (_res, vars) => invalidate(vars.locationId) } })
}
/** `mutateAsync({ orgId, locationId })` */
export function useUnblockLocationMutation(orgId: string, warehouseId: string) {
  const invalidate = useInvalidateLocations(orgId, warehouseId)
  return useUnblockWarehouseLocation({ mutation: { onSuccess: (_res, vars) => invalidate(vars.locationId) } })
}
/** `mutateAsync({ orgId, locationId, params: { cascade } })` ⚠ query params travel as `params` */
export function useDeactivateLocationMutation(orgId: string, warehouseId: string) {
  const invalidate = useInvalidateLocations(orgId, warehouseId)
  return useDeactivateWarehouseLocation({ mutation: { onSuccess: (_res, vars) => invalidate(vars.locationId) } })
}
/** `mutateAsync({ orgId, locationId })` */
export function useReactivateLocationMutation(orgId: string, warehouseId: string) {
  const invalidate = useInvalidateLocations(orgId, warehouseId)
  return useReactivateWarehouseLocation({ mutation: { onSuccess: (_res, vars) => invalidate(vars.locationId) } })
}
/** `mutateAsync({ orgId, locationId, data })` */
export function useChangeLocationBarcodeMutation(orgId: string, warehouseId: string) {
  const invalidate = useInvalidateLocations(orgId, warehouseId)
  return useChangeWarehouseLocationBarcode({ mutation: { onSuccess: (_res, vars) => invalidate(vars.locationId) } })
}
/** `mutateAsync({ orgId, locationId })` */
export function useDeleteLocationMutation(orgId: string, warehouseId: string) {
  const invalidate = useInvalidateLocations(orgId, warehouseId)
  return useDeleteWarehouseLocation({ mutation: { onSuccess: () => invalidate() } })
}
