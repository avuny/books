import { useCallback, useState } from "react"
import { Eye, Pencil, Power, PowerOff } from "lucide-react"
import { useTranslation } from "react-i18next"
import { ConfirmDialog, type RowAction } from "@workspace/ui/blocks/data-table"
import { parseApiError } from "@workspace/ui/lib/api-error"

import { PartyDialog } from "../forms/party-dialog.js"
import { isRoleActive } from "../lib/party-roles.js"
import type { PartyListItemDto, PartyRole } from "../types.js"
import {
  useAddPartyRoleMutation,
  useDeactivatePartyRoleMutation,
  usePartyAbilities,
} from "../party-api.js"

export interface PartyActionTarget {
  id: string
  displayName: string
  roles: PartyListItemDto["roles"]
}

export interface UsePartyActionsOptions {
  onViewParty?: (partyId: string) => void
}

export function usePartyActions(
  orgId: string,
  role: PartyRole,
  { onViewParty }: UsePartyActionsOptions = {}
) {
  const { t } = useTranslation("party")
  const abilities = usePartyAbilities(orgId, role)

  const [toEdit, setToEdit] = useState<PartyActionTarget | null>(null)
  const [toDeactivate, setToDeactivate] = useState<PartyActionTarget | null>(null)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const deactivateMutation = useDeactivatePartyRoleMutation(orgId)
  const addRoleMutation = useAddPartyRoleMutation(orgId)

  const closeDialogs = () => {
    setToDeactivate(null)
    setDialogError(null)
  }

  const handleDeactivate = async () => {
    if (!toDeactivate) return
    setDialogError(null)
    try {
      await deactivateMutation.mutateAsync({
        orgId,
        partyId: toDeactivate.id,
        role,
      })
      closeDialogs()
    } catch (e) {
      setDialogError(parseApiError(e).message || null)
    }
  }

  const handleReactivate = async (party: PartyActionTarget) => {
    setActionError(null)
    try {
      await addRoleMutation.mutateAsync({
        orgId,
        partyId: party.id,
        data: { role },
      })
    } catch (e) {
      setActionError(parseApiError(e).message || null)
    }
  }

  const getActions = useCallback(
    (
      party: PartyActionTarget,
      { includeEdit = true }: { includeEdit?: boolean } = {}
    ): RowAction[] => {
      const active = isRoleActive(party.roles, role)
      const actions: RowAction[] = []

      // 1. View
      if (onViewParty) {
        actions.push({
          id: "view",
          label: t("actions.view", { defaultValue: "View details" }),
          icon: <Eye className="size-4" />,
          onSelect: () => onViewParty(party.id),
        })
      }

      // 2. Edit (only if role is active and user can update)
      if (includeEdit && active && abilities.canUpdate) {
        actions.push({
          id: "edit",
          label: t("actions.edit", { defaultValue: "Edit" }),
          icon: <Pencil className="size-4" />,
          onSelect: () => setToEdit(party),
        })
      }

      // 3. Deactivate (if active and user can delete)
      if (active && abilities.canDelete) {
        actions.push({
          id: "deactivate",
          label: t("actions.deactivate", { defaultValue: "Deactivate" }),
          icon: <PowerOff className="size-4" />,
          variant: "destructive",
          separatorBefore: true,
          onSelect: () => setToDeactivate(party),
        })
      }

      // 4. Reactivate (if inactive and user can update)
      if (!active && abilities.canUpdate) {
        actions.push({
          id: "reactivate",
          label: t("actions.reactivate", { defaultValue: "Reactivate" }),
          icon: <Power className="size-4" />,
          onSelect: () => void handleReactivate(party),
        })
      }

      return actions
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, abilities, role, orgId, onViewParty]
  )

  const dialogs = (
    <>
      {toEdit ? (
        <PartyDialog
          orgId={orgId}
          role={role}
          partyId={toEdit.id}
          open
          onOpenChange={(open) => {
            if (!open) setToEdit(null)
          }}
        />
      ) : null}

      <ConfirmDialog
        open={toDeactivate !== null}
        onOpenChange={(open) => {
          if (!open) closeDialogs()
        }}
        title={t(`delete.${role}.title`, {
          defaultValue: `Deactivate ${role === "CUSTOMER" ? "Customer" : "Vendor"}`,
        })}
        description={
          dialogError ??
          t(`delete.${role}.description`, {
            defaultValue: `Deactivating only ends this party's role as a ${role.toLowerCase()}. The party identity, shared details, and other roles are unaffected.`,
          })
        }
        confirmLabel={t("actions.deactivate", { defaultValue: "Deactivate" })}
        cancelLabel={t("actions.cancel", { defaultValue: "Cancel" })}
        isLoading={deactivateMutation.isPending}
        onConfirm={handleDeactivate}
      />
    </>
  )

  return {
    abilities,
    getActions,
    dialogs,
    actionError,
    clearActionError: () => setActionError(null),
  }
}
