import { useState } from "react"
import { useTranslation } from "react-i18next"
import { parseApiError } from "@workspace/ui/lib/api-error"

import { useBlockLocationMutation } from "../warehouse-location-api"
import { BlockLocationForm, type BlockLocationFormValues } from "./block-location-form"
import { useLocationActionFormCopy } from "./use-location-form-copy"

type BlockLocationProps = {
  orgId: string
  warehouseId: string
  locationId: string
  onSuccess?: () => void
}

// Composition only: strings + API behavior wired into the pure form.
export function BlockLocation({ orgId, warehouseId, locationId, onSuccess }: BlockLocationProps) {
  const { t } = useTranslation("warehouse-location")
  const [serverError, setServerError] = useState<string | null>(null)
  const blockMutation = useBlockLocationMutation(orgId, warehouseId)
  const copy = useLocationActionFormCopy("block")

  const handleSubmit = async (values: BlockLocationFormValues) => {
    setServerError(null)
    try {
      await blockMutation.mutateAsync({ orgId, locationId, data: values })
      onSuccess?.()
    } catch (e) {
      setServerError(parseApiError(e).message || null)
    }
  }

  return (
    <BlockLocationForm
      copy={{ ...copy, reason: { label: t("fields.reason.label"), placeholder: t("fields.reason.placeholder") } }}
      onSubmit={handleSubmit}
      isPending={blockMutation.isPending}
      errorMessage={serverError}
    />
  )
}
