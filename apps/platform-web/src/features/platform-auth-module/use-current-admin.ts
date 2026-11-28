import { usePlatformMe } from "@/api"

/**
 * The signed-in platform admin and their effective permissions (PA-R7: the
 * server is still the authority; the UI only hides what the admin lacks).
 */
export function useCurrentAdmin() {
  const query = usePlatformMe({
    query: { retry: false, staleTime: 60_000 },
  })

  const admin = query.data?.data ?? null
  return {
    admin,
    isPending: query.isPending,
    isAuthenticated: admin !== null,
    hasPermission: (permission: string): boolean =>
      admin?.permissions.includes(permission) ?? false,
  }
}
