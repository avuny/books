import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { SignUpFlow } from "@/features/auth"

export const Route = createFileRoute("/auth/sign-up")({ component: SignUpPage })

function SignUpPage() {
  const navigate = useNavigate()

  return (
    <SignUpFlow
      maxResends={5}
      onSuccess={() => navigate({ to: "/", replace: true })}
    />
  )
}
