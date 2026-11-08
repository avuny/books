"use client"

import { UserNav } from "@workspace/ui/blocks/layout/nav-user"
import Loading from "@workspace/ui/blocks/loading/loading"
import type { User } from "@workspace/ui/blocks/types"
import { Button } from "@workspace/ui/components/button"
import { LogInIcon } from "lucide-react"

export type UserButtonCopy = {
  account?: string
  notifications?: string
  invitations?: string
  logout?: string
  upgrade?: string
  billing?: string
}

export type UserButtonProps = {
  user: User | undefined
  isLoading: boolean
  onClick: () => void
  onAccountClick?: () => void
  onNotificationsClick?: () => void
  /** The "My invitations" item is only shown when this is provided. */
  onInvitationsClick?: () => void
  copy?: UserButtonCopy
  useSignOutHandler(): {
    submit: () => Promise<void>
    isPending: boolean
  }
}

export default function UserButton({
  user,
  isLoading,
  onClick,
  onAccountClick,
  onNotificationsClick,
  onInvitationsClick,
  copy,
  useSignOutHandler,
}: UserButtonProps) {
  const { submit } = useSignOutHandler()

  if (isLoading) {
    return (
      <Button variant="outline" size="icon" className="cursor-pointer" disabled>
        <Loading />
      </Button>
    )
  }

  if (!user) {
    return (
      <Button
        onClick={onClick}
        variant="outline"
        size="icon"
        className="cursor-pointer"
      >
        <LogInIcon />
      </Button>
    )
  }

  return (
    <UserNav
      iconOnly
      sections={{
        account: {
          enabled: true,
          label: copy?.account,
          onClick: onAccountClick,
        },
        invitations: {
          enabled: Boolean(onInvitationsClick),
          label: copy?.invitations,
          onClick: onInvitationsClick,
        },
        notifications: {
          enabled: true,
          label: copy?.notifications,
          onClick: onNotificationsClick,
        },
        logout: {
          enabled: true,
          label: copy?.logout,
          onClick: submit,
        },
      }}
      user={user}
    />
  )
}
