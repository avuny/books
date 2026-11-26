"use client"

import { useNavigate } from "@tanstack/react-router"
import DashboardButton, {
  type DashboardButtonProps,
} from "@workspace/ui/blocks/buttons/dashboard-btn"
import { useAuthenticatedHandler } from "@/features/auth"
import { ROUTES } from "@/features/routes"

export type DashboardButtonContainerProps = Partial<DashboardButtonProps>

export function DashboardButtonContainer({
  user: propUser,
  isLoading: propIsLoading,
  onClick,
}: DashboardButtonContainerProps = {}) {
  const navigate = useNavigate()
  const auth = useAuthenticatedHandler()

  const user = propUser !== undefined ? propUser : auth.data?.data
  const isLoading = propIsLoading !== undefined ? propIsLoading : auth.isLoading

  const handleClick = () => {
    if (onClick) {
      onClick()
    } else {
      void navigate({ to: ROUTES.app.main })
    }
  }

  return (
    <DashboardButton user={user} isLoading={isLoading} onClick={handleClick} />
  )
}

export { DashboardButtonContainer as DashboardButton }
export default DashboardButtonContainer
