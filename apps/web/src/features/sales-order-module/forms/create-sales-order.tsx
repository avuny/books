import { useEffect, useMemo, useState } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
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
  buildSalesOrderPayload,
  type SalesOrderFormLine,
  type SalesOrderFormValues,
} from "../build-payload"
import { bpsToPercent, currencyDigits, fromMinorUnits } from "../lib"
import type { SalesOrderDto } from "../types"
import {
  fetchItemUnits,
  useConfirmSalesOrderMutation,
  useCreateSalesOrderMutation,
  useUpdateSalesOrderMutation,
  useItemSource,
  usePaymentTermOptions,
  useSalesOrderDefaults,
  useLocationSource,
  useStockLocationOptions,
  useWarehouseOptions,
} from "../sales-order-api"

const blankLine = (locationId = ""): SalesOrderFormLine => ({
  itemId: "",
  locationId,
  unitId: "",
  orderedQty: "1",
  unitPrice: "0",
  discountMode: "percent",
  discountAmount: "0",
  discountRate: "0",
  taxRate: "0",
  requestedDeliveryDate: "",
  notes: "",
})

type Props = {
  orgId: string
  /** When set, the form edits this draft order instead of creating one. */
  order?: SalesOrderDto
  onCreated: (id: string) => void
  onCancel: () => void
}

function orderToFormValues(order: SalesOrderDto): SalesOrderFormValues {
  const digits = currencyDigits(order.currency)
  return {
    partyId: order.partyId,
    orderDate: order.orderDate,
    requestedDeliveryDate: order.requestedDeliveryDate ?? "",
    paymentTermId: order.paymentTermId ?? "",
    warehouseId: order.warehouseId ?? "",
    customerReference: order.customerReference ?? "",
    notes: order.notes ?? "",
    lines: order.lines.map((l) => ({
      itemId: l.itemId,
      locationId: l.locationId,
      unitId: l.unitId,
      orderedQty: l.orderedQty,
      unitPrice: fromMinorUnits(l.unitPrice, digits),
      discountMode: l.discountRateBps === 0 && BigInt(l.discountAmount) > 0n ? "amount" : "percent",
      discountAmount: fromMinorUnits(l.discountAmount, digits),
      discountRate: bpsToPercent(l.discountRateBps),
      taxRate: bpsToPercent(l.taxRateBps),
      requestedDeliveryDate: l.requestedDeliveryDate ?? "",
      notes: l.notes ?? "",
    })),
  }
}

