import { useMemo } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import type { AppRouter } from "@workspace/ui/blocks/types"
import {
  SignUpFlow,
  useSignUpCopy,
  useSignUpErrors,
  useAuthSuccessHandler,
} from "@/features/auth"

export const Route = createFileRoute("/auth/sign-up")({ component: SignUp })

function SignUp() {
  const tsRouter = useRouter()
  const handleAuthSuccess = useAuthSuccessHandler()
  const copy = useSignUpCopy()
  const errorMessages = useSignUpErrors()

  // Adapter: the feature only knows AppRouter, never TanStack.
  const router = useMemo<AppRouter>(
    () => ({
      push: (href) => void tsRouter.navigate({ to: href }),
      replace: (href) => void tsRouter.navigate({ to: href, replace: true }),
    }),
    [tsRouter]
  )

  return (
    <SignUpFlow
      router={router}
      copy={copy}
      errorMessages={errorMessages}
      redirectTo="/"
      proofExpiredMessage={errorMessages.proofExpired ?? errorMessages.fallback}
      maxResends={5}
      onSuccess={(data) => handleAuthSuccess(data, { redirectTo: "/" })}
    />
  )
}
