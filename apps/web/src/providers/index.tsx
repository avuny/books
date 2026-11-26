import { useState } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { RouterProvider, createRouter } from "@tanstack/react-router"

import { LanguageProvider } from "@/providers/langauge-provider"
import { routeTree } from "@/routeTree.gen"
import type { AppRoutePath } from "@/routes/types"

import { ThemeProvider } from "@workspace/ui/providers/theme-provider"
import { AppRouterProvider } from "@workspace/ui/providers/router-provider"
import type { AppRouter } from "@workspace/ui/blocks/types"

import { SelectedOrganizationContextProvider } from "@workspace/ui/providers/selected-org-provider"
import { Toaster } from "@workspace/ui/components/sonner"

// Create the TanStack Router instance once.
const router = createRouter({ routeTree })

// Register TanStack Router's types throughout the application.
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

// Adapt TanStack Router to the shared, router-agnostic contract.
const appRouter = {
  push: (href: AppRoutePath) => {
    void router.navigate({ to: href })
  },

  replace: (href: AppRoutePath) => {
    void router.navigate({ to: href, replace: true })
  },
} satisfies AppRouter<AppRoutePath>

export function AppProviders() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <ThemeProvider>
          <SelectedOrganizationContextProvider>
            <AppRouterProvider router={appRouter}>
              <RouterProvider router={router} />
            </AppRouterProvider>

            <Toaster />
          </SelectedOrganizationContextProvider>
        </ThemeProvider>
      </LanguageProvider>
    </QueryClientProvider>
  )
}
