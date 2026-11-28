import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { z } from "@avuny/zod"

import { AcceptInvite } from "@/features/platform-auth-module"

const searchSchema = z.object({
  token: z.string().optional(),
})

export const Route = createFileRoute("/accept-invite")({
  validateSearch: searchSchema,
  component: AcceptInvitePage,
})

function AcceptInvitePage() {
  const navigate = useNavigate()
  const { token } = Route.useSearch()
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-6">
      <AcceptInvite
        token={token ?? ""}
        onSuccess={() => void navigate({ to: "/admins" })}
      />
    </main>
  )
}
