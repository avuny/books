/**
 * The only file in this module that knows the shape of the generated API
 * client (@/api). Everything else consumes the normalized values returned here,
 * so if a hook name or response shape differs, this is the one place to fix.
 */
import { useMemo } from "react"
import { keepPreviousData, useQueryClient } from "@tanstack/react-query"
import { hasPermission, type PermissionSnapshot } from "@avuny/contracts"

import {
  getGetRoleQueryKey,
  getListRolesQueryKey,
  useCreateRole,
  useDeleteRole,
  useGetMyPermissions,
  useGetPermissionCatalog,
  useGetRole,
  useListRoles,
  useUpdateRole,
} from "@/api"

import type {
  PermissionGroup,
  PermissionStatementDto,
  RoleDto,
  RoleListItemDto,
  RoleScope,
} from "./types"

const NO_ROLES: RoleListItemDto[] = []
const NO_GROUPS: PermissionGroup[] = []

export function normalizeStatement(s: {
  effect?: "allow" | "deny" | string
  resource: string
  action: string
  resourceId?: string
}): PermissionStatementDto {
  return {
    effect: s.effect === "deny" ? "deny" : "allow",
    resource: s.resource,
    action: s.action,
    resourceId: s.resourceId ?? "*",
  }
}

export function normalizeRole(data: {
  id: string
  orgId: string | null
  name: string
  description?: string | null
  isSystem: boolean
  memberCount: number
  permissions: Array<{
    effect?: "allow" | "deny" | string
    resource: string
    action: string
    resourceId?: string
  }>
  createdAt: string
  updatedAt: string
}): RoleDto {
  return {
    id: data.id,
    orgId: data.orgId,
    name: data.name,
    description: data.description ?? null,
    isSystem: data.isSystem,
    memberCount: data.memberCount,
    permissions: data.permissions.map(normalizeStatement),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  }
}

/* --------------------------------- queries -------------------------------- */

export type RoleListParams = {
  /** 1-based. */
  page: number
  pageSize: number
  scope: RoleScope
  search: string
}

export function useRoleList(
  orgId: string,
  { page, pageSize, scope, search }: RoleListParams
) {
  const query = useListRoles(
    orgId,
    { page, pageSize, scope, search: search || undefined },
    { query: { placeholderData: keepPreviousData } }
  )

  return {
    roles: query.data?.data.items ?? NO_ROLES,
    total: query.data?.data.total ?? 0,
    isLoading: query.isLoading,
  }
}

export function useRole(orgId: string, roleId: string) {
  const query = useGetRole(orgId, roleId)
  const roleData = query.data?.data
  const role = useMemo<RoleDto | null>(
    () => (roleData ? normalizeRole(roleData) : null),
    [roleData]
  )

  return {
    role,
    isLoading: query.isLoading,
    error: query.error,
  }
}

export function usePermissionGroups() {
  const query = useGetPermissionCatalog()
  const resources = query.data?.data.resources

  const groups = useMemo<PermissionGroup[]>(
    () =>
      resources
        ? resources.map(({ resource, actions }) => ({ resource, actions }))
        : NO_GROUPS,
    [resources]
  )

  return { groups, isLoading: query.isLoading }
}

/** What the signed-in user may do with roles; used to show or hide buttons. */
export function useRoleAbilities(orgId: string) {
  const query = useGetMyPermissions(orgId)
  const snapshot = query.data?.data

  return useMemo(() => {
    if (!snapshot) {
      return { canCreate: false, canUpdate: false, canDelete: false }
    }
    const normalizedSnapshot: PermissionSnapshot = {
      isOwner: snapshot.isOwner,
      statements: snapshot.statements.map(normalizeStatement),
    }
    return {
      canCreate: hasPermission(normalizedSnapshot, "create:role"),
      canUpdate: hasPermission(normalizedSnapshot, "update:role"),
      canDelete: hasPermission(normalizedSnapshot, "delete:role"),
    }
  }, [snapshot])
}

/* -------------------------------- mutations ------------------------------- */

function useInvalidateRoles(orgId: string) {
  const queryClient = useQueryClient()

  return (roleId?: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: getListRolesQueryKey(orgId) }),
      roleId
        ? queryClient.invalidateQueries({
            queryKey: getGetRoleQueryKey(orgId, roleId),
          })
        : Promise.resolve(),
    ])
}

/** `mutateAsync({ orgId, data })` */
export function useCreateRoleMutation(orgId: string) {
  const invalidate = useInvalidateRoles(orgId)
  return useCreateRole({ mutation: { onSuccess: () => invalidate() } })
}

/** `mutateAsync({ orgId, roleId, data })` */
export function useUpdateRoleMutation(orgId: string) {
  const invalidate = useInvalidateRoles(orgId)
  return useUpdateRole({
    mutation: {
      onSuccess: (_response, variables) => invalidate(variables.roleId),
    },
  })
}

/** `mutateAsync({ orgId, roleId })` */
export function useDeleteRoleMutation(orgId: string) {
  const invalidate = useInvalidateRoles(orgId)
  return useDeleteRole({ mutation: { onSuccess: () => invalidate() } })
}
