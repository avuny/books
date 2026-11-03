import { z } from "@avuny/zod"
import {
  ACTIVITY_LOG_ACTIONS,
  ACTIVITY_LOG_DEFAULT_PAGE_SIZE,
  ACTIVITY_LOG_MAX_PAGE_SIZE,
  ACTIVITY_LOG_RESOURCES,
} from "./constants.js"

export const ActivityLogResourceSchema = z.enum(ACTIVITY_LOG_RESOURCES)
export const ActivityLogActionSchema = z.enum(ACTIVITY_LOG_ACTIONS)

/**
 * Read model of one activity row. ipAddress / userAgent stay in the database for forensics
 * and are deliberately NOT exposed to organization admins.
 */
export const ActivityLogDtoSchema = z.object({
  id: z.string().uuid(),
  action: ActivityLogActionSchema,
  resource: ActivityLogResourceSchema,
  resourceId: z.string().uuid(),
  actorId: z.string().uuid().nullable(),
  /** The actor's username inside this organization; null for system actions. */
  actorUsername: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  requestId: z.string().nullable(),
  createdAt: z.string(),
})
export type ActivityLogDto = z.infer<typeof ActivityLogDtoSchema>

export const ActivityLogOffsetListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(ACTIVITY_LOG_MAX_PAGE_SIZE)
    .default(ACTIVITY_LOG_DEFAULT_PAGE_SIZE),
  action: ActivityLogActionSchema.optional(),
  resource: ActivityLogResourceSchema.optional(),
  resourceId: z.string().uuid().optional(),
  actorId: z.string().uuid().optional(),
  /** Inclusive range on createdAt. */
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
})
export type ActivityLogOffsetListQuery = z.infer<
  typeof ActivityLogOffsetListQuerySchema
>

export const ActivityLogOffsetListResponseSchema = z.object({
  items: z.array(ActivityLogDtoSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
})
export type ActivityLogOffsetListResponse = z.infer<
  typeof ActivityLogOffsetListResponseSchema
>
