import { useMemo, useState } from "react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { parseApiError } from "@workspace/ui/lib/api-error"
import {
  AsyncComboboxField,
  DatePickerField,
  FormShell,
  InputField,
  LineItems,
  SelectField,
  SubmitButton,
} from "@workspace/ui/blocks/form"
import { Button } from "@workspace/ui/components/button"

import { useAsyncComboboxCopy } from "@/features/lib/options/use-async-combobox-copy"
import { usePartyOptions } from "@/features/party-module/options"

import {
  buildPurchaseOrderPayload,
  type PurchaseOrderFormLine,
  type PurchaseOrderFormValues,
} from "../build-payload"
import { currencyDigits } from "../lib"
import {
  fetchItemUnits,
  useConfirmPurchaseOrderMutation,
  useCreatePurchaseOrderMutation,
  useItemSource,
  usePaymentTermOptions,
  usePurchaseOrderDefaults,
  useStockLocationOptions,
  useWarehouseOptions,
} from "../purchase-order-api"

const blankLine = (locationId = ""): PurchaseOrderFormLine => ({
  itemId: "",
  locationId,
  unitId: "",
  orderedQty: "1",
  unitPrice: "0",
  discountAmount: "0",
  expectedDeliveryDate: "",
  notes: "",
})

type Props = {
  orgId: string
  onCreated: (id: string) => void
  onCancel: () => void
}

