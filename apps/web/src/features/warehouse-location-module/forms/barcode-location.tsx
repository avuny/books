import { useState } from "react"
import { useTranslation } from "react-i18next"
import { parseApiError } from "@workspace/ui/lib/api-error"

import { useChangeLocationBarcodeMutation, useLocation } from "../warehouse-location-api"
import { BarcodeLocationForm, type BarcodeLocationFormValues } from "./barcode-location-form"
import { useLocationActionFormCopy } from "./use-location-form-copy"

type BarcodeLocationProps = {
  orgId: string
  warehouseId: string
  locationId: string
  onSuccess?: () => void
}

// Composition only: strings + API behavior wired into the pure form.
export function BarcodeLocation({ orgId, warehouseId, locationId, onSuccess }: BarcodeLocationProps) {
  const { t } = useTranslation("warehouse-location")
  const [serverError, setServerError] = useState<string | null>(null)
  const { location } = useLocation(orgId, locationId)
  const barcodeMutation = useChangeLocationBarcodeMutation(orgId, warehouseId)
  const copy = useLocationActionFormCopy("barcode")

  const handleSubmit = async (values: BarcodeLocationFormValues) => {
    setServerError(null)
    try {
      await barcodeMutation.mutateAsync({ orgId, locationId, data: values })
      onSuccess?.()
    } catch (e) {
      setServerError(parseApiError(e).message || null)
    }
  }

  return (
    <BarcodeLocationForm
      // Remount when the stored barcode arrives so the field starts with it.
      key={location?.barcode ?? "none"}
      copy={{ ...copy, barcode: { label: t("fields.barcode.label"), placeholder: t("fields.barcode.placeholder") } }}
      currentBarcode={location?.barcode ?? null}
      onSubmit={handleSubmit}
      isPending={barcodeMutation.isPending}
      errorMessage={serverError}
    />
  )
}
