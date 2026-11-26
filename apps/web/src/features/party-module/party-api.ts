/**
 * The ONLY file in this module that knows the shape of the generated API
 * client (@/api). Everything else consumes normalized values.
 */
import { useCallback, useMemo } from "react"
import { keepPreviousData, useQueryClient } from "@tanstack/react-query"
import type { OptionListResponse } from "@avuny/contracts"
import {
  getGetPartyQueryKey,
  getListPartiesQueryKey,
  getListPartyOptionsQueryKey,
  listPartyOptions,
  useAddPartyRole,
  useCreateParty,
  useDeactivatePartyRole,
  useGetMyPermissions,
  useGetParty,
  useListParties,
  useUpdateParty,
} from "@/api"

import { useCursorOptions } from "../lib/options/use-cursor-options.js"
import { derivePartyAbilities } from "./lib/party-roles.js"
import type {
  PartyDto,
  PartyListItemDto,
  PartyRole,
  PartyScope,
  PartyAbilities,
  PartyType,
  PartySalutation,
  PartyRoleDto,
  PartyEmailDto,
  PartyPhoneDto,
  PartyAddressDto,
} from "./types.js"

const NO_PARTIES: PartyListItemDto[] = []

export type RawParty = {
  id: string
  partyType: PartyType
  displayName: string
  salutation?: PartySalutation | null
  legalName?: string | null
  taxNumber?: string | null
  website?: string | null
  notes?: string | null
  roles?: PartyRoleDto[]
  emails?: PartyEmailDto[]
  phones?: PartyPhoneDto[]
  addresses?: PartyAddressDto[]
  createdAt?: string
  updatedAt?: string
}

export type RawPartyListItem = {
  id: string
  displayName: string
  partyType: PartyType
  primaryEmail?: string | null
  primaryPhone?: string | null
  roles?: { role: PartyRole; isActive: boolean }[]
  createdAt?: string
  updatedAt?: string
}

export function normalizeParty(data: RawParty): PartyDto {
  return {
    id: data.id,
    partyType: data.partyType,
    displayName: data.displayName,
    salutation: data.salutation ?? null,
    legalName: data.legalName ?? null,
    taxNumber: data.taxNumber ?? null,
    website: data.website ?? null,
    notes: data.notes ?? null,
    roles: data.roles ?? [],
    emails: data.emails ?? [],
    phones: data.phones ?? [],
    addresses: data.addresses ?? [],
    createdAt: data.createdAt ?? new Date().toISOString(),
    updatedAt: data.updatedAt ?? new Date().toISOString(),
  }
}

export function normalizePartyListItem(data: RawPartyListItem): PartyListItemDto {
  return {
    id: data.id,
    displayName: data.displayName,
    partyType: data.partyType,
    primaryEmail: data.primaryEmail ?? null,
    primaryPhone: data.primaryPhone ?? null,
    roles: data.roles ?? [],
    createdAt: data.createdAt ?? new Date().toISOString(),
    updatedAt: data.updatedAt ?? new Date().toISOString(),
  }
}

export function useInvalidateParties(orgId: string) {
  const qc = useQueryClient()
  return useCallback(
    (partyId?: string) => {
      // Invalidate list prefix
      qc.invalidateQueries({ queryKey: getListPartiesQueryKey(orgId) })
      // Invalidate options prefix
      qc.invalidateQueries({ queryKey: getListPartyOptionsQueryKey(orgId) })
      // Invalidate specific party detail if provided
      if (partyId) {
        qc.invalidateQueries({ queryKey: getGetPartyQueryKey(orgId, partyId) })
      }
    },
    [qc, orgId]
  )
}

/* --------------------------------- queries --------------------------------- */

export interface PartyListParams {
  page: number
  pageSize: number
  scope: PartyScope
  search?: string
}

export function usePartyList(
  orgId: string,
  role: PartyRole,
  params: PartyListParams
) {
  const trimmed = params.search?.trim()
  const query = useListParties(
    orgId,
    {
      role,
      page: params.page,
      pageSize: params.pageSize,
      isActive: params.scope === "active" ? "true" : "false",
      search: trimmed && trimmed.length > 0 ? trimmed : undefined,
    },
    {
      query: {
        placeholderData: keepPreviousData,
        enabled: Boolean(orgId),
      },
    }
  )

  const responseData = query.data?.data
  const normalizedItems = useMemo(
    () =>
      responseData?.items
        ? responseData.items.map((item) =>
            normalizePartyListItem(item as unknown as PartyListItemDto)
          )
        : NO_PARTIES,
    [responseData]
  )
  const total = responseData?.total ?? 0

  return {
    parties: normalizedItems,
    total,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
  }
}

export function useParty(orgId: string, partyId: string, role: PartyRole) {
  const query = useGetParty(
    orgId,
    partyId,
    { role },
    {
      query: {
        enabled: Boolean(orgId) && Boolean(partyId),
      },
    }
  )

  const rawParty = query.data?.data
  const party = useMemo(
    () => (rawParty ? normalizeParty(rawParty as unknown as PartyDto) : undefined),
    [rawParty]
  )

  return {
    party,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
  }
}

export function usePartyOptions(orgId: string, role: PartyRole) {
  const baseKey = useMemo(
    () => [...getListPartyOptionsQueryKey(orgId), { role }],
    [orgId, role]
  )

  const fetchPage = useCallback(
    async ({
      cursor,
      search,
      limit,
      signal,
    }: {
      cursor: string | undefined
      search: string | undefined
      limit: number
      signal: AbortSignal
    }): Promise<OptionListResponse> => {
      const res = await listPartyOptions(
        orgId,
        {
          role,
          cursor,
          search,
          limit,
        },
        { signal }
      )
      return res.data
    },
    [orgId, role]
  )

  return useCursorOptions({
    queryKey: baseKey,
    fetchPage,
    enabled: Boolean(orgId),
  })
}

export function usePartyAbilities(orgId: string, role: PartyRole): PartyAbilities {
  const query = useGetMyPermissions(orgId)
  const snapshot = query.data?.data

  return useMemo(
    () => derivePartyAbilities(snapshot, role),
    [snapshot, role]
  )
}

/* -------------------------------- mutations -------------------------------- */

export function useCreatePartyMutation(orgId: string) {
  const invalidate = useInvalidateParties(orgId)
  return useCreateParty({
    mutation: {
      onSuccess: () => invalidate(),
    },
  })
}

export function useUpdatePartyMutation(orgId: string) {
  const invalidate = useInvalidateParties(orgId)
  return useUpdateParty({
    mutation: {
      onSuccess: (_res, vars) => invalidate(vars.partyId),
    },
  })
}

export function useAddPartyRoleMutation(orgId: string) {
  const invalidate = useInvalidateParties(orgId)
  return useAddPartyRole({
    mutation: {
      onSuccess: (_res, vars) => invalidate(vars.partyId),
    },
  })
}

export function useDeactivatePartyRoleMutation(orgId: string) {
  const invalidate = useInvalidateParties(orgId)
  return useDeactivatePartyRole({
    mutation: {
      onSuccess: (_res, vars) => invalidate(vars.partyId),
    },
  })
}
