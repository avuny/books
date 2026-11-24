import { db } from "../../db.js"
import { activityLogService } from "../activity-log/index.js"
import { getPermissionChecker } from "../role/deps.js"
import { createPartyRepository } from "./party.repository.js"
import { createPartyService } from "./party.service.js"
import { partyRules } from "./party.rules.js"
import type { PartyRepository, PartyService } from "./party.types.js"

let _repoInstance: PartyRepository | undefined
let _serviceInstance: PartyService | undefined

export function getPartyRepository(): PartyRepository {
  if (!_repoInstance) {
    _repoInstance = createPartyRepository({ db })
  }
  return _repoInstance
}

export function getPartyService(): PartyService {
  if (!_serviceInstance) {
    _serviceInstance = createPartyService({
      repository: getPartyRepository(),
      permissions: getPermissionChecker(),
      activityLog: activityLogService,
      rules: partyRules,
    })
  }
  return _serviceInstance
}

export const partyRepository = new Proxy({} as PartyRepository, {
  get(_target, prop) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (getPartyRepository() as any)[prop]
  },
})

export const partyService = new Proxy({} as PartyService, {
  get(_target, prop) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (getPartyService() as any)[prop]
  },
})

/** Domain port: used by transactional document modules to validate active roles. */
export const assertActiveRole: PartyService["assertActiveRole"] = (...args) =>
  getPartyService().assertActiveRole(...args)
