import { SignInForm } from "./sign-in-form"
import { useSignInCopy, useSignInErrors } from "./sign-in-copy"
import { useSignInMutation } from "./sign-in-mutation"

type SignInProps = {
  /** Where the "Sign up" link goes. The route decides how to navigate. */
  onClickOnSignUpButton: () => void
}

// Composition only: strings + API behavior wired into the pure form.
export function SignIn({ onClickOnSignUpButton }: SignInProps) {
  const copy = useSignInCopy()
  const { submit, isPending, errorMessage } =
    useSignInMutation(useSignInErrors())

  return (
    <div className="mx-auto w-full max-w-sm">
      <SignInForm
        copy={copy}
        onSubmit={submit}
        onClickOnSignUpButton={onClickOnSignUpButton}
        isPending={isPending}
        errorMessage={errorMessage}
      />
    </div>
  )
}
