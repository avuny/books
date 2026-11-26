import { createFileRoute } from "@tanstack/react-router"

import { InvitationList } from "@/features/invitation-module"

export const Route = createFileRoute("/organization/$orgId/invitations/")({
  component: InvitationsPage,
})

function InvitationsPage() {
  const { orgId } = Route.useParams()

  return <InvitationList orgId={orgId} />
}
