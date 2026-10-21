import { useMemo } from "react"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import type { AppRouter } from "@workspace/ui/blocks/types"
import {
  SignUpFlow,
  signUpCopy,
  signUpErrors,
  useAuthSuccessHandler,
} from "@/features/auth"

export const Route = createFileRoute("/auth/sign-up")({ component: SignUp })

function SignUp() {
  const tsRouter = useRouter()
  const handleAuthSuccess = useAuthSuccessHandler()

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
      copy={signUpCopy}
      errorMessages={signUpErrors}
      redirectTo="/"
      proofExpiredMessage="Your verification expired. Please start again."
      maxResends={5}
      onSuccess={(data) => handleAuthSuccess(data, { redirectTo: "/" })}
    />
  )
}
