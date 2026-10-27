import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import type { OrganizationDto } from "@avuny/contracts/organization"

import {
  useCreateOrganization,
  useListCountries,
  useListStates,
  useListCurrencies,
  useListTimezones,
} from "@/api"
import { useAuthenticatedHandler } from "@/features/auth"
import { useSelectedOrganizationContext } from "@workspace/ui/providers/selected-org-provider"
import { parseApiError } from "@/features/auth/lib/api-error"
import {
  CreateOrganizationForm,
  type CreateOrganizationCopy,
  type CreateOrganizationFormValues,
} from "./create-organization-form"

type CreateOrganizationProps = {
  onSuccess?: (data: OrganizationDto) => void
  onClickOnCancelButton?: () => void
}

export function CreateOrganization({
  onSuccess,
  onClickOnCancelButton,
}: CreateOrganizationProps) {
  const { t } = useTranslation("organization")
  const { setSelectedOrganizationId } = useSelectedOrganizationContext()
  const createMutation = useCreateOrganization()
  const { data: authData } = useAuthenticatedHandler()

  const [selectedCountryCode, setSelectedCountryCode] = useState<
    string | undefined
  >()
  const [serverError, setServerError] = useState<string | null>(null)

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

  const copy: CreateOrganizationCopy = {
    title: t("create.title"),
    description: t("create.description"),
    name: {
      label: t("create.name.label"),
      placeholder: t("create.name.placeholder"),
    },
    code: {
      label: t("create.code.label"),
      placeholder: t("create.code.placeholder"),
      description: t("create.code.description"),
    },
    countryCode: {
      label: t("create.countryCode.label"),
      placeholder: t("create.countryCode.placeholder"),
    },
    stateId: {
      label: t("create.stateId.label"),
      placeholder: t("create.stateId.placeholder"),
    },
    stateDisabledPlaceholder: t("create.stateDisabledPlaceholder"),
    defaultCurrency: {
      label: t("create.defaultCurrency.label"),
      placeholder: t("create.defaultCurrency.placeholder"),
    },
    timezone: {
      label: t("create.timezone.label"),
      placeholder: t("create.timezone.placeholder"),
    },
    ownerUsername: {
      label: t("create.ownerUsername.label"),
      placeholder: t("create.ownerUsername.placeholder"),
      description: t("create.ownerUsername.description"),
    },
    submitLabel: t("create.submitLabel"),
    submittingLabel: t("create.submittingLabel"),
    cancelLabel: onClickOnCancelButton ? t("create.cancelLabel") : undefined,
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

  const handleSubmit = async (values: CreateOrganizationFormValues) => {
    setServerError(null)
    try {
      const response = await createMutation.mutateAsync({ data: values })
      const org = response.data
      setSelectedOrganizationId(org.id)
      onSuccess?.(org)
    } catch (e) {
      const parsed = parseApiError(e)
      setServerError(parsed.message || t("errors.fallback"))
    }
  }

  const defaultOwnerUsername =
    authData?.data?.name || (authData?.data?.identifier?.split("@")[0] ?? "")

  return (
    <div className="mx-auto w-full max-w-2xl">
      <CreateOrganizationForm
        copy={copy}
        countryOptions={countryOptions}
        stateOptions={stateOptions}
        currencyOptions={currencyOptions}
        timezoneOptions={timezoneOptions}
        selectedCountryCode={selectedCountryCode}
        onCountryChange={setSelectedCountryCode}
        onSubmit={handleSubmit}
        onClickOnCancelButton={onClickOnCancelButton}
        isPending={createMutation.isPending}
        errorMessage={serverError}
        defaultOwnerUsername={defaultOwnerUsername}
      />
    </div>
  )
}
