"use client"

import { useNavigate } from "@tanstack/react-router"
import DashboardButton from "@workspace/ui/blocks/buttons/dashboard-btn"
import type { ComponentProps } from "react"

type DashboardButtonContainerProps = Omit<
  ComponentProps<typeof DashboardButton>,
  "onClick"
>

export default function DashboardButtonContainer(
  props: DashboardButtonContainerProps
) {
  const navigate = useNavigate()

  return (
    <DashboardButton
      {...props}
      onClick={() => {
        void navigate({ to: "/organization" })
      }}
    />
  )
}
