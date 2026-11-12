import { db } from "../../db.js"
import { createActivityLogRepository } from "./activity-log.repository.js"
import { createActivityLogService } from "./activity-log.service.js"
import type { ActivityLogService } from "./activity-log.service.js"

/**
 * Lazily resolves the permission checker from the role module at call time
 * to avoid a circular ESM initialisation cycle:
 *   role/deps → activity-log/deps → role/deps
 */
async function getPermissionChecker() {
  const { permissionChecker } = await import("../role/deps.js")
  return permissionChecker
}

let _serviceInstance: ActivityLogService | undefined

export function getActivityLogService(): ActivityLogService {
  if (!_serviceInstance) {
    const repo = createActivityLogRepository({ db })
    _serviceInstance = createActivityLogService({
      repository: repo,
      permissions: {
        async check(subject, key, ctx) {
          const checker = await getPermissionChecker()
          return checker.check(subject, key, ctx)
        },
      },
    })
  }
  return _serviceInstance
}

export const activityLogService = new Proxy({} as ActivityLogService, {
  get(_target, prop) {
    return (getActivityLogService() as any)[prop]
  },
})

