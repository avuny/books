import { createFileRoute } from "@tanstack/react-router"
import { PersonalInfo } from "@/features/user"

export const Route = createFileRoute("/user/settings")({
  component: UserSettingsPage,
})

function UserSettingsPage() {
  return <PersonalInfo />
}
