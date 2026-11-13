import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useAsyncComboboxCopy } from "@/features/lib/options/use-async-combobox-copy"
import { parseApiError } from "@workspace/ui/lib/api-error"

import { useLocationOptions, useMoveLocationMutation } from "../warehouse-location-api"
import { MoveLocationForm, type MoveLocationFormValues } from "./move-location-form"
import { useLocationActionFormCopy } from "./use-location-form-copy"

type MoveLocationProps = {
  orgId: string
  warehouseId: string
  locationId: string
  onSuccess?: () => void
}

// Composition only: strings + API behavior wired into the pure form.
export function MoveLocation({ orgId, warehouseId, locationId, onSuccess }: MoveLocationProps) {
  const { t } = useTranslation("warehouse-location")
  const [serverError, setServerError] = useState<string | null>(null)
  const moveMutation = useMoveLocationMutation(orgId, warehouseId)
  const copy = useLocationActionFormCopy("move")
  const comboboxCopy = useAsyncComboboxCopy()
  const parentSource = useLocationOptions(orgId, { warehouseId, containerOnly: true })

  const handleSubmit = async (values: MoveLocationFormValues) => {
    setServerError(null)
    try {
      await moveMutation.mutateAsync({ orgId, locationId, data: values })
      onSuccess?.()
    } catch (e) {
      setServerError(parseApiError(e).message || null) // e.g. "not empty", "cycle": already localized
    }
  }

  return (
    <MoveLocationForm
      copy={{ ...copy, parent: { label: t("fields.parent.label"), placeholder: t("fields.parent.placeholder") } }}
      comboboxCopy={comboboxCopy}
      parentSource={parentSource}
      onSubmit={handleSubmit}
      isPending={moveMutation.isPending}
      errorMessage={serverError}
    />
  )
}
