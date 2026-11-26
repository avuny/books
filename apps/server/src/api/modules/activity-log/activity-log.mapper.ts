import type { ActivityLogDto } from "@avuny/contracts"
import type { ActivityLogRow } from "./activity-log.repository.js"

export const toActivityLogDto = ({ log, actorUsername }: ActivityLogRow): ActivityLogDto => ({
  id: log.id,
  action: log.action,
  resource: log.resource,
  resourceId: log.resourceId,
  actorId: log.actorId,
  actorUsername,
  metadata: log.metadata,
  requestId: log.requestId,
  createdAt: log.createdAt.toISOString(),
})
