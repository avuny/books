import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { SignIn } from "@/features/platform-auth-module"

export const Route = createFileRoute("/sign-in")({
  component: SignInPage,
})

function SignInPage() {
  const navigate = useNavigate()
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-6">
      <SignIn onSuccess={() => void navigate({ to: "/admins" })} />
    </main>
  )
}
