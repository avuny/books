"use client"

import { UserNav } from "@workspace/ui/blocks/layout/nav-user"
import { AppRouter } from "@workspace/ui/blocks/layout/types"
import Loading from "@workspace/ui/blocks/loading/loading"
import type { User } from "@workspace/ui/blocks/types"
import { Button } from "@workspace/ui/components/button"

import { LogInIcon } from "lucide-react"

export type UserButtonProps = {
  user: User | undefined
  isLoading: boolean
  href: string
  router: AppRouter
  useSignOutHandler(): {
    submit: () => Promise<void>
    isPending: boolean
  }
}

export default function UserButton({
  user,
  isLoading,
  href,
  router,
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
        onClick={() => router.push(href)}
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
