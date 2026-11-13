import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { ChangeWarehouseLocationBarcodeSchema } from "@avuny/contracts"

import { FormShell, InputField, SubmitButton } from "@workspace/ui/blocks/form"
import type { FieldCopy } from "@workspace/ui/blocks/types"
import { mapBlanks } from "@/features/lib/forms/blank-values"

import type { ChangeWarehouseLocationBarcodeInput } from "../types"
import type { LocationActionFormCopy } from "./location-form-types"

export type BarcodeLocationFormValues = ChangeWarehouseLocationBarcodeInput

type BarcodeLocationFormProps = {
  copy: LocationActionFormCopy & { barcode: FieldCopy }
  /** The barcode now stored, shown as the starting value. */
  currentBarcode: string | null
  onSubmit: (values: BarcodeLocationFormValues) => void
  isPending: boolean
  errorMessage?: string | null
}

const baseResolver = zodResolver(ChangeWarehouseLocationBarcodeSchema)

// UI + validation only. No i18n, API, auth or navigation knowledge.
export function BarcodeLocationForm({ copy, currentBarcode, onSubmit, isPending, errorMessage }: BarcodeLocationFormProps) {
  const form = useForm<BarcodeLocationFormValues>({
    // An empty field asks the server to generate a new barcode.
    resolver: (values, context, options) => baseResolver(mapBlanks(values, ["barcode"], undefined), context, options),
    defaultValues: { barcode: currentBarcode ?? "" },
  })

  return (
    <FormShell title={copy.title} description={copy.description} errorMessage={errorMessage}>
      <form onSubmit={form.handleSubmit((values) => onSubmit(values))} noValidate className="space-y-6">
        <InputField control={form.control} name="barcode" copy={copy.barcode} type="text" autoComplete="off" autoFocus disabled={isPending} />
        <SubmitButton className="w-full" loading={isPending} label={copy.submitLabel} loadingLabel={copy.submittingLabel} />
      </form>
    </FormShell>
  )
}
