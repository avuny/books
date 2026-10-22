import { useMemo } from "react"
import type { AppRouter } from "@workspace/ui/blocks/types"
import { SignIn, useSignInCopy, useSignInErrors } from "@/features/auth"

export function ExampleSignInPage() {
  const router = useMemo<AppRouter>(
    () => ({
      push: () => {},
      replace: () => {},
    }),
    []
  )
  const copy = useSignInCopy()
  const errorMessages = useSignInErrors()

  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-6">
      <SignIn
        router={router}
        copy={copy}
        errorMessages={errorMessages}
        redirectTo="/"
        signUpHref="/sign-up"
      />
    </main>
  )
}

