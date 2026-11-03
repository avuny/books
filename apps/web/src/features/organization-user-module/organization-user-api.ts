/**
 * The only file in this module that knows the shape of the generated API
 * client (@/api). Everything else consumes the values returned here, so if a
 * hook name or response shape differs, this is the one place to fix.
 *
 * Assumed (same as invitation-api): every response is the `{ success, data }`
 * body, so `query.data.data` is the payload and `mutateAsync(...).data` is the DTO.
 */
import { useMemo } from "react"
import { keepPreviousData, useQueryClient } from "@tanstack/react-query"
import {
  hasPermission,
  type PermissionSnapshot,
  type PermissionStatement,
} from "@avuny/contracts"

import {
  getGetMyPermissionsQueryKey,
  getListOrganizationUsersQueryKey,
  useGetMyPermissions,
  useListOrganizationUsers,
  useSetOrganizationUserStatus,
  useTransferOrganizationOwnership,
  useUpdateOrganizationUser,
} from "@/api"

import type {
  MemberStatusFilter,
  MemberTypeFilter,
  OrganizationUserDto,
} from "./types"

const NO_MEMBERS: OrganizationUserDto[] = []

/* --------------------------------- queries -------------------------------- */

export type MemberListParams = {
  /** 1-based. */
  page: number
  pageSize: number
  type: MemberTypeFilter
  status: MemberStatusFilter
  /** Already debounced; empty means no search. */
  search: string
}

/** Members of one organization. */
export function useMemberList(
  orgId: string,
  { page, pageSize, type, status, search }: MemberListParams
) {
  const query = useListOrganizationUsers(
    orgId,
    {
      page,
      pageSize,
      type: type === "all" ? undefined : type,
      // The query schema takes "true" | "false" strings.
      isActive:
        status === "all" ? undefined : status === "active" ? "true" : "false",
      search: search || undefined,
    },
    { query: { placeholderData: keepPreviousData } }
  )

  return {
    members: query.data?.data.items ?? NO_MEMBERS,
    total: query.data?.data.total ?? 0,
    isLoading: query.isLoading,
    error: query.error,
  }
}

/**
 * What the signed-in user may do with members; used to show or hide actions.
 * The server is the authority: these keys only decide what the UI offers, so if
 * your permission catalog names an action differently, change it here.
 * Transferring ownership is owner-only, so it follows `isOwner`, not a key.
 */
const PERMISSION_KEYS = {
  read: "read:organization-user",
  update: "update:organization-user",
} as const

export function useMemberAbilities(orgId: string) {
  const query = useGetMyPermissions(orgId)
  const snapshot = query.data?.data

  return useMemo(() => {
    if (!snapshot) {
      return { canRead: false, canUpdate: false, canTransferOwnership: false }
    }
    // The generated type marks `effect` and `resourceId` optional (zod defaults).
    const permissions: PermissionSnapshot = {
      isOwner: snapshot.isOwner,
      statements: snapshot.statements.map((statement) => ({
        effect: statement.effect === "deny" ? "deny" : "allow",
        resource: statement.resource as PermissionStatement["resource"],
        action: statement.action as PermissionStatement["action"],
        resourceId: statement.resourceId ?? "*",
      })),
    }
    return {
      canRead: hasPermission(permissions, PERMISSION_KEYS.read),
      canUpdate: hasPermission(permissions, PERMISSION_KEYS.update),
      canTransferOwnership: snapshot.isOwner,
    }
  }, [snapshot])
}

/* -------------------------------- mutations ------------------------------- */

function useInvalidateMembers(orgId: string) {
  const queryClient = useQueryClient()

  return () =>
    queryClient.invalidateQueries({
      queryKey: getListOrganizationUsersQueryKey(orgId),
    })
}

/** `mutateAsync({ orgId, memberId, data: { username } })` */
export function useUpdateMemberMutation(orgId: string) {
  const invalidate = useInvalidateMembers(orgId)
  return useUpdateOrganizationUser({
    mutation: { onSuccess: () => invalidate() },
  })
}

/** `mutateAsync({ orgId, memberId, data: { isActive } })` */
export function useSetMemberStatusMutation(orgId: string) {
  const invalidate = useInvalidateMembers(orgId)
  return useSetOrganizationUserStatus({
    mutation: { onSuccess: () => invalidate() },
  })
}

/** `mutateAsync({ orgId, data: { newOwnerMemberId, confirmCode } })` */
export function useTransferOwnershipMutation(orgId: string) {
  const queryClient = useQueryClient()
  const invalidateMembers = useInvalidateMembers(orgId)

  return useTransferOrganizationOwnership({
    mutation: {
      // The previous owner's abilities change, so refresh the permissions too.
      onSuccess: () =>
        Promise.all([
          invalidateMembers(),
          queryClient.invalidateQueries({
            queryKey: getGetMyPermissionsQueryKey(orgId),
          }),
        ]),
    },
  })
}
