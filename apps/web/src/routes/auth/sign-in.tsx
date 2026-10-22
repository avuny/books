import { useMemo } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import type { AppRouter } from "@workspace/ui/blocks/types"
import {
  SignIn,
  useSignInCopy,
  useSignInErrors,
  useAuthSuccessHandler,
} from "@/features/auth"

export const Route = createFileRoute("/auth/sign-in")({ component: SignInPage })

function SignInPage() {
  const tsRouter = useRouter()
  const handleAuthSuccess = useAuthSuccessHandler()
  const copy = useSignInCopy()
  const errorMessages = useSignInErrors()

  const router = useMemo<AppRouter>(
    () => ({
      push: (href) => void tsRouter.navigate({ to: href }),
      replace: (href) => void tsRouter.navigate({ to: href, replace: true }),
    }),
    [tsRouter]
  )

  return (
    <SignIn
      router={router}
      copy={copy}
      errorMessages={errorMessages}
      redirectTo="/"
      signUpHref="/auth/sign-up"
      onSuccess={(data) => handleAuthSuccess(data, { redirectTo: "/" })}
    />
  )
}
