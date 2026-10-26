import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useQueryClient } from "@tanstack/react-query"
import { UsersErrorCode } from "@avuny/contracts/user"

import { useUpdateMe, getGetMeQueryKey } from "@/api"
import { useAuthenticatedHandler } from "@/features/auth"
import {
  parseApiError,
  resolveErrorMessage,
} from "@/features/auth/lib/api-error"
import {
  PersonalInfoForm,
  type PersonalInfoCopy,
  type PersonalInfoFormValues,
} from "./personal-info-form"

export type PersonalInfoProps = {
  onSuccess?: () => void
}

// Container: logic, API mutations, copy wiring. No form markup, no navigation.
export function PersonalInfo({ onSuccess }: PersonalInfoProps) {
  const { t } = useTranslation("user")
  const queryClient = useQueryClient()
  const { data: authData } = useAuthenticatedHandler()
  const updateMeMutation = useUpdateMe()

  const [serverError, setServerError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const copy: PersonalInfoCopy & { errors: Record<string, string> } = {
    title: t("settings.personalInfo.title"),
    description: t("settings.personalInfo.description"),
    name: {
      label: t("settings.personalInfo.name.label"),
      placeholder: t("settings.personalInfo.name.placeholder"),
    },
    identifier: {
      label: t("settings.personalInfo.identifier.label"),
    },
    submitLabel: t("settings.personalInfo.submitLabel"),
    submittingLabel: t("settings.personalInfo.submittingLabel"),
    successMessage: t("settings.personalInfo.successMessage"),
    errors: {
      fallback: t("settings.personalInfo.errors.fallback"),
      [UsersErrorCode.IDENTIFIER_NOT_FOUND]: t(
        "settings.personalInfo.errors.IDENTIFIER_NOT_FOUND"
      ),
    },
  }

  const handleSubmit = async (values: PersonalInfoFormValues) => {
    setServerError(null)
    setSuccessMessage(null)

    try {
      await updateMeMutation.mutateAsync({ data: values })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["getAuthenticatedUser"] }),
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() }),
      ])
      setSuccessMessage(copy.successMessage)
      onSuccess?.()
    } catch (e) {
      const parsed = parseApiError(e)
      setServerError(
        resolveErrorMessage(parsed, {
          fallback: copy.errors.fallback,
          [UsersErrorCode.IDENTIFIER_NOT_FOUND]:
            copy.errors[UsersErrorCode.IDENTIFIER_NOT_FOUND],
        })
      )
    }
  }

  const currentUser = authData?.data

  return (
    <div className="w-full max-w-xl">
      <PersonalInfoForm
        copy={copy}
        onSubmit={handleSubmit}
        isPending={updateMeMutation.isPending}
        defaultName={currentUser?.name ?? ""}
        identifier={currentUser?.identifier}
        errorMessage={serverError}
        successMessage={successMessage}
      />
    </div>
  )
}
