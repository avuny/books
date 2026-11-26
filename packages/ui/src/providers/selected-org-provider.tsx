import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import { CookiesProvider, useCookies } from "react-cookie"

export const getCookieConfig = () => {
  const proc = (
    globalThis as unknown as {
      process?: { env?: Record<string, string | undefined> }
    }
  ).process

  const isProduction =
    proc?.env?.NODE_ENV === "production" ||
    (typeof import.meta !== "undefined" &&
      (import.meta as unknown as { env?: { PROD?: boolean } }).env?.PROD ===
        true)

  const domain = proc?.env?.NEXT_PUBLIC_COOKIE_DOMAIN || undefined

  return {
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
    sameSite: "lax" as const,
    secure: Boolean(isProduction),
    ...(domain ? { domain } : {}),
  }
}

export const cookieConfig = getCookieConfig()

export interface SelectedOrganizationContext {
  selectedOrganizationId: string | undefined
  setSelectedOrganizationId: (selectedOrganizationId: string) => void
  clearSelectedOrganizationId: () => void
}

export const selectedOrganizationContext =
  createContext<SelectedOrganizationContext>({
    selectedOrganizationId: undefined,
    setSelectedOrganizationId: () => {},
    clearSelectedOrganizationId: () => {},
  })

function SelectedOrganizationInnerProvider({
  children,
}: {
  children: ReactNode
}) {
  const [cookies, setCookie, removeCookie] = useCookies([
    "selectedOrganizationId",
  ])
  const [selectedOrganizationId, setSelectedOrganizationState] = useState<
    string | undefined
  >(cookies.selectedOrganizationId || undefined)

  useEffect(() => {
    setSelectedOrganizationState(cookies.selectedOrganizationId || undefined)
  }, [cookies.selectedOrganizationId])

  const handleSetSelected = (id: string) => {
    const config = getCookieConfig()
    setCookie("selectedOrganizationId", id, config)
    setSelectedOrganizationState(id)
  }

  const handleClearSelected = () => {
    const config = getCookieConfig()
    removeCookie("selectedOrganizationId", config)
    setSelectedOrganizationState(undefined)
  }

  return (
    <selectedOrganizationContext.Provider
      value={{
        selectedOrganizationId,
        setSelectedOrganizationId: handleSetSelected,
        clearSelectedOrganizationId: handleClearSelected,
      }}
    >
      {children}
    </selectedOrganizationContext.Provider>
  )
}

export function SelectedOrganizationContextProvider({
  children,
}: {
  children: ReactNode
}) {
  return (
    <CookiesProvider>
      <SelectedOrganizationInnerProvider>
        {children}
      </SelectedOrganizationInnerProvider>
    </CookiesProvider>
  )
}

export const SelectedOrgProvider = SelectedOrganizationContextProvider

export default SelectedOrganizationContextProvider

export function useSelectedOrganizationContext() {
  const context = useContext(selectedOrganizationContext)
  if (context === undefined) {
    throw new Error(
      "useSelectedOrganizationContext must be used within SelectedOrganizationContextProvider"
    )
  }
  return context
}

export function useSelectedOrganizationId(): string | undefined {
  return useSelectedOrganizationContext().selectedOrganizationId
}
