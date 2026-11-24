import { useState } from "react"
import { useForm } from "react-hook-form"
import { parseApiError } from "@workspace/ui/lib/api-error"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useParty, useUpdatePartyMutation, normalizeParty } from "../party-api.js"
import { buildPartyUpdatePayload } from "../lib/build-update-payload.js"
import { PartyForm } from "./party-form.js"
import { usePartyFormCopy } from "./use-party-form-copy.js"
import type { PartyDto, PartyRole, PartyFormValues, UpdatePartyInput } from "../types.js"

export interface UpdatePartyProps {
  orgId: string
  partyId: string
  role: PartyRole
  onSuccess?: (party: PartyDto) => void
  onCancel?: () => void
}

export function UpdateParty({
  orgId,
  partyId,
  role,
  onSuccess,
  onCancel,
}: UpdatePartyProps) {
  const { party, isLoading, error } = useParty(orgId, partyId, role)

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  if (error || !party) {
    return (
      <div className="text-destructive p-4 text-sm">
        {parseApiError(error).message || "Party not found"}
      </div>
    )
  }

  return (
    <UpdatePartyFormContainer
      key={party.id}
      orgId={orgId}
      party={party}
      role={role}
      onSuccess={onSuccess}
      onCancel={onCancel}
    />
  )
}

function UpdatePartyFormContainer({
  orgId,
  party,
  role,
  onSuccess,
  onCancel,
}: {
  orgId: string
  party: PartyDto
  role: PartyRole
  onSuccess?: (party: PartyDto) => void
  onCancel?: () => void
}) {
  const [serverError, setServerError] = useState<string | null>(null)
  const copy = usePartyFormCopy("update", role)
  const updateMutation = useUpdatePartyMutation(orgId)

  const form = useForm<PartyFormValues>({
    defaultValues: {
      partyType: party.partyType,
      salutation: party.salutation,
      displayName: party.displayName,
      legalName: party.legalName ?? "",
      taxNumber: party.taxNumber ?? "",
      website: party.website ?? "",
      notes: party.notes ?? "",
      roles: party.roles.map((r) => r.role),
      emails: party.emails.map((e) => ({
        contactId: e.id,
        email: e.email,
        label: e.label ?? "",
        isPrimary: e.isPrimary,
      })),
      phones: party.phones.map((p) => ({
        contactId: p.id,
        phone: p.phone,
        label: p.label ?? "",
        isPrimary: p.isPrimary,
      })),
      addresses: party.addresses.map((a) => ({
        contactId: a.id,
        label: a.label ?? "",
        addressLine1: a.addressLine1,
        addressLine2: a.addressLine2 ?? "",
        city: a.city ?? "",
        state: a.state ?? "",
        postalCode: a.postalCode ?? "",
        countryCode: a.countryCode ?? "",
        isPrimary: a.isPrimary,
      })),
    },
  })

  const handleSubmit = form.handleSubmit(async (values) => {
    setServerError(null)

    const payload = buildPartyUpdatePayload(party, values)
    if (!payload) {
      // No changes; close dialog immediately without network request
      onSuccess?.(party)
      return
    }

    try {
      const res = await updateMutation.mutateAsync({
        orgId,
        partyId: party.id,
        params: { role },
        data: payload as unknown as UpdatePartyInput,
      })
      onSuccess?.(normalizeParty(res.data))
    } catch (e) {
      setServerError(parseApiError(e).message || null)
    }
  })

  return (
    <PartyForm
      form={form}
      copy={copy}
      onSubmit={handleSubmit}
      isPending={updateMutation.isPending}
      errorMessage={serverError}
      isUpdate={true}
      canAddOppositeRole={false}
      onCancel={onCancel}
    />
  )
}
