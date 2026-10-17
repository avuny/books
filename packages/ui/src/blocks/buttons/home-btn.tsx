"use client"

import type { AppRouter } from "@workspace/ui/blocks/types"
import { Button } from "@workspace/ui/components/button"
import { HomeIcon } from "lucide-react"

export type HomeButtonProps = {
  router: AppRouter
  href?: string
}

export default function HomeButton({ router, href }: HomeButtonProps) {
  return (
    <Button
      onClick={() => router.replace(href || "/")}
      variant="outline"
      size="icon"
      className="cursor-pointer"
    >
      <HomeIcon />
    </Button>
  )
}
