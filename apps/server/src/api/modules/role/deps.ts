import { db } from "../../db.js"
import { activityLogService } from "../activity-log/index.js"
import { createRoleRepository } from "./role.repository.js"
import {
  createPermissionResolver,
  createRbacPermissionChecker,
} from "./role.permissions.js"
import { createRoleService } from "./role.service.js"
import { DummyPlanFeatures } from "./testing.js"
import type {
  PermissionChecker,
  PermissionResolver,
  RoleRepository,
  RoleService,
} from "./role.types.js"

let _repoInstance: RoleRepository | undefined
let _resolverInstance: PermissionResolver | undefined
let _checkerInstance: PermissionChecker | undefined
let _serviceInstance: RoleService | undefined

export function getRoleRepository(): RoleRepository {
  if (!_repoInstance) {
    _repoInstance = createRoleRepository({ db })
  }
  return _repoInstance
}

export function getPermissionResolver(): PermissionResolver {
  if (!_resolverInstance) {
    _resolverInstance = createPermissionResolver({
      repository: getRoleRepository(),
    })
  }
  return _resolverInstance
}

export function getPermissionChecker(): PermissionChecker {
  if (!_checkerInstance) {
    _checkerInstance = createRbacPermissionChecker({
      resolver: getPermissionResolver(),
    })
  }
  return _checkerInstance
}

export function getRoleService(): RoleService {
  if (!_serviceInstance) {
    _serviceInstance = createRoleService({
      repository: getRoleRepository(),
      resolver: getPermissionResolver(),
      features: new DummyPlanFeatures(),
      activityLog: activityLogService,
    })
  }
  return _serviceInstance
}

export const permissionResolver = new Proxy({} as PermissionResolver, {
  get(_target, prop) {
    return (getPermissionResolver() as any)[prop]
  },
})

export const permissionChecker = new Proxy({} as PermissionChecker, {
  get(_target, prop) {
    return (getPermissionChecker() as any)[prop]
  },
})

export const roleService = new Proxy({} as RoleService, {
  get(_target, prop) {
    return (getRoleService() as any)[prop]
  },
})

