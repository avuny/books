import type { UnitCollectionDto } from "../../unit-collection-module"
import type { CollectionUnitOption } from "./item-form-types"

/** The units of a unit collection as the price and opening stock fields use them (base unit first). */
export function toCollectionUnitOptions(
  collection: Pick<UnitCollectionDto, "units"> | null | undefined
): CollectionUnitOption[] {
  return (collection?.units ?? []).map((u) => ({
    id: u.id,
    name: u.name,
    symbol: u.symbol,
    factor: u.conversionFactor,
    isBase: u.isBase,
  }))
}
