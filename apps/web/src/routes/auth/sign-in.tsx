import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { SignIn } from "@/features/auth"

export const Route = createFileRoute("/auth/sign-in")({ component: SignInPage })

function SignInPage() {
  const navigate = useNavigate()

  return (
    <SignIn
      onClickOnSignUpButton={() => navigate({ to: "/auth/sign-up" })}
      onSuccess={() => navigate({ to: "/" })}
    />
  )
}
