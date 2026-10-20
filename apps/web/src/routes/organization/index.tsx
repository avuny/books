import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"

export const Route = createFileRoute("/organization/")({
  component: OrganizationPage,
})

const ORGS = ["acme", "globex"]

function OrganizationPage() {
  const navigate = useNavigate()
  return (
    <div className="space-y-3 p-6">
      <h1 className="text-xl font-semibold">Your organizations</h1>
      <ul className="list-disc pl-5">
        {ORGS.map((orgId) => (
          <li key={orgId}>
            <Link
              to="/organization/$orgId"
              params={{ orgId }}
              className="underline"
            >
              {orgId}
            </Link>
          </li>
        ))}
      </ul>
      <button
        className="rounded border px-3 py-1.5 text-sm"
        onClick={() => {
          // fakeSignOut()
          navigate({ to: "/auth/sign-in" })
        }}
      >
        Sign out
      </button>
    </div>
  )
}
