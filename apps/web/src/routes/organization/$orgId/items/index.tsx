import { createFileRoute, useNavigate } from "@tanstack/react-router"

import { ItemList } from "@/features/item-module"

export const Route = createFileRoute("/organization/$orgId/items/")({
  component: ItemsPage,
})

function ItemsPage() {
  const { orgId } = Route.useParams()
  const navigate = useNavigate()

  return (
    <ItemList
      orgId={orgId}
      onViewItem={(itemId) =>
        navigate({ to: "/organization/$orgId/items/$itemId", params: { orgId, itemId } })
      }
    />
  )
}
