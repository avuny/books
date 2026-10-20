import { Link, Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/organization/$orgId')({ component: OrgLayout })

function OrgLayout() {
  const { orgId } = Route.useParams()
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <nav className="flex gap-4 border-b bg-white px-6 py-3 text-sm">
        <Link to="/organization" className="underline">All organizations</Link>
        <Link
          to="/organization/$orgId"
          params={{ orgId }}
          activeOptions={{ exact: true }}
          activeProps={{ className: 'font-bold' }}
        >
          Overview
        </Link>
        <Link
          to="/organization/$orgId/role"
          params={{ orgId }}
          activeProps={{ className: 'font-bold' }}
        >
          Roles
        </Link>
      </nav>
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
