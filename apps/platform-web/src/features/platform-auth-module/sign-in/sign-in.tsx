import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { parseApiError } from "@workspace/ui/lib/api-error"

import { usePlatformLogin, usePlatformLoginTotp } from "@/api"

import { SignInForm, type SignInFormValues } from "./sign-in-form"
import { TotpForm, type TotpFormValues } from "./totp-form"

type SignInProps = {
  /** The route decides where a successful sign-in lands. */
  onSuccess: () => void
}

// Two-step admin sign-in (PLATFORM-ADMIN-SPEC 3.2): email + password exchange
// for a single-use pending ticket, then the TOTP code signs in. Composition
// only: strings + API behavior wired into the pure forms.
export function SignIn({ onSuccess }: SignInProps) {
  const { t } = useTranslation("platform-admin")
  const queryClient = useQueryClient()
  const [pendingToken, setPendingToken] = useState<string | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)

  const loginMutation = usePlatformLogin()
  const totpMutation = usePlatformLoginTotp()

  const handleCredentials = async (values: SignInFormValues) => {
    setServerError(null)
    try {
      const res = await loginMutation.mutateAsync({ data: values })
      setPendingToken(res.data.pendingToken)
    } catch (e) {
      setServerError(
        parseApiError(e).message || t("auth.signIn.genericError")
      )
    }
  }

  const handleTotp = async (values: TotpFormValues) => {
    if (!pendingToken) return
    setServerError(null)
    try {
      await totpMutation.mutateAsync({
        data: { pendingToken, code: values.code },
      })
      await queryClient.invalidateQueries()
      onSuccess()
    } catch (e) {
      setServerError(parseApiError(e).message || t("auth.signIn.genericError"))
    }
  }

  return (
    <div className="mx-auto w-full max-w-sm">
      {pendingToken === null ? (
        <SignInForm
          copy={{
            title: t("auth.signIn.title"),
            description: t("auth.signIn.description"),
            email: {
              label: t("auth.signIn.email.label"),
              placeholder: t("auth.signIn.email.placeholder"),
            },
            password: {
              label: t("auth.signIn.password.label"),
              placeholder: t("auth.signIn.password.placeholder"),
            },
            submitLabel: t("auth.signIn.submitLabel"),
            submittingLabel: t("auth.signIn.submittingLabel"),
          }}
          onSubmit={handleCredentials}
          isPending={loginMutation.isPending}
          errorMessage={serverError}
        />
      ) : (
        <TotpForm
          copy={{
            title: t("auth.totp.title"),
            description: t("auth.totp.description"),
            code: {
              label: t("auth.totp.code.label"),
              placeholder: t("auth.totp.code.placeholder"),
            },
            submitLabel: t("auth.totp.submitLabel"),
            submittingLabel: t("auth.totp.submittingLabel"),
            backLabel: t("auth.totp.backLabel"),
          }}
          onSubmit={handleTotp}
          onBack={() => {
            setPendingToken(null)
            setServerError(null)
          }}
          isPending={totpMutation.isPending}
          errorMessage={serverError}
        />
      )}
    </div>
  )
}
