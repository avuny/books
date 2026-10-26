"use client"

import { useNavigate } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import UserButton, {
  type UserButtonProps,
  type UserButtonCopy,
} from "@workspace/ui/blocks/buttons/user-btn"
import { useSignOut } from "@/api"
import { useAuthenticatedHandler } from "@/features/auth"
import { ROUTES } from "@/features/routes"

export type UserButtonContainerProps = Partial<UserButtonProps>

export function UserButtonContainer({
  user: propUser,
  isLoading: propIsLoading,
  onClick,
  onAccountClick,
  onNotificationsClick,
  copy: propCopy,
  useSignOutHandler: propUseSignOutHandler,
}: UserButtonContainerProps) {
  const navigate = useNavigate()
  const { t } = useTranslation("user")

  const auth = useAuthenticatedHandler()
  const { mutateAsync: signOut, isPending } = useSignOut({})

  const defaultSignOutHandler = () => ({
    submit: async () => {
      await signOut()
    },
    isPending,
  })

  const user = propUser !== undefined ? propUser : auth.data?.data
  const isLoading = propIsLoading !== undefined ? propIsLoading : auth.isLoading
  const useSignOutHandler = propUseSignOutHandler ?? defaultSignOutHandler

  const copy: UserButtonCopy = {
    account: propCopy?.account ?? t("menu.account"),
    notifications: propCopy?.notifications ?? t("menu.notifications"),
    logout: propCopy?.logout ?? t("menu.logout"),
  }

  const handleSignIn = () => {
    if (onClick) {
      onClick()
    } else {
      void navigate({ to: ROUTES.auth.index })
    }
  }

  const handleAccount = () => {
    if (onAccountClick) {
      onAccountClick()
    } else {
      void navigate({ to: ROUTES.user.settings })
    }
  }

  return (
    <UserButton
      user={user}
      isLoading={isLoading}
      onClick={handleSignIn}
      onAccountClick={handleAccount}
      onNotificationsClick={onNotificationsClick}
      copy={copy}
      useSignOutHandler={useSignOutHandler}
    />
  )
}

export default UserButtonContainer
