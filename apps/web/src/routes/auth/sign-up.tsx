import { signUpCopy } from "@/features/auth/sign-up/copy"
import { SignUpFlow } from "@/features/auth/sign-up/sign-up-flow"
import { createFileRoute, useRouter } from "@tanstack/react-router"
import type { AppRouter } from "@workspace/ui/blocks/types"
import { useMemo } from "react"
export const Route = createFileRoute("/auth/sign-up")({ component: SignUp })

function SignUp() {
  const tsRouter = useRouter()

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
      errorMessages={{ fallback: "Something went wrong. Please try again." }}
      redirectTo="/"
      proofExpiredMessage="Your verification expired. Please start again."
      maxResends={5}
    />
  )
}
