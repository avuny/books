"use client"

import Loading from "@workspace/ui/blocks/loading/loading"
import { Button } from "@workspace/ui/components/button"
import { BriefcaseBusinessIcon } from "lucide-react"

type DashboardButtonProps = {
  user: unknown | undefined
  isLoading: boolean
  router: {
    replace: (href: string) => void
  }
  href: string
}

export default function DashboardButton({
  isLoading,
  user,
  router,
  href,
}: DashboardButtonProps) {
  if (isLoading) {
    return (
      <Button variant="outline" size="icon" className="cursor-pointer" disabled>
        <Loading />
      </Button>
    )
  }

  if (!user) {
    return null
  }

  return (
    <Button
      onClick={() => router.replace(href)}
      variant="outline"
      size="icon"
      className="cursor-pointer"
    >
      <BriefcaseBusinessIcon />
    </Button>
  )
}
