import { useState } from "react"
import { useAuthSuccessHandler } from "@/features/auth"
import { SignInForm, type SignInFormValues } from "./sign-in-form"
import { useSignIn, } from "@/api"
import { useTranslation } from "react-i18next"
import { parseApiError } from "../lib/api-error"
import type { AuthResponse } from "@avuny/contracts"

type SignInProps = {
  /** Where the "Sign up" link goes. The route decides how to navigate. */
  onClickOnSignUpButton: () => void
  onSuccess?: (data: AuthResponse) => void
}

// Composition only: strings + API behavior wired into the pure form.
export function SignIn({ onClickOnSignUpButton, onSuccess }: SignInProps) {
  const handleAuthSuccess = useAuthSuccessHandler()
  const [serverError, setServerError] = useState<string | null>(null)

  const signInMutation = useSignIn()
  const { t } = useTranslation("user")



  const copy = {
    title: t("auth.signIn.title"),
    description: t("auth.signIn.description"),
    identifier: {
      label: t("auth.signIn.identifier.label"),
      placeholder: t("auth.signIn.identifier.placeholder"),
    },
    password: {
      label: t("auth.signIn.password.label"),
      placeholder: t("auth.signIn.password.placeholder"),
    },
    submitLabel: t("auth.signIn.submitLabel"),
    submittingLabel: t("auth.signIn.submittingLabel"),
    signUpPrompt: t("auth.signIn.signUpPrompt"),
    signUpLabel: t("auth.signIn.signUpLabel"),
  }

  // Called only when Zod validation passes (react-hook-form guards the fields).
  const handleSubmit = async (values: SignInFormValues) => {
    setServerError(null)
    try {
      const data = await signInMutation.mutateAsync({ data: values })
      handleAuthSuccess(data)
      onSuccess?.(data.data)
    } catch (e) {
      const parsed = parseApiError(e)
      setServerError(parsed.message || null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-sm">
      <SignInForm
        copy={copy}
        onSubmit={handleSubmit}
        onClickOnSignUpButton={onClickOnSignUpButton}
        isPending={signInMutation.isPending}
        errorMessage={serverError}
      />
    </div>
  )
}
