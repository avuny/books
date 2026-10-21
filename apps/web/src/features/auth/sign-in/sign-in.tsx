import type { AppRouter, ErrorMessages } from "@workspace/ui/blocks/types"
import { useSignInForm, type AuthResponse } from "./hooks/use-sign-in"
import { SignInForm } from "./ui/sign-in-form"
import type { SignInCopy } from "./types"

export type SignInProps = {
  router: AppRouter
  copy: SignInCopy
  errorMessages: ErrorMessages
  /** Where to go after a successful sign in. */
  redirectTo: string
  /** Where the "Sign up" link goes. */
  signUpHref: string
  /** Store the access token / hydrate the session here. */
  onAuthenticated?: (auth: AuthResponse) => void
  onSuccess?: (data: { data: AuthResponse }) => void
}

export function SignIn({
  router,
  copy,
  errorMessages,
  redirectTo,
  signUpHref,
  onAuthenticated,
  onSuccess,
}: SignInProps) {
  const step = useSignInForm({
    router,
    redirectTo,
    errorMessages,
    onAuthenticated,
    onSuccess,
  })

  return (
    <div className="mx-auto w-full max-w-sm">
      <SignInForm
        form={step.form}
        onSubmit={step.onSubmit}
        onSignUp={() => router.push(signUpHref)}
        isSubmitting={step.isSubmitting}
        errorMessage={step.errorMessage}
        copy={copy}
      />
    </div>
  )
}
