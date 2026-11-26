import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useQueryClient } from "@tanstack/react-query"

import {
  useGetOrganization,
  useUpdateOrganization,
  useListCountries,
  useListStates,
  useListCurrencies,
  useListTimezones,
  getGetOrganizationQueryKey,
} from "@/api"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { parseApiError } from "@/features/auth/lib/api-error"
import {
  UpdateOrganizationForm,
  type UpdateOrganizationCopy,
  type UpdateOrganizationFormValues,
} from "./update-organization-form"

type UpdateOrganizationProps = {
  orgId: string
  onSuccess?: () => void
}

export function UpdateOrganization({
  orgId,
  onSuccess,
}: UpdateOrganizationProps) {
  const { t } = useTranslation("organization")
  const queryClient = useQueryClient()

  const orgQuery = useGetOrganization(orgId)
  const updateMutation = useUpdateOrganization()

  const organization = orgQuery.data?.data

  const [selectedCountryCode, setSelectedCountryCode] = useState<
    string | undefined
  >(organization?.countryCode || undefined)
  const [serverError, setServerError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    if (organization?.countryCode) {
      setSelectedCountryCode(organization.countryCode)
    }
  }, [organization?.countryCode])

  // Geo queries
  const countriesQuery = useListCountries()
  const statesQuery = useListStates(
    { countryCode: selectedCountryCode },
    { query: { enabled: Boolean(selectedCountryCode) } }
  )
  const currenciesQuery = useListCurrencies()
  const timezonesQuery = useListTimezones(
    selectedCountryCode ? { countryCode: selectedCountryCode } : undefined
  )

  const copy: UpdateOrganizationCopy = {
    title: t("update.title"),
    description: t("update.description"),
    code: {
      label: t("update.code.label"),
      description: t("update.code.description"),
    },
    name: {
      label: t("update.name.label"),
      placeholder: t("update.name.placeholder"),
    },
    countryCode: {
      label: t("update.countryCode.label"),
      placeholder: t("update.countryCode.placeholder"),
    },
    stateId: {
      label: t("update.stateId.label"),
      placeholder: t("update.stateId.placeholder"),
    },
    stateDisabledPlaceholder: t("update.stateDisabledPlaceholder"),
    defaultCurrency: {
      label: t("update.defaultCurrency.label"),
      placeholder: t("update.defaultCurrency.placeholder"),
    },
    timezone: {
      label: t("update.timezone.label"),
      placeholder: t("update.timezone.placeholder"),
    },
    status: {
      label: t("update.status.label"),
    },
    submitLabel: t("update.submitLabel"),
    submittingLabel: t("update.submittingLabel"),
    successMessage: t("update.successMessage"),
  }

  const countryOptions = useMemo(() => {
    const items = countriesQuery.data?.data ?? []
    return items.map((c) => ({
      value: c.code,
      label: c.emoji ? `${c.emoji} ${c.name}` : c.name,
    }))
  }, [countriesQuery.data?.data])

  const stateOptions = useMemo(() => {
    const items = statesQuery.data?.data ?? []
    return items.map((s) => ({
      value: s.id,
      label: s.name,
    }))
  }, [statesQuery.data?.data])

  const currencyOptions = useMemo(() => {
    const items = currenciesQuery.data?.data ?? []
    return items.map((cur) => ({
      value: cur.code,
      label: `${cur.code} - ${cur.name} ${cur.symbol ? `(${cur.symbol})` : ""}`,
    }))
  }, [currenciesQuery.data?.data])

  const timezoneOptions = useMemo(() => {
    const items = timezonesQuery.data?.data ?? []
    return items.map((tz) => ({
      value: tz.name,
      label: tz.name,
    }))
  }, [timezonesQuery.data?.data])

  const handleSubmit = async (values: UpdateOrganizationFormValues) => {
    setServerError(null)
    setSuccessMessage(null)

    try {
      await updateMutation.mutateAsync({
        id: orgId,
        data: values,
      })

      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: getGetOrganizationQueryKey(orgId),
        }),
        queryClient.invalidateQueries({ queryKey: ["/api/organizations"] }),
      ])

      setSuccessMessage(copy.successMessage ?? null)
      onSuccess?.()
    } catch (e) {
      const parsed = parseApiError(e)
      setServerError(parsed.message || t("errors.fallback"))
    }
  }

  if (orgQuery.isLoading) {
    return (
      <div className="w-full max-w-2xl space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    )
  }

  if (!organization) {
    return (
      <div className="w-full max-w-2xl rounded-xl border border-destructive/20 bg-destructive/10 p-6 text-center text-destructive">
        <p className="font-semibold">{t("errors.ORGANIZATION_NOT_FOUND")}</p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-2xl">
      <UpdateOrganizationForm
        copy={copy}
        code={organization.code}
        status={organization.status}
        countryOptions={countryOptions}
        stateOptions={stateOptions}
        currencyOptions={currencyOptions}
        timezoneOptions={timezoneOptions}
        selectedCountryCode={selectedCountryCode}
        onCountryChange={setSelectedCountryCode}
        onSubmit={handleSubmit}
        isPending={updateMutation.isPending}
        errorMessage={serverError}
        successMessage={successMessage}
        defaultValues={{
          name: organization.name,
          countryCode: organization.countryCode,
          stateId: organization.stateId,
          defaultCurrency: organization.defaultCurrency,
          timezone: organization.timezone,
        }}
      />
    </div>
  )
}
