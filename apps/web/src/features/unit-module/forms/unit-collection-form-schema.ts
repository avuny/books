import { z } from "@avuny/zod"
import {
  UNIT_COLLECTION_MAX_UNITS,
  UNIT_COLLECTION_NAME_MAX_LENGTH,
  UnitCollectionUnitInputSchema,
} from "@avuny/contracts"

import type { CreateUnitCollectionInput, UpdateUnitCollectionInput } from "../types"

/**
 * One schema for both forms. On update the base unit is read-only, but it stays in the
 * form values (valid uuid) so the same shape works. An empty name means "generate it"
 * on create and "keep the current one" on update.
 */
export const UnitCollectionFormSchema = z.object({
  name: z.string().trim().max(UNIT_COLLECTION_NAME_MAX_LENGTH),
  baseUnitId: z.string().uuid(),
  /** Units besides the base unit; factors are decimal strings, never numbers. */
  units: z.array(UnitCollectionUnitInputSchema).max(UNIT_COLLECTION_MAX_UNITS - 1),
})

export type UnitCollectionFormInput = z.input<typeof UnitCollectionFormSchema>
export type UnitCollectionFormValues = z.output<typeof UnitCollectionFormSchema>

export function toCreateUnitCollectionInput(
  values: UnitCollectionFormValues
): CreateUnitCollectionInput {
  return {
    baseUnitId: values.baseUnitId,
    ...(values.name ? { name: values.name } : {}),
    units: values.units,
  }
}

/** `units` REPLACES the collection's non-base units on the server. */
export function toUpdateUnitCollectionInput(
  values: UnitCollectionFormValues
): UpdateUnitCollectionInput {
  return {
    ...(values.name ? { name: values.name } : {}),
    units: values.units,
  }
}
