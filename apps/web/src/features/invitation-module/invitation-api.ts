/**
 * The only file in this module that knows the shape of the generated API
 * client (@/api). Everything else consumes the values returned here, so if a
 * hook name or response shape differs, this is the one place to fix.
 *
 * Assumed (same as role-api): every response is the `{ success, data }` body,
 * so `query.data.data` is the payload and `mutateAsync(...).data` is the DTO.
 */
import { useMemo } from "react"
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"
import { hasPermission, type PermissionSnapshot } from "@avuny/contracts"

import {
  getListMyInvitationsQueryKey,
  getListOrganizationInvitationsQueryKey,
  previewOrganizationInvitation,
  useAcceptMyInvitation,
  useAcceptOrganizationInvitation,
  useCreateOrganizationInvitation,
  useDeclineMyInvitation,
  useGetMyPermissions,
  useListMyInvitations,
  useListOrganizationInvitations,
  useResendOrganizationInvitation,
  useRevokeOrganizationInvitation,
} from "@/api"

import type {
  InvitationStatusFilter,
  MyInvitationDto,
  OrganizationInvitationDto,
} from "./types"

const NO_INVITATIONS: OrganizationInvitationDto[] = []
const NO_MY_INVITATIONS: MyInvitationDto[] = []

/* --------------------------------- queries -------------------------------- */

export type InvitationListParams = {
  /** 1-based. */
  page: number
  pageSize: number
  status: InvitationStatusFilter
}

/** Invitations of one organization (the manager's view). */
export function useInvitationList(
  orgId: string,
  { page, pageSize, status }: InvitationListParams
) {
  const query = useListOrganizationInvitations(
    orgId,
    { page, pageSize, status: status === "all" ? undefined : status },
    { query: { placeholderData: keepPreviousData } }
  )

  return {
    invitations: query.data?.data.items ?? NO_INVITATIONS,
    total: query.data?.data.total ?? 0,
    isLoading: query.isLoading,
    error: query.error,
  }
}

/** Open invitations addressed to the signed-in user (their inbox). */
export function useMyInvitations() {
  const query = useListMyInvitations()

  return {
    invitations: query.data?.data.items ?? NO_MY_INVITATIONS,
    isLoading: query.isLoading,
    error: query.error,
  }
}

/**
 * Public preview of a link token. The endpoint is a POST (so the token stays out
 * of URLs and logs), which makes it a mutation in the generated client; it is
 * used as a query here because reading it has no side effects.
 */
export function useInvitationPreview(token: string | undefined) {
  const query = useQuery({
    queryKey: ["organization-invitation-preview", token],
    queryFn: async () =>
      (await previewOrganizationInvitation({ token: token ?? "" })).data,
    enabled: Boolean(token),
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  })

  return {
    preview: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
  }
}

/**
 * What the signed-in user may do with invitations; used to show or hide buttons.
 * The server is the authority: these keys only decide what the UI offers, so if
 * your catalog names an action differently, change it here.
 */
const PERMISSION_KEYS = {
  read: "read:organization-invitation",
  create: "create:organization-invitation",
  resend: "update:organization-invitation",
  revoke: "delete:organization-invitation",
} as const

export function useInvitationAbilities(orgId: string) {
  const query = useGetMyPermissions(orgId)
  const snapshot = query.data?.data

  return useMemo(() => {
    if (!snapshot) {
      return { canRead: false, canCreate: false, canResend: false, canRevoke: false }
    }
    // The generated type marks `effect` and `resourceId` optional (zod defaults).
    const permissions: PermissionSnapshot = {
      isOwner: snapshot.isOwner,
      statements: snapshot.statements.map((statement) => ({
        effect: statement.effect === "deny" ? "deny" : "allow",
        resource: statement.resource,
        action: statement.action,
        resourceId: statement.resourceId ?? "*",
      })),
    }
    return {
      canRead: hasPermission(permissions, PERMISSION_KEYS.read),
      canCreate: hasPermission(permissions, PERMISSION_KEYS.create),
      canResend: hasPermission(permissions, PERMISSION_KEYS.resend),
      canRevoke: hasPermission(permissions, PERMISSION_KEYS.revoke),
    }
  }, [snapshot])
}

/* -------------------------------- mutations ------------------------------- */

function useInvalidateInvitations(orgId: string) {
  const queryClient = useQueryClient()

  return () =>
    queryClient.invalidateQueries({
      queryKey: getListOrganizationInvitationsQueryKey(orgId),
    })
}

function useInvalidateMyInvitations() {
  const queryClient = useQueryClient()

  return () =>
    queryClient.invalidateQueries({ queryKey: getListMyInvitationsQueryKey() })
}

/** `mutateAsync({ orgId, data })` */
export function useCreateInvitationMutation(orgId: string) {
  const invalidate = useInvalidateInvitations(orgId)
  return useCreateOrganizationInvitation({
    mutation: { onSuccess: () => invalidate() },
  })
}

/** `mutateAsync({ orgId, invitationId })` */
export function useRevokeInvitationMutation(orgId: string) {
  const invalidate = useInvalidateInvitations(orgId)
  return useRevokeOrganizationInvitation({
    mutation: { onSuccess: () => invalidate() },
  })
}

/** `mutateAsync({ orgId, invitationId })` */
export function useResendInvitationMutation(orgId: string) {
  const invalidate = useInvalidateInvitations(orgId)
  return useResendOrganizationInvitation({
    mutation: { onSuccess: () => invalidate() },
  })
}

/** `mutateAsync({ invitationId, data })` */
export function useAcceptMyInvitationMutation() {
  const invalidate = useInvalidateMyInvitations()
  return useAcceptMyInvitation({ mutation: { onSuccess: () => invalidate() } })
}

/** `mutateAsync({ invitationId })` */
export function useDeclineMyInvitationMutation() {
  const invalidate = useInvalidateMyInvitations()
  return useDeclineMyInvitation({ mutation: { onSuccess: () => invalidate() } })
}

/** `mutateAsync({ data: { token, username? } })` */
export function useAcceptInvitationByTokenMutation() {
  return useAcceptOrganizationInvitation()
}
