import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/organization/$orgId/')({ component: OrgPage })

function OrgPage() {
  const { orgId } = Route.useParams()
  return <h1 className="text-xl font-semibold">Organization: {orgId}</h1>
}
