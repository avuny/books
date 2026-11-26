import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { ForgotPasswordFlow } from "@/features/auth"

export const Route = createFileRoute("/auth/forgot-password")({
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  const navigate = useNavigate()

  return (
    <ForgotPasswordFlow
      maxResends={5}
      onSuccess={() => navigate({ to: "/auth/sign-in", replace: true })}
    />
  )
}
