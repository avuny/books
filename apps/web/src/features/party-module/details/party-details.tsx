import { useState } from "react"
import { useTranslation } from "react-i18next"

import { ConfirmDialog } from "@workspace/ui/blocks/data-table"
import { Button } from "@workspace/ui/components/button"
import { parseApiError } from "@workspace/ui/lib/api-error"

import { PartyButton } from "../forms/party-button.js"
import {
  isRoleActive,
  oppositeRole,
  roleStatus,
} from "../lib/party-roles.js"
import { usePartyLabels } from "../lib/use-party-labels.js"
import {
  useAddPartyRoleMutation,
  useDeactivatePartyRoleMutation,
  useParty,
  usePartyAbilities,
} from "../party-api.js"
import type { PartyRole } from "../types.js"
import {
  type PartyDetailsViewCopy,
  PartyDetailsView,
} from "./party-details-view.js"

export interface PartyDetailsProps {
  orgId: string
  partyId: string
  role: PartyRole
  onBack?: () => void
  onViewRole?: (role: PartyRole) => void
}

export function PartyDetails({
  orgId,
  partyId,
  role,
  onBack,
  onViewRole,
}: PartyDetailsProps) {
  const { t, i18n } = useTranslation("party")
  const { party, isLoading, error } = useParty(orgId, partyId, role)
  const abilities = usePartyAbilities(orgId, role)
  const labels = usePartyLabels()

  const [isDeactivateOpen, setIsDeactivateOpen] = useState(false)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [roleActionError, setRoleActionError] = useState<string | null>(null)

  const deactivateMutation = useDeactivatePartyRoleMutation(orgId)
  const addRoleMutation = useAddPartyRoleMutation(orgId)

  const oppRole = oppositeRole(role)
  const currentActive = party ? isRoleActive(party.roles, role) : false
  const oppStatus = party ? roleStatus(party.roles, oppRole) : "missing"

  const formatDate = (iso?: string | null) => {
    if (!iso) return "—"
    return new Intl.DateTimeFormat(i18n.language, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso))
  }

  const handleDeactivate = async () => {
    if (!party) return
    setDialogError(null)
    try {
      await deactivateMutation.mutateAsync({
        orgId,
        partyId: party.id,
        role,
      })
      setIsDeactivateOpen(false)
    } catch (e) {
      setDialogError(parseApiError(e).message || null)
    }
  }

  const handleReactivateCurrentRole = async () => {
    if (!party) return
    setRoleActionError(null)
    try {
      await addRoleMutation.mutateAsync({
        orgId,
        partyId: party.id,
        data: { role },
      })
    } catch (e) {
      setRoleActionError(parseApiError(e).message || null)
    }
  }

  const handleOppositeRoleAction = async (targetRole: PartyRole) => {
    if (!party) return
    setRoleActionError(null)
    try {
      await addRoleMutation.mutateAsync({
        orgId,
        partyId: party.id,
        data: { role: targetRole },
      })
      if (abilities.opposite.canRead && onViewRole) {
        onViewRole(targetRole)
      }
    } catch (e) {
      setRoleActionError(parseApiError(e).message || null)
    }
  }

  // Current role actions: Edit and Deactivate (if active) OR Reactivate (if inactive)
  let currentRoleAction = null
  let editAction = null

  if (party && currentActive) {
    if (abilities.canUpdate) {
      editAction = <PartyButton orgId={orgId} role={role} partyId={partyId} />
    }
    if (abilities.canDelete) {
      currentRoleAction = (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setDialogError(null)
            setIsDeactivateOpen(true)
          }}
        >
          {t("actions.deactivate", { defaultValue: "Deactivate" })}
        </Button>
      )
    }
  } else if (party && !currentActive && abilities.canUpdate) {
    currentRoleAction = (
      <Button
        type="button"
        variant="outline"
        onClick={handleReactivateCurrentRole}
        disabled={addRoleMutation.isPending}
      >
        {t("actions.reactivate", { defaultValue: "Reactivate" })}
      </Button>
    )
  }

  // Opposite role actions
  let oppositeRoleAction = null
  if (party) {
    if (oppStatus === "missing" && abilities.opposite.canCreate) {
      oppositeRoleAction = (
        <Button
          type="button"
          variant="outline"
          onClick={() => handleOppositeRoleAction(oppRole)}
          disabled={addRoleMutation.isPending}
        >
          {t(`actions.addAsRole.${oppRole}`, {
            defaultValue: `Add as ${labels.getRoleLabel(oppRole)}`,
          })}
        </Button>
      )
    } else if (oppStatus === "inactive" && abilities.opposite.canUpdate) {
      oppositeRoleAction = (
        <Button
          type="button"
          variant="outline"
          onClick={() => handleOppositeRoleAction(oppRole)}
          disabled={addRoleMutation.isPending}
        >
          {t(`actions.reactivateAsRole.${oppRole}`, {
            defaultValue: `Reactivate as ${labels.getRoleLabel(oppRole)}`,
          })}
        </Button>
      )
    } else if (oppStatus === "active" && abilities.opposite.canRead && onViewRole) {
      oppositeRoleAction = (
        <Button
          type="button"
          variant="outline"
          onClick={() => onViewRole(oppRole)}
        >
          {t(`actions.viewAsRole.${oppRole}`, {
            defaultValue: `View as ${labels.getRoleLabel(oppRole)}`,
          })}
        </Button>
      )
    }
  }

  const copy: PartyDetailsViewCopy = {
    backLabel: t(`details.back.${role}`, {
      defaultValue: role === "CUSTOMER" ? "Back to Customers" : "Back to Vendors",
    }),
    legalNameLabel: t("fields.legalName.label", { defaultValue: "Legal Name" }),
    taxNumberLabel: t("fields.taxNumber.label", { defaultValue: "Tax Number" }),
    websiteLabel: t("fields.website.label", { defaultValue: "Website" }),
    notesLabel: t("fields.notes.label", { defaultValue: "Notes" }),
    emailsTitle: t("contacts.emails.title", { defaultValue: "Email Addresses" }),
    phonesTitle: t("contacts.phones.title", { defaultValue: "Phone Numbers" }),
    addressesTitle: t("contacts.addresses.title", { defaultValue: "Addresses" }),
    primaryEmailLabel: t("contacts.emails.primary", { defaultValue: "Primary" }),
    primaryPhoneLabel: t("contacts.phones.primary", { defaultValue: "Primary" }),
    primaryAddressLabel: t("contacts.addresses.primary", { defaultValue: "Primary" }),
    createdLabel: t("details.createdAt", { defaultValue: "Created at" }),
    updatedLabel: t("details.updatedAt", { defaultValue: "Updated at" }),
    salutationLabel: t("fields.salutation.label", { defaultValue: "Salutation" }),
    partyTypeLabel: t("fields.partyType.label", { defaultValue: "Party Type" }),
    inactiveNotice:
      party && !currentActive
        ? t(`details.inactiveNotice.${role}`, {
            defaultValue: `This party is inactive as a ${role.toLowerCase()}.`,
          })
        : null,
    roleBadgeCopy: {
      roleLabels: {
        CUSTOMER: labels.getRoleLabel("CUSTOMER"),
        VENDOR: labels.getRoleLabel("VENDOR"),
      },
      inactiveLabel: t("labels.status.inactive", { defaultValue: "Inactive" }),
    },
  }

  return (
    <>
      <PartyDetailsView
        party={party ?? null}
        isLoading={isLoading}
        errorMessage={
          error ? parseApiError(error).message : roleActionError
        }
        copy={copy}
        typeText={party ? labels.getTypeLabel(party.partyType) : ""}
        salutationText={
          party?.partyType === "PERSON" && party.salutation
            ? labels.getSalutationLabel(party.salutation)
            : undefined
        }
        createdAt={party ? formatDate(party.createdAt) : ""}
        updatedAt={party ? formatDate(party.updatedAt) : ""}
        onBack={onBack}
        editAction={editAction}
        currentRoleAction={currentRoleAction}
        oppositeRoleAction={oppositeRoleAction}
      />

      {/* Deactivate confirmation dialog */}
      <ConfirmDialog
        open={isDeactivateOpen}
        onOpenChange={(open) => {
          setIsDeactivateOpen(open)
          if (!open) setDialogError(null)
        }}
        title={t(`delete.${role}.title`, {
          defaultValue: `Deactivate ${role.toLowerCase()}`,
        })}
        description={
          dialogError ??
          t(`delete.${role}.description`, {
            name: party?.displayName ?? "",
            defaultValue: `Are you sure you want to deactivate ${party?.displayName}?`,
          })
        }
        confirmLabel={t("actions.deactivate", { defaultValue: "Deactivate" })}
        cancelLabel={t("actions.cancel", { defaultValue: "Cancel" })}
        isLoading={deactivateMutation.isPending}
        onConfirm={handleDeactivate}
      />
    </>
  )
}
