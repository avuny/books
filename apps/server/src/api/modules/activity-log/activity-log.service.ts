import type {
  ActivityLogAction,
  ActivityLogOffsetListQuery,
  ActivityLogOffsetListResponse,
  ActivityLogResource,
  PermissionKey,
} from "@avuny/contracts"
import type { NewOrganizationActivityLog } from "@avuny/db"
import { logger } from "@avuny/logger"
import { fail, ok, type Result } from "@avuny/utils"

import {
  ActivityLogErrorCode,
  type ActivityLogErrorCode as Code,
} from "./activity-log.errors.js"
import { toActivityLogDto } from "./activity-log.mapper.js"
import type { ActivityLogEntry, ActivityLogOptions } from "./activity-log.port.js"
import type { ActivityLogRepository } from "./activity-log.repository.js"

const Err = ActivityLogErrorCode

/* ---------- ports ---------- */

/**
 * What this module needs from the permission system. Declared here (not imported from
 * another module) so modules do not depend on each other; the real DB-backed
 * PermissionChecker satisfies it structurally.
 */
interface PermissionChecker {
  check(
    actor: { userId: string; orgId: string },
    action: PermissionKey,
    opts?: { resourceId?: string }
  ): Promise<boolean>
}

/* ---------- internals ---------- */

/** Compile-time check that the key exists in the permission registry. */
const PERM = {
  read: "read:activity-log",
} as const satisfies Record<string, PermissionKey>

export interface ActivityLogServiceDeps {
  repository: ActivityLogRepository
  permissions: PermissionChecker
}

/**
 * Two jobs:
 *  1. `log`  implements the ActivityLog port that every other module is injected with.
 *  2. `list` is the read side for organization admins (permission `read:activity-log`).
 */
export function createActivityLogService(deps: ActivityLogServiceDeps) {
  const repo = deps.repository
  const { permissions } = deps

  /** Validates an entry and shapes it into a row. Throws on programmer error. */
  function toRow(entry: ActivityLogEntry): NewOrganizationActivityLog {
    const rawAction = (entry.action ?? entry.type)?.trim()
    const action = rawAction as ActivityLogAction

    const rawResource = (
      entry.resource ??
      entry.entityType ??
      rawAction?.split(".")[0]
    )?.trim()
    const resource = rawResource as ActivityLogResource

    const resourceId = entry.resourceId ?? entry.entityId

    if (!action) {
      throw new Error(`Invalid activity action: "${entry.action ?? entry.type}"`)
    }
    if (!resource) {
      throw new Error(
        `Invalid activity resource: "${entry.resource ?? entry.entityType}"`
      )
    }
    if (!resourceId) {
      throw new Error(
        `Invalid activity resourceId: "${entry.resourceId ?? entry.entityId}"`
      )
    }

    return {
      orgId: entry.orgId,
      actorId: entry.actorId,
      action,
      resource,
      resourceId,
      metadata: entry.metadata ?? {},
      requestId: entry.context?.requestId ?? null,
      ipAddress: entry.context?.ipAddress ?? null,
      userAgent: entry.context?.userAgent ?? null,
    }
  }

  return {
    async log(entry: ActivityLogEntry, opts: ActivityLogOptions = {}): Promise<void> {
      if (opts.tx) {
        // Atomic mode: let errors propagate so the caller's transaction rolls back too.
        await repo.insert(toRow(entry), opts.tx)
        return
      }

      // Best-effort mode: the business change is already committed, so an audit failure
      // must not turn it into an error response. Log it loudly instead (no metadata: it may
      // hold personal data).
      try {
        await repo.insert(toRow(entry))
      } catch (err) {
        logger.error(
          {
            err,
            action: entry.action ?? entry.type,
            orgId: entry.orgId,
            resource: entry.resource ?? entry.entityType,
            resourceId: entry.resourceId ?? entry.entityId,
          },
          "Activity log write failed"
        )
      }
    },

    async list(
      actorId: string,
      orgId: string,
      query: ActivityLogOffsetListQuery
    ): Promise<Result<ActivityLogOffsetListResponse, Code>> {
      if (!(await permissions.check({ userId: actorId, orgId }, PERM.read)))
        return fail({
          error: Err.ACTIVITY_LOG_FORBIDDEN,
          msg: "You are not allowed to view the activity log",
        })
      if (query.from && query.to && query.from > query.to)
        return fail({
          error: Err.ACTIVITY_LOG_INVALID_RANGE,
          msg: "The start date must be before the end date",
        })

      const { rows, total } = await repo.list(orgId, query)
      return ok({
        data: {
          items: rows.map(toActivityLogDto),
          page: query.page,
          pageSize: query.pageSize,
          total,
        },
        msg: "Activity retrieved successfully",
      })
    },
  }
}

export type ActivityLogService = ReturnType<typeof createActivityLogService>
