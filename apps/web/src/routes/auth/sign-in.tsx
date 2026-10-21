import { useMemo } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import type { AppRouter } from "@workspace/ui/blocks/types"
import {
  SignIn,
  signInCopy,
  signInErrors,
  useAuthSuccessHandler,
} from "@/features/auth"

export const Route = createFileRoute("/auth/sign-in")({ component: SignInPage })

function SignInPage() {
  const tsRouter = useRouter()
  const handleAuthSuccess = useAuthSuccessHandler()

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
      copy={signInCopy}
      errorMessages={signInErrors}
      redirectTo="/"
      signUpHref="/auth/sign-up"
      onSuccess={(data) => handleAuthSuccess(data, { redirectTo: "/" })}
    />
  )
}
