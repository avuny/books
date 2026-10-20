import { Link, createFileRoute, useNavigate } from "@tanstack/react-router"
// import { fakeSignIn } from '@/features/auth'

export const Route = createFileRoute("/auth/sign-in")({ component: SignIn })

function SignIn() {
  const navigate = useNavigate()
  return (
    <>
      <h1 className="text-lg font-semibold">Sign in</h1>
      <button
        className="w-full rounded bg-neutral-900 px-3 py-2 text-white"
        onClick={() => {
          // fakeSignIn()
          navigate({ to: "/organization" })
        }}
      >
        Sign in
      </button>
      <Link to="/auth/sign-up" className="block text-sm underline">
        Create an account
      </Link>
    </>
  )
}
