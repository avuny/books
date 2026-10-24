import { createFileRoute } from "@tanstack/react-router"

import {
  SignIn,
  useSignInCopy,
  useSignInErrors,
  useAuthSuccessHandler,
} from "@/features/auth"

export const Route = createFileRoute("/auth/sign-in")({ component: SignInPage })

function SignInPage() {
  const handleAuthSuccess = useAuthSuccessHandler()
  const copy = useSignInCopy()
  const errorMessages = useSignInErrors()

  return (
    <SignIn
      copy={copy}
      errorMessages={errorMessages}
      redirectTo="/"
      signUpHref="/auth/sign-up"
      onSuccess={(data) => handleAuthSuccess(data, { redirectTo: "/" })}
    />
  )
}
