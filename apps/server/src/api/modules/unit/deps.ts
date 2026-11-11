import { db } from "../../db.js"
import { activityLogService } from "../activity-log/index.js"
import { createUnitRepository } from "./unit.repository.js"
import { createUnitService } from "./unit.service.js"
import type { UnitRepository, UnitService } from "./unit.types.js"

let repoInstance: UnitRepository | undefined
let serviceInstance: UnitService | undefined

export const getUnitRepository = (): UnitRepository =>
  (repoInstance ??= createUnitRepository({ db }))

export const getUnitService = (): UnitService =>
  (serviceInstance ??= createUnitService({
    repository: getUnitRepository(),
    activityLog: activityLogService,
  }))

export const unitRepository = new Proxy({} as UnitRepository, {
  get: (_t, prop) => (getUnitRepository() as any)[prop],
})

export const unitService = new Proxy({} as UnitService, {
  get: (_t, prop) => (getUnitService() as any)[prop],
})
