"use client"

import { Button } from "@workspace/ui/components/button"
import { HomeIcon } from "lucide-react"

export type HomeButtonProps = {
  onClick: () => void
}

export default function HomeButton({ onClick }: HomeButtonProps) {
  return (
    <Button
      onClick={onClick}
      variant="outline"
      size="icon"
      className="cursor-pointer"
    >
      <HomeIcon />
    </Button>
  )
}
