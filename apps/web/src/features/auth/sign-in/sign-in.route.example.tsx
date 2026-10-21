import { createFileRoute, useRouter } from "@tanstack/react-router"
import { useMemo } from "react"
import type { AppRouter } from "@workspace/ui/blocks/types"
import { SignIn, signInCopy, signInErrors } from "@/features/auth"

export const Route = createFileRoute("/sign-in")({ component: SignInPage })

function SignInPage() {
  const tsRouter = useRouter()

  const router = useMemo<AppRouter>(
    () => ({
      push: (href) => void tsRouter.navigate({ to: href }),
      replace: (href) => void tsRouter.navigate({ to: href, replace: true }),
    }),
    [tsRouter]
  )

  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-6">
      <SignIn
        router={router}
        copy={signInCopy}
        errorMessages={signInErrors}
        redirectTo="/"
        signUpHref="/sign-up"
      />
    </main>
  )
}
