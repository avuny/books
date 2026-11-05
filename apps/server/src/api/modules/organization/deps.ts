import { db } from "../../db.js"
import { permissionChecker } from "../role/index.js"
import { activityLogService } from "../activity-log/index.js"
import {
  DummyCache,
  DummyOrganizationLimits,
} from "./testing.js"
import { createOrganizationRepository } from "./organization.repository.js"
import { createOrganizationService } from "./organization.service.js"
import type { OrganizationService } from "./organization.types.js"

let _serviceInstance: OrganizationService | undefined

export function getOrganizationService(): OrganizationService {
  if (!_serviceInstance) {
    const repo = createOrganizationRepository({ db })
    _serviceInstance = createOrganizationService({
      repo,
      permissions: permissionChecker,
      cache: new DummyCache(),
      activityLog: activityLogService,
      limits: new DummyOrganizationLimits(),
    })
  }

  return _serviceInstance
}

export const organizationService = new Proxy({} as OrganizationService, {
  get(_target, prop) {
    return (getOrganizationService() as any)[prop]
  },
})
