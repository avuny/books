import { db } from "../../db.js"
import { permissionChecker } from "../role/index.js"
import { activityLogService } from "../activity-log/index.js"
import { DummyLimits } from "./testing.js"
import { createOrganizationUserRepository } from "./organization-user.repository.js"
import { createOrganizationUserService } from "./organization-user.service.js"
import type { OrganizationUserService } from "./organization-user.types.js"

let _serviceInstance: OrganizationUserService | undefined

export function getOrganizationUserService(): OrganizationUserService {
  if (!_serviceInstance) {
    const repository = createOrganizationUserRepository({ db })
    _serviceInstance = createOrganizationUserService({
      repository,
      permissions: permissionChecker,
      activityLog: activityLogService,
      limits: new DummyLimits(),
    })
  }

  return _serviceInstance
}

export const organizationUserService = new Proxy({} as OrganizationUserService, {
  get(_target, prop) {
    return (getOrganizationUserService() as any)[prop]
  },
})
