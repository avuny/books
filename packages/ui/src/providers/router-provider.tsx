import type { AppRouter } from "@workspace/ui/blocks/types"
import { createContext, useContext, type ReactNode } from "react"

const AppRouterContext = createContext<AppRouter<never> | null>(null)

type AppRouterProviderProps<TPath extends string> = Readonly<{
  router: AppRouter<TPath>
  children: ReactNode
}>

export function AppRouterProvider<TPath extends string>({
  router,
  children,
}: AppRouterProviderProps<TPath>) {
  return (
    <AppRouterContext.Provider value={router as unknown as AppRouter<never>}>
      {children}
    </AppRouterContext.Provider>
  )
}

export function useAppRouter<TPath extends string = string>() {
  const router = useContext(AppRouterContext)

  if (!router) {
    throw new Error("useAppRouter must be used within AppRouterProvider")
  }

  return router as unknown as AppRouter<TPath>
}