export function CreatePurchaseOrder({ orgId, onCreated, onCancel }: Props) {
  const { t } = useTranslation("purchase-order")
  const comboboxCopy = useAsyncComboboxCopy()
  const supplierSource = usePartyOptions(orgId, "VENDOR")
  const itemSource = useItemSource(orgId)
  const paymentTerms = usePaymentTermOptions(orgId)
  const { options: warehouseOptions } = useWarehouseOptions(orgId)
  const defaults = usePurchaseOrderDefaults(orgId)
  const createMutation = useCreatePurchaseOrderMutation(orgId)
  const confirmMutation = useConfirmPurchaseOrderMutation(orgId)

  const [serverError, setServerError] = useState<string | null>(null)
  const [unitMap, setUnitMap] = useState<Record<string, { value: string; label: string }[]>>({})

  const form = useForm<PurchaseOrderFormValues>({
    defaultValues: {
      partyId: "",
      orderDate: "",
      expectedDeliveryDate: "",
      paymentTermId: "",
      warehouseId: "",
      supplierReference: "",
      notes: "",
      lines: [blankLine()],
    },
  })

  const warehouseId = useWatch({ control: form.control, name: "warehouseId" })
  const effectiveWarehouse = warehouseId || warehouseOptions[0]?.value || ""
  const locationOptions = useStockLocationOptions(orgId, effectiveWarehouse)
  const digits = useMemo(() => currencyDigits(defaults.currency ?? "USD"), [defaults.currency])

  // Fields that default from the server/org (today, first warehouse) are applied at submit if left blank.
  const submit = (confirm: boolean) =>
    form.handleSubmit(async (values) => {
      setServerError(null)
      const filled: PurchaseOrderFormValues = {
        ...values,
        orderDate: values.orderDate || defaults.today || "",
        warehouseId: values.warehouseId || effectiveWarehouse,
        lines: values.lines.map((l) => ({
          ...l,
          locationId: l.locationId || locationOptions[0]?.value || "",
        })),
      }
      const built = buildPurchaseOrderPayload(filled, digits)
      if (!built.ok) {
        setServerError(built.message === "invalid-money" ? t("form.invalidMoney") : built.message)
        return
      }
      try {
        const res = await createMutation.mutateAsync({ orgId, data: built.data })
        const id = res.data.id
        if (confirm) await confirmMutation.mutateAsync({ orgId, id })
        onCreated(id)
      } catch (e) {
        setServerError(parseApiError(e).message || null)
      }
    })

  const pending = createMutation.isPending || confirmMutation.isPending

  const onItemChange = async (index: number, itemId: string) => {
    if (!itemId) return
    const details = await fetchItemUnits(orgId, itemId)
    setUnitMap((m) => ({ ...m, [itemId]: details.units }))
    if (!form.getValues(`lines.${index}.unitId`)) {
      form.setValue(`lines.${index}.unitId`, details.baseUnitId || details.units[0]?.value || "")
    }
    if (!form.getValues(`lines.${index}.locationId`) && locationOptions[0]) {
      form.setValue(`lines.${index}.locationId`, locationOptions[0].value)
    }
  }

  return (
    <FormShell
      title={t("form.title")}
      description={defaults.currency ? `${t("form.description")} ${t("form.currencyNote", { currency: defaults.currency })}` : t("form.description")}
      errorMessage={serverError}
    >
      <form onSubmit={submit(false)} noValidate className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <AsyncComboboxField
            control={form.control}
            name="partyId"
            copy={{ label: t("form.supplier"), placeholder: t("form.supplierPlaceholder") }}
            comboboxCopy={comboboxCopy}
            source={supplierSource}
            disabled={pending}
          />
          <SelectField
            control={form.control}
            name="warehouseId"
            copy={{ label: t("form.warehouse") }}
            options={warehouseOptions}
            disabled={pending}
          />
          <DatePickerField
            control={form.control}
            name="orderDate"
            copy={{ label: t("form.orderDate"), placeholder: defaults.today }}
            disabled={pending}
          />
          <DatePickerField
            control={form.control}
            name="expectedDeliveryDate"
            copy={{ label: t("form.expectedDelivery") }}
            disabled={pending}
          />
          <SelectField
            control={form.control}
            name="paymentTermId"
            copy={{ label: t("form.paymentTerm"), placeholder: t("form.paymentTermPlaceholder") }}
            options={paymentTerms}
            disabled={pending}
          />
          <InputField
            control={form.control}
            name="supplierReference"
            copy={{ label: t("form.supplierReference") }}
            type="text"
            disabled={pending}
          />
        </div>

        <InputField
          control={form.control}
          name="notes"
          copy={{ label: t("form.notes") }}
          type="text"
          disabled={pending}
        />

        <LineItems
          control={form.control}
          name="lines"
          blankLine={blankLine(locationOptions[0]?.value ?? "")}
          copy={{
            title: t("form.linesTitle"),
            addLine: t("form.addLine"),
            removeLine: t("form.removeLine"),
            noLines: t("form.noLines"),
            item: { label: t("lineFields.item"), placeholder: t("form.itemPlaceholder") },
          }}
          itemSource={itemSource}
          itemComboboxCopy={comboboxCopy}
          itemPlaceholder={t("form.itemPlaceholder")}
          itemColSpan="sm:col-span-7"
          disabled={pending}
          onItemChange={onItemChange}
          renderFields={({ index, disabled, line }) => {
            const itemId = (line as PurchaseOrderFormLine | undefined)?.itemId ?? ""
            const units = itemId ? (unitMap[itemId] ?? []) : []
            return (
              <>
                <div className="sm:col-span-5">
                  <SelectField
                    control={form.control}
                    name={`lines.${index}.locationId` as const}
                    copy={{ label: t("lineFields.location") }}
                    options={locationOptions}
                    disabled={disabled}
                  />
                </div>
                <div className="sm:col-span-3">
                  <SelectField
                    control={form.control}
                    name={`lines.${index}.unitId` as const}
                    copy={{ label: t("lineFields.unit") }}
                    options={units}
                    disabled={disabled}
                  />
                </div>
                <div className="sm:col-span-3">
                  <InputField
                    control={form.control}
                    name={`lines.${index}.orderedQty` as const}
                    copy={{ label: t("form.quantity") }}
                    type="text"
                    disabled={disabled}
                  />
                </div>
                <div className="sm:col-span-3">
                  <InputField
                    control={form.control}
                    name={`lines.${index}.unitPrice` as const}
                    copy={{ label: t("form.unitPrice") }}
                    type="text"
                    disabled={disabled}
                  />
                </div>
                <div className="sm:col-span-3">
                  <InputField
                    control={form.control}
                    name={`lines.${index}.discountAmount` as const}
                    copy={{ label: t("form.discount") }}
                    type="text"
                    disabled={disabled}
                  />
                </div>
              </>
            )
          }}
        />

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
            {t("form.cancel")}
          </Button>
          <SubmitButton
            className="flex-1"
            variant="outline"
            loading={createMutation.isPending && !confirmMutation.isPending}
            label={t("form.save")}
            loadingLabel={t("form.saving")}
          />
          <Button type="button" className="flex-1" disabled={pending} onClick={submit(true)}>
            {t("form.saveConfirm")}
          </Button>
        </div>
      </form>
    </FormShell>
  )
}
