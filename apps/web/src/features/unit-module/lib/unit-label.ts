import type { UnitDto } from "../types"

export function unitLabel(unit: Pick<UnitDto, "name" | "symbol">): string {
  return `${unit.name} (${unit.symbol})`
}

