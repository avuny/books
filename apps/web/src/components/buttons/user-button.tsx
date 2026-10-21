"use client"

import { useNavigate } from "@tanstack/react-router"
import UserButton, {
  type UserButtonProps,
} from "@workspace/ui/blocks/buttons/user-btn"

export type UserButtonContainerProps = Omit<UserButtonProps, "onClick">

export default function UserButtonContainer(props: UserButtonContainerProps) {
  const navigate = useNavigate()

  return (
    <UserButton
      {...props}
      onClick={() => {
        void navigate({ to: "/auth/sign-in" })
      }}
    />
  )
}