export function CreateSalesOrder({ orgId, order, onCreated, onCancel }: Props) {
  const { t } = useTranslation("sales-order")
  const comboboxCopy = useAsyncComboboxCopy()
  const customerSource = usePartyOptions(orgId, "CUSTOMER")
  const itemSource = useItemSource(orgId)
  const paymentTerms = usePaymentTermOptions(orgId)
  const { options: warehouseOptions } = useWarehouseOptions(orgId)
  const defaults = useSalesOrderDefaults(orgId)
  const createMutation = useCreateSalesOrderMutation(orgId)
  const confirmMutation = useConfirmSalesOrderMutation(orgId)
  const updateMutation = useUpdateSalesOrderMutation(orgId)
  const isEdit = Boolean(order)

  const [serverError, setServerError] = useState<string | null>(null)
  const [unitMap, setUnitMap] = useState<Record<string, { value: string; label: string }[]>>({})

  const form = useForm<SalesOrderFormValues>({
    defaultValues: order ? orderToFormValues(order) : {
      partyId: "",
      orderDate: "",
      requestedDeliveryDate: "",
      paymentTermId: "",
      warehouseId: "",
      customerReference: "",
      notes: "",
      lines: [blankLine()],
    },
  })

  const warehouseId = useWatch({ control: form.control, name: "warehouseId" })
  const effectiveWarehouse = warehouseId || warehouseOptions[0]?.value || ""
  const locationOptions = useStockLocationOptions(orgId, effectiveWarehouse)
  const locationSource = useLocationSource(orgId, effectiveWarehouse)
  const digits = useMemo(
    () => currencyDigits(order?.currency ?? defaults.currency ?? "USD"),
    [order?.currency, defaults.currency]
  )

  // When editing, load each line item's unit choices once so the unit selects are populated.
  useEffect(() => {
    if (!order) return
    const ids = [...new Set(order.lines.map((l) => l.itemId))]
    void Promise.all(ids.map((id) => fetchItemUnits(orgId, id).then((d) => [id, d.units] as const))).then(
      (pairs) => setUnitMap(Object.fromEntries(pairs))
    )
  }, [order, orgId])

  // Fields that default from the server/org (today, first warehouse) are applied at submit if left blank.
  const submit = (confirm: boolean) =>
    form.handleSubmit(async (values) => {
      setServerError(null)
      const filled: SalesOrderFormValues = {
        ...values,
        orderDate: values.orderDate || defaults.today || "",
        warehouseId: values.warehouseId || effectiveWarehouse,
        lines: values.lines.map((l) => ({
          ...l,
          locationId: l.locationId || locationOptions[0]?.value || "",
        })),
      }
      const built = buildSalesOrderPayload(filled, digits)
      if (!built.ok) {
        setServerError(
          built.message === "invalid-money"
            ? t("form.invalidMoney")
            : built.message === "invalid-rate"
              ? t("form.invalidRate")
              : built.message === "rate-conflict"
                ? t("form.rateConflict")
                : built.message
        )
        return
      }
      try {
        if (order) {
          await updateMutation.mutateAsync({ orgId, id: order.id, data: built.data })
          onCreated(order.id)
          return
        }
        const res = await createMutation.mutateAsync({ orgId, data: built.data })
        const id = res.data.id
        if (confirm) await confirmMutation.mutateAsync({ orgId, id, data: {} })
        onCreated(id)
      } catch (e) {
        setServerError(parseApiError(e).message || null)
      }
    })

  const pending = createMutation.isPending || confirmMutation.isPending || updateMutation.isPending

  const onItemChange = async (index: number, itemId: string) => {
    if (!itemId) return
    const details = await fetchItemUnits(orgId, itemId)
    setUnitMap((m) => ({ ...m, [itemId]: details.units }))
    // Default the unit price from the item's cost price, unless the user already typed one.
    const typed = form.getValues(`lines.${index}.unitPrice`)
    if (details.costPrice && (!typed || Number(typed) === 0)) {
      form.setValue(`lines.${index}.unitPrice`, details.costPrice)
    }
    if (!form.getValues(`lines.${index}.unitId`)) {
      form.setValue(`lines.${index}.unitId`, details.baseUnitId || details.units[0]?.value || "")
    }
    if (!form.getValues(`lines.${index}.locationId`) && locationOptions[0]) {
      form.setValue(`lines.${index}.locationId`, locationOptions[0].value)
    }
  }

  return (
    <FormShell
      title={isEdit ? t("form.editTitle") : t("form.title")}
      description={defaults.currency ? `${t("form.description")} ${t("form.currencyNote", { currency: defaults.currency })}` : t("form.description")}
      errorMessage={serverError}
    >
      <form onSubmit={submit(false)} noValidate className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <AsyncComboboxField
            control={form.control}
            name="partyId"
            copy={{ label: t("form.customer"), placeholder: t("form.customerPlaceholder") }}
            comboboxCopy={comboboxCopy}
            source={customerSource}
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
            name="requestedDeliveryDate"
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
            name="customerReference"
            copy={{ label: t("form.customerReference") }}
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
            const itemId = (line as SalesOrderFormLine | undefined)?.itemId ?? ""
            const units = itemId ? (unitMap[itemId] ?? []) : []
            return (
              <>
                <div className="sm:col-span-5">
                  <AsyncComboboxField
                    control={form.control}
                    name={`lines.${index}.locationId` as const}
                    copy={{ label: t("lineFields.location"), placeholder: t("form.locationPlaceholder") }}
                    comboboxCopy={comboboxCopy}
                    source={locationSource}
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
                <div className="sm:col-span-6">
                  <fieldset className="grid gap-2" disabled={disabled}>
                    <legend className="mb-1 text-sm font-medium text-foreground">{t("form.discountMode")}</legend>
                    <Controller
                      control={form.control}
                      name={`lines.${index}.discountMode` as const}
                      render={({ field }) => (
                        <div className="flex flex-wrap items-center gap-4">
                          {(["percent", "amount"] as const).map((mode) => (
                            <label key={mode} className="flex items-center gap-2 text-sm">
                              <input
                                type="radio"
                                className="accent-primary"
                                name={`discount-mode-${index}`}
                                checked={(field.value ?? "percent") === mode}
                                onChange={() => {
                                  field.onChange(mode)
                                  // Only one discount applies: clear the other so it is never sent.
                                  form.setValue(
                                    mode === "percent" ? `lines.${index}.discountAmount` : `lines.${index}.discountRate`,
                                    "0"
                                  )
                                }}
                              />
                              {mode === "percent" ? t("form.discountModePercent") : t("form.discountModeAmount")}
                            </label>
                          ))}
                        </div>
                      )}
                    />
                    {(line as SalesOrderFormLine | undefined)?.discountMode === "amount" ? (
                      <InputField
                        control={form.control}
                        name={`lines.${index}.discountAmount` as const}
                        copy={{ label: t("form.discount") }}
                        type="text"
                        disabled={disabled}
                      />
                    ) : (
                      <InputField
                        control={form.control}
                        name={`lines.${index}.discountRate` as const}
                        copy={{ label: t("form.discountRate") }}
                        type="text"
                        disabled={disabled}
                      />
                    )}
                  </fieldset>
                </div>
                <div className="sm:col-span-3">
                  <InputField
                    control={form.control}
                    name={`lines.${index}.taxRate` as const}
                    copy={{ label: t("form.taxRate") }}
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
            loading={(createMutation.isPending && !confirmMutation.isPending) || updateMutation.isPending}
            label={isEdit ? t("form.update") : t("form.save")}
            loadingLabel={isEdit ? t("form.updating") : t("form.saving")}
          />
          {isEdit ? null : (
            <Button type="button" className="flex-1" disabled={pending} onClick={submit(true)}>
              {t("form.saveConfirm")}
            </Button>
          )}
        </div>
      </form>
    </FormShell>
  )
}
