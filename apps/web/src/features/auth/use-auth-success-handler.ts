import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import type { AuthResponse } from "@avuny/contracts/user"

export type AuthSuccessOptions = {
  toastTitle?: (user: AuthResponse["user"]) => string
  toastDescription?: (user: AuthResponse["user"]) => string
  redirectTo?: string
}

export function useAuthSuccessHandler() {
  const { t } = useTranslation()

  return (
    data: { data: AuthResponse },
    options?: AuthSuccessOptions,
  ) => {
    const { tokens, user } = data.data

    localStorage.setItem("accessToken", tokens.accessToken)

    toast.success(
      options?.toastTitle
        ? options.toastTitle(user)
        : t("msgs.welcome", { thing: user.name, defaultValue: t("welcome", { thing: user.name }) }),
      {
        description: options?.toastDescription?.(user),
      },
    )

    window.setTimeout(() => {
      if (options?.redirectTo) {
        window.location.replace(options.redirectTo)
        return
      }

      window.location.reload()
    }, 200)
  }
}
