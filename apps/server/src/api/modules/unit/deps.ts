import { db } from "../../db.js"
import { activityLogService } from "../activity-log/index.js"
import { DummyUnitPlanFeatures } from "./testing.js"
import { createUnitRepository } from "./unit.repository.js"
import { createUnitService } from "./unit.service.js"
import type { UnitRepository, UnitService } from "./unit.types.js"

let _repoInstance: UnitRepository | undefined
let _serviceInstance: UnitService | undefined

export function getUnitRepository(): UnitRepository {
  if (!_repoInstance) _repoInstance = createUnitRepository({ db })
  return _repoInstance
}

export function getUnitService(): UnitService {
  if (!_serviceInstance) {
    _serviceInstance = createUnitService({
      repository: getUnitRepository(),
      // TODO: replace with the real plan-features adapter (extra units are a paid feature).
      features: new DummyUnitPlanFeatures(),
      activityLog: activityLogService,
    })
  }
  return _serviceInstance
}

export const unitService = new Proxy({} as UnitService, {
  get(_target, prop) {
    return (getUnitService() as any)[prop]
  },
})
