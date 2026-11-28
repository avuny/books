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

const optionalPrice = z
  .string()
  .trim()
  .refine((v) => v === "" || UNIT_QUANTITY_PATTERN.test(v), "Invalid number")
  .optional()

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
  categoryId: z.string().uuid("Choose a category"),
  baseUnitId: optionalId,
  unitCollectionId: optionalId,
  canAssembled: z.boolean(),
  isReturnable: z.boolean(),
  isInventoryTracked: z.boolean(),
  isBatchTracked: z.boolean().default(false),
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
  costPrice: z
    .string()
    .trim()
    .refine((v) => v === "" || UNIT_QUANTITY_PATTERN.test(v), "Invalid number"),
  sellingPrice: z
    .string()
    .trim()
    .refine((v) => v === "" || UNIT_QUANTITY_PATTERN.test(v), "Invalid number"),
  isActive: z.boolean(),
  /** Prices of the non-base units of the collection (per 1 of that unit); blank = not set. */
  unitPrices: z
    .array(
      z.object({
        unitId: z.string().uuid(),
        costPrice: optionalPrice,
        sellingPrice: optionalPrice,
      })
    )
    .optional(),
  openingStockLines: z
    .array(
      z.object({
        locationId: optionalId,
        /** Unit the quantity and cost are entered in; blank = the base unit. */
        unitId: optionalId,
        /** Posting date (YYYY-MM-DD) of this line; blank = today. */
        postedAt: z.string().trim().optional(),
        quantity: z
          .string()
          .trim()
          .refine(
            (v) => v === "" || UNIT_QUANTITY_PATTERN.test(v),
            "Invalid number"
          ),
        cost: z
          .string()
          .trim()
          .refine(
            (v) => v === "" || UNIT_QUANTITY_PATTERN.test(v),
            "Invalid number"
          )
          .optional(),
        manufacturedOn: z.string().trim().optional(),
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
}) => !(v.isExpiryTracked && !v.isInventoryTracked)

const shelfLifePairCheck = (v: {
  defaultShelfLifeValue?: number
  defaultShelfLifeUnit?: string
}) =>
  (v.defaultShelfLifeValue === undefined &&
    v.defaultShelfLifeUnit === undefined) ||
  (v.defaultShelfLifeValue !== undefined &&
    v.defaultShelfLifeUnit !== undefined)

/** Create: requires unitCollectionId (or legacy baseUnitId). */
export const CreateItemFormSchema = ItemFormShape.refine(batchNeedsTracking, {
  message: "Batch tracking requires inventory tracking",
  path: ["isBatchTracked"],
})
  .refine(expiryNeedsBatchAndTracking, {
    message:
      "Expiry tracking requires inventory tracking",
    path: ["isExpiryTracked"],
  })
  .refine(shelfLifePairCheck, {
    message:
      "Shelf life value and unit must either both be provided or both be empty",
    path: ["defaultShelfLifeUnit"],
  })
  .refine(
    (v) => (v.baseUnitId === undefined) !== (v.unitCollectionId === undefined),
    {
      message: "Choose either a base unit or a unit collection",
      path: ["baseUnitId"],
    }
  )
  .refine(
    (v) => {
      if (!v.openingStockLines?.length) return true
      return v.openingStockLines.every((l) => {
        if (!l.locationId && !l.quantity) return true
        return Boolean(l.locationId && l.quantity && l.quantity.trim() !== "")
      })
    },
    {
      message: "Both location and quantity are required for each line",
      path: ["openingStockLines"],
    }
  )
  .refine(
    (v) => {
      if (!v.isExpiryTracked || !v.openingStockLines?.length) return true
      return v.openingStockLines.every((l) => {
        if (!l.locationId && !l.quantity) return true
        return Boolean(l.manufacturedOn && l.manufacturedOn.trim() !== "")
      })
    },
    {
      message:
        "Manufacture date is required for each line when expiry tracking is enabled",
      path: ["openingStockLines"],
    }
  )

/** Update: the base unit may change; the unit collection is not editable here. */
export const UpdateItemFormSchema = ItemFormShape.refine(batchNeedsTracking, {
  message: "Batch tracking requires inventory tracking",
  path: ["isBatchTracked"],
})
  .refine(expiryNeedsBatchAndTracking, {
    message:
      "Expiry tracking requires inventory tracking",
    path: ["isExpiryTracked"],
  })
  .refine(shelfLifePairCheck, {
    message:
      "Shelf life value and unit must either both be provided or both be empty",
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

export const BLANK_OPENING_LINE = {
  locationId: "",
  unitId: "",
  quantity: "",
  cost: "",
  postedAt: "",
  manufacturedOn: "",
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
    costPrice: "",
    sellingPrice: "",
    isActive: true,
    unitPrices: [],
    // One empty line is always there; a line with no location and no quantity is ignored on submit.
    openingStockLines: [{ ...BLANK_OPENING_LINE }],
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
    defaultShelfLifeValue:
      item.expirySettings?.defaultShelfLifeValue ?? undefined,
    defaultShelfLifeUnit:
      item.expirySettings?.defaultShelfLifeUnit ?? undefined,
    inventoryValuationMethod: item.inventoryValuationMethod,
    allowNegativeStock: item.allowNegativeStock,
    reorderPoint: item.reorderPoint ? trimQuantity(item.reorderPoint) : "",
    costPrice: item.costPrice ? trimQuantity(item.costPrice) : "",
    sellingPrice: item.sellingPrice ? trimQuantity(item.sellingPrice) : "",
    unitPrices: item.unitPrices.map((p) => ({
      unitId: p.unit.id,
      costPrice: p.costPrice ? trimQuantity(p.costPrice) : "",
      sellingPrice: p.sellingPrice ? trimQuantity(p.sellingPrice) : "",
    })),
    isActive: item.isActive,
  }
}

type UnitPriceValue = NonNullable<CreateItemFormValues["unitPrices"]>[number]

/** Rows with at least one price, in the API shape. Blank prices become null. */
export function toUnitPricesInput(rows: UnitPriceValue[] | undefined) {
  return (rows ?? [])
    .filter((r) => r.costPrice?.trim() || r.sellingPrice?.trim())
    .map((r) => ({
      unitId: r.unitId,
      costPrice: r.costPrice?.trim() || null,
      sellingPrice: r.sellingPrice?.trim() || null,
    }))
}

/**
 * `baseUnitId` (the base unit of the picked collection) lets a line entered in the base unit be sent
 * without a unitId. A line with no cost of its own defaults to the cost price set for its unit.
 */
export function toCreateItemInput(
  values: CreateItemFormValues,
  context: { baseUnitId?: string } = {}
): CreateItemInput {
  const unitCost = (unitId: string | undefined) =>
    !unitId || unitId === context.baseUnitId
      ? values.costPrice?.trim() || null
      : values.unitPrices?.find((p) => p.unitId === unitId)?.costPrice?.trim() ||
        null

  const validLines = (values.openingStockLines ?? [])
    .filter((l) => l.locationId && l.quantity)
    .map((l) => {
      const unitId =
        l.unitId && l.unitId !== context.baseUnitId ? l.unitId : undefined
      const postedAt = l.postedAt?.trim()
      return {
        locationId: l.locationId!,
        quantity: l.quantity,
        cost: l.cost?.trim() ? l.cost.trim() : unitCost(unitId),
        manufacturedOn: l.manufacturedOn || null,
        ...(unitId ? { unitId } : {}),
        ...(postedAt ? { postedAt } : {}),
      }
    })

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
    // The batch checkbox is gone from the form: inventory-tracked items are always batch tracked.
    isBatchTracked: values.isInventoryTracked,
    isExpiryTracked: values.isExpiryTracked,
    expirySettings:
      values.isExpiryTracked &&
      values.defaultShelfLifeValue &&
      values.defaultShelfLifeUnit
        ? {
            defaultShelfLifeValue: values.defaultShelfLifeValue,
            defaultShelfLifeUnit: values.defaultShelfLifeUnit,
          }
        : null,
    inventoryValuationMethod: values.inventoryValuationMethod,
    allowNegativeStock: values.allowNegativeStock,
    reorderPoint: values.reorderPoint || null,
    costPrice: values.costPrice || null,
    sellingPrice: values.sellingPrice || null,
    unitPrices: toUnitPricesInput(values.unitPrices),
    openingStock: validLines.length > 0 ? { lines: validLines } : undefined,
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
    isBatchTracked: values.isInventoryTracked,
    isExpiryTracked: values.isExpiryTracked,
    expirySettings:
      values.isExpiryTracked &&
      values.defaultShelfLifeValue &&
      values.defaultShelfLifeUnit
        ? {
            defaultShelfLifeValue: values.defaultShelfLifeValue,
            defaultShelfLifeUnit: values.defaultShelfLifeUnit,
          }
        : null,
    inventoryValuationMethod: values.inventoryValuationMethod,
    isActive: values.isActive,
    allowNegativeStock: values.allowNegativeStock,
    reorderPoint: values.reorderPoint || null,
    costPrice: values.costPrice || null,
    sellingPrice: values.sellingPrice || null,
    // The whole set: prices that were cleared are removed.
    unitPrices: toUnitPricesInput(values.unitPrices),
  }
}
