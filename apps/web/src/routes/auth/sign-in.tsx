import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { SignIn } from "@/features/auth"
import { ROUTES } from "@/features/routes"

export const Route = createFileRoute("/auth/sign-in")({ component: SignInPage })

function SignInPage() {
  const navigate = useNavigate()

  return (
    <SignIn
      onClickOnSignUpButton={() => navigate({ to: "/auth/sign-up" })}
      onClickOnForgotPasswordButton={() =>
        navigate({ to: "/auth/forgot-password" })
      }
      onSuccess={() => navigate({ to: ROUTES.app.main })}
    />
  )
}
