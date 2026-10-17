"use client"

import { UserNav } from "@workspace/ui/blocks/layout/nav-user"
import Loading from "@workspace/ui/blocks/loading/loading"
import type { User } from "@workspace/ui/blocks/types"
import { Button } from "@workspace/ui/components/button"

import { LogInIcon } from "lucide-react"

export type UserButtonProps = {
  user: User | undefined
  isLoading: boolean
  href: string
  onNavigate: (href: string) => void
  useSignOutHandler(): {
    submit: () => Promise<void>
    isPending: boolean
  }
}

export default function UserButton({
  user,
  isLoading,
  href,
  onNavigate,
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
        onClick={() => onNavigate(href)}
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
        account: { enabled: true },
        notifications: { enabled: true },
        logout: { enabled: true, onClick: submit },
      }}
      user={user}
    />
  )
}
