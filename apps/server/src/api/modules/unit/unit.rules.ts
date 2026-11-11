import { UnitErrorCode, type UnitErrorCode as Code } from "@avuny/contracts"
import type { Unit } from "@avuny/db"
import { pass, reject, violation, type RuleResult, type RuleViolation } from "../shared/rules.js"

const Err = UnitErrorCode

export function checkCanModifyUnit(unit: Pick<Unit, "orgId">): RuleViolation<Code> | null {
  if (unit.orgId === null) {
    return violation(Err.UNIT_SYSTEM_IMMUTABLE, "System units cannot be modified")
  }
  return null
}

export function checkCanDeleteUnit(
  unit: Pick<Unit, "orgId">,
  inUse: boolean
): RuleViolation<Code> | null {
  if (unit.orgId === null) {
    return violation(Err.UNIT_SYSTEM_IMMUTABLE, "System units cannot be deleted")
  }
  if (inUse) {
    return violation(Err.UNIT_IN_USE, "This unit is used in collections or items and cannot be deleted")
  }
  return null
}

export function checkUniqueness(
  input: { name?: string; symbol?: string },
  unitsInScope: readonly Pick<Unit, "id" | "name" | "symbol">[],
  currentUnitId?: string
): RuleResult<void, Code> {
  const normName = input.name?.trim().toLowerCase()
  const normSymbol = input.symbol?.trim()

  for (const existing of unitsInScope) {
    if (currentUnitId && existing.id === currentUnitId) continue

    if (normName && existing.name.toLowerCase() === normName) {
      return reject(Err.UNIT_NAME_TAKEN, `A unit named "${existing.name}" already exists`)
    }
    if (normSymbol && existing.symbol === normSymbol) {
      return reject(Err.UNIT_SYMBOL_TAKEN, `A unit with symbol "${existing.symbol}" already exists`)
    }
  }

  return pass(undefined)
}

export const unitRules = {
  checkCanModifyUnit,
  checkCanDeleteUnit,
  checkUniqueness,
} as const

export type UnitRules = typeof unitRules
