import { z } from "@avuny/zod"
import {
  DEFAULT_INVENTORY_VALUATION_METHOD,
  INVENTORY_VALUATION_METHODS,
  ITEM_DESCRIPTION_MAX_LENGTH,
  ITEM_NAME_MAX_LENGTH,
  ITEM_NAME_MIN_LENGTH,
  SHELF_LIFE_UNITS,
  UNIT_QUANTITY_PATTERN,
} from "@avuny/contracts"

import type { CreateItemInput, ItemDto, UpdateItemInput } from "../types"

/** A cleared combobox gives "" (or undefined): both mean "nothing picked". */
const blankToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value
const optionalId = z.preprocess(blankToUndefined, z.string().uuid().optional())

/**
 * Form-level schema. Same bounds as the contracts schemas (they come from the same
 * constants); it only adds what a form needs: text inputs are always strings, a cleared
 * picker means "nothing", and a blank reorder point means "not set".
 */
const ItemFormShape = z.object({
  name: z.string().trim().min(ITEM_NAME_MIN_LENGTH).max(ITEM_NAME_MAX_LENGTH),
  description: z.string().trim().max(ITEM_DESCRIPTION_MAX_LENGTH),
  categoryId: z.string().uuid(),
  baseUnitId: optionalId,
  unitCollectionId: optionalId,
  canAssembled: z.boolean(),
  isReturnable: z.boolean(),
  isInventoryTracked: z.boolean(),
  isBatchTracked: z.boolean(),
  isExpiryTracked: z.boolean(),
  defaultShelfLifeValue: z.preprocess(
    blankToUndefined,
    z.coerce.number().int().positive().optional()
  ),
  defaultShelfLifeUnit: z.preprocess(
    blankToUndefined,
    z.enum(SHELF_LIFE_UNITS).optional()
  ),
  inventoryValuationMethod: z.enum(INVENTORY_VALUATION_METHODS),
  allowNegativeStock: z.boolean(),
  reorderPoint: z
    .string()
    .trim()
    .refine((v) => v === "" || UNIT_QUANTITY_PATTERN.test(v), "Invalid number"),
  isActive: z.boolean(),
  openingStockPostedAt: z.string().trim().optional(),
  openingStockLines: z
    .array(
      z.object({
        locationId: optionalId,
        quantity: z.string().trim(),
        includeBatch: z.boolean(),
        batchNumber: z.string().trim(),
        manufacturedOn: z.string().trim(),
        expiresOn: z.string().trim(),
      })
    )
    .optional(),
})

const batchNeedsTracking = (v: {
  isBatchTracked: boolean
  isInventoryTracked: boolean
}) => !(v.isBatchTracked && !v.isInventoryTracked)

const expiryNeedsBatchAndTracking = (v: {
  isExpiryTracked: boolean
  isBatchTracked: boolean
  isInventoryTracked: boolean
}) => !(v.isExpiryTracked && (!v.isBatchTracked || !v.isInventoryTracked))

const shelfLifePairCheck = (v: {
  defaultShelfLifeValue?: number
  defaultShelfLifeUnit?: string
}) =>
  (v.defaultShelfLifeValue === undefined && v.defaultShelfLifeUnit === undefined) ||
  (v.defaultShelfLifeValue !== undefined && v.defaultShelfLifeUnit !== undefined)

/** Create: requires unitCollectionId (or legacy baseUnitId). */
export const CreateItemFormSchema = ItemFormShape.refine(batchNeedsTracking, {
  message: "Batch tracking requires inventory tracking",
  path: ["isBatchTracked"],
})
  .refine(expiryNeedsBatchAndTracking, {
    message: "Expiry tracking requires both inventory tracking and batch tracking",
    path: ["isExpiryTracked"],
  })
  .refine(shelfLifePairCheck, {
    message: "Shelf life value and unit must either both be provided or both be empty",
    path: ["defaultShelfLifeUnit"],
  })
  .refine((v) => (v.baseUnitId === undefined) !== (v.unitCollectionId === undefined), {
    message: "Choose either a base unit or a unit collection",
    path: ["baseUnitId"],
  })

/** Update: the base unit may change; the unit collection is not editable here. */
export const UpdateItemFormSchema = ItemFormShape.refine(batchNeedsTracking, {
  message: "Batch tracking requires inventory tracking",
  path: ["isBatchTracked"],
})
  .refine(expiryNeedsBatchAndTracking, {
    message: "Expiry tracking requires both inventory tracking and batch tracking",
    path: ["isExpiryTracked"],
  })
  .refine(shelfLifePairCheck, {
    message: "Shelf life value and unit must either both be provided or both be empty",
    path: ["defaultShelfLifeUnit"],
  })

export type CreateItemFormInput = z.input<typeof CreateItemFormSchema>
export type CreateItemFormValues = z.output<typeof CreateItemFormSchema>
export type UpdateItemFormInput = z.input<typeof UpdateItemFormSchema>
export type UpdateItemFormValues = z.output<typeof UpdateItemFormSchema>

