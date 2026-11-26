import { useState } from "react"
import { useForm } from "react-hook-form"
import { parseApiError } from "@workspace/ui/lib/api-error"
import {
  useCreatePartyMutation,
  usePartyAbilities,
  normalizeParty,
} from "../party-api.js"
import { oppositeRole } from "../lib/party-roles.js"
import { PartyForm } from "./party-form.js"
import { usePartyFormCopy } from "./use-party-form-copy.js"
import type { PartyDto, PartyRole, PartyFormValues, CreatePartyInput } from "../types.js"

export interface CreatePartyProps {
  orgId: string
  role: PartyRole
  onSuccess?: (party: PartyDto) => void
  onCancel?: () => void
}

function emptyToNull(v: string | null | undefined): string | null {
  if (v === undefined || v === null) return null
  const trimmed = v.trim()
  return trimmed === "" ? null : trimmed
}

export function CreateParty({
  orgId,
  role,
  onSuccess,
  onCancel,
}: CreatePartyProps) {
  const [serverError, setServerError] = useState<string | null>(null)
  const abilities = usePartyAbilities(orgId, role)
  const copy = usePartyFormCopy("create", role)
  const createMutation = useCreatePartyMutation(orgId)

  const form = useForm<PartyFormValues>({
    defaultValues: {
      partyType: "PERSON",
      salutation: null,
      displayName: "",
      legalName: "",
      taxNumber: "",
      website: "",
      notes: "",
      roles: [role],
      emails: [],
      phones: [],
      addresses: [],
    },
  })

  const handleSubmit = form.handleSubmit(async (values) => {
    setServerError(null)

    const payload: CreatePartyInput = {
      partyType: values.partyType,
      salutation: values.partyType === "PERSON" ? values.salutation || null : null,
      displayName: values.displayName.trim(),
      legalName: emptyToNull(values.legalName),
      taxNumber: emptyToNull(values.taxNumber),
      website: emptyToNull(values.website),
      notes: emptyToNull(values.notes),
      roles: values.roles.length > 0 ? values.roles : [role],
      emails: values.emails.map((e) => ({
        email: e.email.trim(),
        label: emptyToNull(e.label),
        isPrimary: e.isPrimary,
      })),
      phones: values.phones.map((p) => ({
        phone: p.phone.trim(),
        label: emptyToNull(p.label),
        isPrimary: p.isPrimary,
      })),
      addresses: values.addresses.map((a) => ({
        label: emptyToNull(a.label),
        addressLine1: a.addressLine1.trim(),
        addressLine2: emptyToNull(a.addressLine2),
        city: emptyToNull(a.city),
        state: emptyToNull(a.state),
        postalCode: emptyToNull(a.postalCode),
        countryCode: emptyToNull(a.countryCode)?.toUpperCase(),
        isPrimary: a.isPrimary,
      })),
    }

    try {
      const res = await createMutation.mutateAsync({
        orgId,
        data: payload as unknown as CreatePartyInput,
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
      isPending={createMutation.isPending}
      errorMessage={serverError}
      isUpdate={false}
      canAddOppositeRole={abilities.opposite.canCreate}
      oppositeRole={oppositeRole(role)}
      onCancel={onCancel}
    />
  )
}
