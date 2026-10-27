import { Outlet, createRootRoute } from "@tanstack/react-router"

export const Route = createRootRoute({
  component: () => <Outlet />,
  notFoundComponent: () => <p className="p-6">Page not found.</p>,
})
