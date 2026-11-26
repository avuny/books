import { useGetMe } from "@/api/index"

export const useAuthenticatedHandler = () => {
  return useGetMe({
    query: {
      queryKey: ["getAuthenticatedUser"],
      retry: 1,

      // Cache settings
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (cache retention)
    },
  })
}
