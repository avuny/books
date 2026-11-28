import { z } from "@avuny/zod"
import {
  COST_DECIMAL_REGEX,
  COST_ENTRY_KINDS,
  COST_ENTRY_SOURCES,
  COST_VALUE_MINOR_REGEX,
  ZERO_COST_REASONS,
} from "./constants.js"
import { InventoryCostingErrorCode as Err } from "./errors.js"

export const CostSourceSchema = z.enum(["DOCUMENT", "USER", "INHERITED", "CONFIRMED_PROPOSAL"])
export const CostEntrySourceSchema = z.enum(COST_ENTRY_SOURCES)
export const CostEntryKindSchema = z.enum(COST_ENTRY_KINDS)
export const ZeroCostReasonSchema = z.enum(ZERO_COST_REASONS)

/** Integer minor units as a string, so no precision is lost in JSON. */
export const ValueMinorSchema = z.string().regex(COST_VALUE_MINOR_REGEX, Err.COST_INVALID)
/** Unit cost in minor units per base unit, decimal string, up to 10 decimals. */
export const UnitCostMinorSchema = z.string().regex(COST_DECIMAL_REGEX, Err.COST_INVALID)

export const ZeroCostSchema = z.object({ reason: ZeroCostReasonSchema }).strict()

/**
 * Cost determination for one value-in line (SPEC 7.1). There is no default: a line without a
 * valid cost input is rejected by the stock engine with STOCK_MOVEMENT_COST_REQUIRED.
 * A zero value needs `zeroCost` with a reason (R3), except INHERITED.
 */
export const CostInputSchema = z.discriminatedUnion("source", [
  z
    .object({
      source: z.literal("DOCUMENT"),
      totalValueMinor: ValueMinorSchema,
      zeroCost: ZeroCostSchema.optional(),
    })
    .strict(),
  z
    .object({
      source: z.literal("USER"),
      unitCost: UnitCostMinorSchema,
      zeroCost: ZeroCostSchema.optional(),
    })
    .strict(),
  z
    .object({
      source: z.literal("CONFIRMED_PROPOSAL"),
      unitCost: UnitCostMinorSchema,
      proposedUnitCost: UnitCostMinorSchema,
    })
    .strict(),
  z
    .object({
      source: z.literal("INHERITED"),
      sourceEntryId: z.string().uuid().optional(),
      sourceLayerIds: z.array(z.string().uuid()).min(1).max(200).optional(),
      fromMovementId: z.string().uuid().optional(),
      additionalValueMinor: ValueMinorSchema.optional(),
    })
    .strict()
    .refine(
      (v) =>
        [v.sourceEntryId, v.sourceLayerIds, v.fromMovementId].filter((x) => x !== undefined)
          .length === 1,
      { message: Err.COST_INVALID }
    ),
])
export type CostInput = z.infer<typeof CostInputSchema>
