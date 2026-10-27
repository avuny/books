import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { SignUpFlow } from "@/features/auth"
import { ROUTES } from "@/features/routes"

export const Route = createFileRoute("/auth/sign-up")({ component: SignUpPage })

function SignUpPage() {
  const navigate = useNavigate()

  return (
    <SignUpFlow
      maxResends={5}
      onClickOnSignInButton={() => navigate({ to: "/auth/sign-in" })}
      onSuccess={() => navigate({ to: ROUTES.app.main, replace: true })}
    />
  )
}
