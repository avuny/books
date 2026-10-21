import { useState, type ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { LanguageProvider } from "@/providers/langauge-provider"
import { ThemeProvider } from "@workspace/ui/providers/theme-provider"
import { Toaster } from "@workspace/ui/components/sonner"
export function AppProviders({ children }: { children: ReactNode }) {
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
          {children}
          <Toaster />
        </ThemeProvider>
      </LanguageProvider>
    </QueryClientProvider>
  )
}
