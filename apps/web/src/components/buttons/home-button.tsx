"use client"

import { useNavigate } from "@tanstack/react-router"
import HomeBtn from "@workspace/ui/blocks/buttons/home-btn"

export function HomeButton() {
  const navigate = useNavigate()

  return (
    <HomeBtn
      onClick={() => {
        void navigate({ to: "/" })
      }}
    />
  )
}
