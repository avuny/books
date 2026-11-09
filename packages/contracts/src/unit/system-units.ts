import type { UnitType } from "./constants.js"

export interface SystemUnitDefinition {
    name: string
    symbol: string
    type: UnitType
}

const unit = (
    type: UnitType,
    name: string,
    symbol: string
): SystemUnitDefinition => ({ name, symbol, type })

/**
 * Global units, synced by a `seed:units` script (upsert by `symbol`).
 * The symbol is the identity: changing one creates a new unit, so treat it as a stable key.
 * Add new ones freely; removing one here never deletes it from the database.
 * Symbols are unique case-sensitively ("m" meter, "mL" milliliter, "L" liter).
 */
export const SYSTEM_UNITS: readonly SystemUnitDefinition[] = [
    // count
    unit("count", "Piece", "pc"),
    unit("count", "Pair", "pr"),
    unit("count", "Dozen", "doz"),
    unit("count", "Box", "box"),
    unit("count", "Pack", "pack"),
    unit("count", "Carton", "ctn"),
    unit("count", "Bag", "bag"),
    unit("count", "Roll", "roll"),
    unit("count", "Set", "set"),
    // weight
    unit("weight", "Kilogram", "kg"),
    unit("weight", "Gram", "g"),
    unit("weight", "Milligram", "mg"),
    unit("weight", "Ton", "t"), // metric ton
    unit("weight", "Pound", "lb"),
    unit("weight", "Ounce", "oz"),
    // length
    unit("length", "Meter", "m"),
    unit("length", "Centimeter", "cm"),
    unit("length", "Millimeter", "mm"),
    unit("length", "Kilometer", "km"),
    unit("length", "Inch", "in"),
    unit("length", "Foot", "ft"),
    unit("length", "Yard", "yd"),
    // area
    unit("area", "Square meter", "m²"),
    unit("area", "Square centimeter", "cm²"),
    unit("area", "Square foot", "ft²"),
    // volume
    unit("volume", "Liter", "L"),
    unit("volume", "Milliliter", "mL"),
    unit("volume", "Cubic meter", "m³"),
    unit("volume", "Gallon", "gal"),
]