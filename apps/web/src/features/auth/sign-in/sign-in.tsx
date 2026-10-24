import type { ErrorMessages } from "@workspace/ui/blocks/types"
import { useSignInForm, type AuthResponse } from "./hooks/use-sign-in"
import { SignInForm } from "./ui/sign-in-form"
import type { SignInCopy } from "./types"
import { useAppRouter } from "@workspace/ui/providers/router-provider"
export type SignInProps<TPath extends string> = {
  copy: SignInCopy
  errorMessages: ErrorMessages
  /** Where to go after a successful sign in. */
  redirectTo: TPath
  /** Where the "Sign up" link goes. */
  signUpHref: TPath
  /** Store the access token / hydrate the session here. */
  onAuthenticated?: (auth: AuthResponse) => void
  onSuccess?: (data: { data: AuthResponse }) => void
}

export function SignIn<TPath extends string>({
  copy,
  errorMessages,
  redirectTo,
  signUpHref,
  onAuthenticated,
  onSuccess,
}: SignInProps<TPath>) {
  const _router = useAppRouter<TPath>()
  const step = useSignInForm<TPath>({
    router: _router,
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
        onSignUp={() => _router.push(signUpHref)}
        isSubmitting={step.isSubmitting}
        errorMessage={step.errorMessage}
        copy={copy}
      />
    </div>
  )
}