/** "20.000000" -> "20": the API pads numeric(18, 6); strings only, never floats. */
function trimQuantity(value: string): string {
  const [int = "", frac = ""] = value.trim().split(".")
  const trimmed = frac.replace(/0+$/, "")
  return trimmed ? `${int}.${trimmed}` : int
}

export function getCreateItemDefaults(
  defaultName?: string
): CreateItemFormInput {
  return {
    name: defaultName ?? "",
    description: "",
    categoryId: "",
    baseUnitId: "",
    unitCollectionId: "",
    canAssembled: false,
    isReturnable: true,
    isInventoryTracked: true,
    isBatchTracked: false,
    isExpiryTracked: false,
    defaultShelfLifeValue: undefined,
    defaultShelfLifeUnit: undefined,
    inventoryValuationMethod: DEFAULT_INVENTORY_VALUATION_METHOD,
    allowNegativeStock: false,
    reorderPoint: "",
    isActive: true,
    openingStockPostedAt: "",
    openingStockLines: [],
  }
}

export function getUpdateItemDefaults(item: ItemDto): UpdateItemFormInput {
  return {
    name: item.name,
    description: item.description ?? "",
    categoryId: item.categoryId,
    baseUnitId: item.baseUnit.id,
    unitCollectionId: item.unitCollectionId ?? "",
    canAssembled: item.canAssembled,
    isReturnable: item.isReturnable,
    isInventoryTracked: item.isInventoryTracked,
    isBatchTracked: item.isBatchTracked,
    isExpiryTracked: item.isExpiryTracked,
    defaultShelfLifeValue: item.expirySettings?.defaultShelfLifeValue ?? undefined,
    defaultShelfLifeUnit: item.expirySettings?.defaultShelfLifeUnit ?? undefined,
    inventoryValuationMethod: item.inventoryValuationMethod,
    allowNegativeStock: item.allowNegativeStock,
    reorderPoint: item.reorderPoint ? trimQuantity(item.reorderPoint) : "",
    isActive: item.isActive,
  }
}

export function toCreateItemInput(
  values: CreateItemFormValues
): CreateItemInput {
  const validLines = (values.openingStockLines ?? [])
    .filter((l) => l.locationId && l.quantity)
    .map((l) => ({
      locationId: l.locationId!,
      quantity: l.quantity,
      batch:
        l.includeBatch && l.batchNumber
          ? {
              number: l.batchNumber,
              manufacturedOn: l.manufacturedOn || null,
              expiresOn: l.expiresOn || null,
            }
          : null,
    }))

  return {
    name: values.name,
    description: values.description || null,
    categoryId: values.categoryId,
    ...(values.unitCollectionId
      ? { unitCollectionId: values.unitCollectionId }
      : {}),
    ...(!values.unitCollectionId && values.baseUnitId
      ? { baseUnitId: values.baseUnitId }
      : {}),
    canAssembled: values.canAssembled,
    isReturnable: values.isReturnable,
    isInventoryTracked: values.isInventoryTracked,
    isBatchTracked: values.isBatchTracked,
    isExpiryTracked: values.isExpiryTracked,
    expirySettings:
      values.isExpiryTracked && values.defaultShelfLifeValue && values.defaultShelfLifeUnit
        ? {
            defaultShelfLifeValue: values.defaultShelfLifeValue,
            defaultShelfLifeUnit: values.defaultShelfLifeUnit,
          }
        : null,
    inventoryValuationMethod: values.inventoryValuationMethod,
    allowNegativeStock: values.allowNegativeStock,
    reorderPoint: values.reorderPoint || null,
    openingStock:
      validLines.length > 0
        ? {
            postedAt: values.openingStockPostedAt || undefined,
            lines: validLines,
          }
        : undefined,
  }
}

/** The unit collection is sent when changed; base unit is sent if explicitly modified. */
export function toUpdateItemInput(
  values: UpdateItemFormValues,
  current: ItemDto
): UpdateItemInput {
  return {
    name: values.name,
    description: values.description || null,
    categoryId: values.categoryId,
    ...(values.unitCollectionId &&
    values.unitCollectionId !== current.unitCollectionId
      ? { unitCollectionId: values.unitCollectionId }
      : {}),
    ...(values.baseUnitId && values.baseUnitId !== current.baseUnit.id
      ? { baseUnitId: values.baseUnitId }
      : {}),
    canAssembled: values.canAssembled,
    isReturnable: values.isReturnable,
    isInventoryTracked: values.isInventoryTracked,
    isBatchTracked: values.isBatchTracked,
    isExpiryTracked: values.isExpiryTracked,
    expirySettings:
      values.isExpiryTracked && values.defaultShelfLifeValue && values.defaultShelfLifeUnit
        ? {
            defaultShelfLifeValue: values.defaultShelfLifeValue,
            defaultShelfLifeUnit: values.defaultShelfLifeUnit,
          }
        : null,
    inventoryValuationMethod: values.inventoryValuationMethod,
    isActive: values.isActive,
    allowNegativeStock: values.allowNegativeStock,
    reorderPoint: values.reorderPoint || null,
  }
}
