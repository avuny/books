import { db } from "../../db.js"
import { activityLogService } from "../activity-log/index.js"
import { createUnitCollectionRepository } from "./unit-collection.repository.js"
import { createUnitCollectionService } from "./unit-collection.service.js"
import type { UnitCollectionRepository, UnitCollectionService } from "./unit-collection.types.js"

let repoInstance: UnitCollectionRepository | undefined
let serviceInstance: UnitCollectionService | undefined

export const getUnitCollectionRepository = (): UnitCollectionRepository =>
  (repoInstance ??= createUnitCollectionRepository({ db }))

export const getUnitCollectionService = (): UnitCollectionService =>
  (serviceInstance ??= createUnitCollectionService({
    repository: getUnitCollectionRepository(),
    activityLog: activityLogService,
  }))

export const unitCollectionRepository = new Proxy({} as UnitCollectionRepository, {
  get: (_t, prop) => (getUnitCollectionRepository() as any)[prop],
})

export const unitCollectionService = new Proxy({} as UnitCollectionService, {
  get: (_t, prop) => (getUnitCollectionService() as any)[prop],
})

