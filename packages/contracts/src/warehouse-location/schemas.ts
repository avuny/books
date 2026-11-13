import { z } from "@avuny/zod"
import { WAREHOUSE_TYPES } from "../warehouse/constants.js"
import {
  WAREHOUSE_LOCATION_BARCODE_MAX_LENGTH,
  WAREHOUSE_LOCATION_BARCODE_MIN_LENGTH,
  WAREHOUSE_LOCATION_BARCODE_REGEX,
  WAREHOUSE_LOCATION_BLOCK_REASON_MAX_LENGTH,
  WAREHOUSE_LOCATION_BULK_MAX_LEVELS,
  WAREHOUSE_LOCATION_BULK_MAX_NODES,
  WAREHOUSE_LOCATION_BULK_PAD_MAX,
  WAREHOUSE_LOCATION_BULK_PREFIX_MAX_LENGTH,
  WAREHOUSE_LOCATION_CODE_MAX_LENGTH,
  WAREHOUSE_LOCATION_CODE_MIN_LENGTH,
  WAREHOUSE_LOCATION_CODE_PREFIX_REGEX,
  WAREHOUSE_LOCATION_CODE_REGEX,
  WAREHOUSE_LOCATION_DIMENSION_REGEX,
  WAREHOUSE_LOCATION_LIST_DEFAULT_PAGE_SIZE,
  WAREHOUSE_LOCATION_LIST_MAX_PAGE_SIZE,
  WAREHOUSE_LOCATION_NAME_MAX_LENGTH,
  WAREHOUSE_LOCATION_NAME_MIN_LENGTH,
  WAREHOUSE_LOCATION_OPTIONS_DEFAULT_LIMIT,
  WAREHOUSE_LOCATION_OPTIONS_MAX_LIMIT,
  WAREHOUSE_LOCATION_PURPOSES,
  WAREHOUSE_LOCATION_SORT_ORDER_MAX,
  WAREHOUSE_LOCATION_TYPES,
  WAREHOUSE_LOCATION_VOLUME_REGEX,
  WAREHOUSE_LOCATION_WEIGHT_REGEX,
} from "./constants.js"

const queryBoolean = z.enum(["true", "false"]).transform((v) => v === "true")

/* ---------- fields ---------- */

const codeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(WAREHOUSE_LOCATION_CODE_MIN_LENGTH)
  .max(WAREHOUSE_LOCATION_CODE_MAX_LENGTH)
  .regex(WAREHOUSE_LOCATION_CODE_REGEX)
const nameSchema = z
  .string()
  .trim()
  .min(WAREHOUSE_LOCATION_NAME_MIN_LENGTH)
  .max(WAREHOUSE_LOCATION_NAME_MAX_LENGTH)
const barcodeSchema = z
  .string()
  .trim()
  .min(WAREHOUSE_LOCATION_BARCODE_MIN_LENGTH)
  .max(WAREHOUSE_LOCATION_BARCODE_MAX_LENGTH)
  .regex(WAREHOUSE_LOCATION_BARCODE_REGEX)
const sortOrderSchema = z.number().int().min(0).max(WAREHOUSE_LOCATION_SORT_ORDER_MAX)
const typeSchema = z.enum(WAREHOUSE_LOCATION_TYPES)
const purposeSchema = z.enum(WAREHOUSE_LOCATION_PURPOSES)
// Decimal strings: numeric columns are returned as strings and never converted to number.
const dimensionSchema = z.string().trim().regex(WAREHOUSE_LOCATION_DIMENSION_REGEX)
const weightSchema = z.string().trim().regex(WAREHOUSE_LOCATION_WEIGHT_REGEX)
const volumeSchema = z.string().trim().regex(WAREHOUSE_LOCATION_VOLUME_REGEX)

/** Dimensions are millimetres, weight kilograms, volume cubic metres. `null` clears a value. */
const measureFields = {
  width: dimensionSchema.nullish(),
  height: dimensionSchema.nullish(),
  depth: dimensionSchema.nullish(),
  maxWeight: weightSchema.nullish(),
  maxVolume: volumeSchema.nullish(),
}

/* ---------- create / update ---------- */

export const CreateWarehouseLocationSchema = z
  .object({
    /** Omit or null to create a root location. */
    parentId: z.string().uuid().nullish(),
    code: codeSchema,
    /** Defaults to the code. */
    name: nameSchema.optional(),
    type: typeSchema,
    /** Defaults to the parent's purpose, then storage. */
    purpose: purposeSchema.optional(),
    /** Flags default from type and purpose; explicit values win. */
    isStockable: z.boolean().optional(),
    isPickable: z.boolean().optional(),
    isReceivable: z.boolean().optional(),
    /** Omit to auto-generate an opaque barcode. */
    barcode: barcodeSchema.optional(),
    sortOrder: sortOrderSchema.default(0),
    ...measureFields,
  })
  .refine((v) => !(v.isStockable === false && (v.isPickable === true || v.isReceivable === true)), {
    message: "Pickable and receivable locations must be stockable",
    path: ["isStockable"],
  })
export type CreateWarehouseLocationInput = z.infer<typeof CreateWarehouseLocationSchema>

// An array does not appear here; every field replaces the stored value. `null` clears a measure.
export const UpdateWarehouseLocationSchema = z
  .object({
    code: codeSchema.optional(),
    name: nameSchema.optional(),
    type: typeSchema.optional(),
    purpose: purposeSchema.optional(),
    /** With a purpose change: copy the purpose (and its default flags) to every descendant. */
    applyToDescendants: z.boolean().optional(),
    isStockable: z.boolean().optional(),
    isPickable: z.boolean().optional(),
    isReceivable: z.boolean().optional(),
    sortOrder: sortOrderSchema.optional(),
    ...measureFields,
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "At least one field must be provided",
  })
export type UpdateWarehouseLocationInput = z.infer<typeof UpdateWarehouseLocationSchema>

export const MoveWarehouseLocationSchema = z.object({
  /** New parent in the same warehouse; null moves the location to the root. */
  parentId: z.string().uuid().nullable(),
  sortOrder: sortOrderSchema.optional(),
})
export type MoveWarehouseLocationInput = z.infer<typeof MoveWarehouseLocationSchema>

export const BlockWarehouseLocationSchema = z.object({
  reason: z.string().trim().min(1).max(WAREHOUSE_LOCATION_BLOCK_REASON_MAX_LENGTH),
})
export type BlockWarehouseLocationInput = z.infer<typeof BlockWarehouseLocationSchema>

export const DeactivateWarehouseLocationQuerySchema = z.object({
  /** Also deactivate every active descendant. */
  cascade: queryBoolean.optional(),
})
export type DeactivateWarehouseLocationQuery = z.infer<typeof DeactivateWarehouseLocationQuerySchema>

export const ChangeWarehouseLocationBarcodeSchema = z.object({
  /** Omit to generate a new opaque barcode. Changing it invalidates printed labels. */
  barcode: barcodeSchema.optional(),
})
export type ChangeWarehouseLocationBarcodeInput = z.infer<
  typeof ChangeWarehouseLocationBarcodeSchema
>

/* ---------- bulk generation ---------- */

const bulkLevelSchema = z
  .object({
    type: typeSchema,
    prefix: z
      .string()
      .trim()
      .toUpperCase()
      .max(WAREHOUSE_LOCATION_BULK_PREFIX_MAX_LENGTH)
      .regex(WAREHOUSE_LOCATION_CODE_PREFIX_REGEX),
    start: z.number().int().min(0).max(WAREHOUSE_LOCATION_BULK_MAX_NODES),
    count: z.number().int().min(1).max(WAREHOUSE_LOCATION_BULK_MAX_NODES),
    pad: z.number().int().min(0).max(WAREHOUSE_LOCATION_BULK_PAD_MAX).default(2),
  })
  .refine(
    (l) =>
      l.prefix.length + Math.max(l.pad, String(l.start + l.count - 1).length) <=
      WAREHOUSE_LOCATION_CODE_MAX_LENGTH,
    { message: "Generated codes would be too long", path: ["prefix"] }
  )

/** One request builds a cross-product branch: every node of a level gets `count` children of the next. */
export const BulkCreateWarehouseLocationsSchema = z.object({
  parentId: z.string().uuid().nullish(),
  levels: z.array(bulkLevelSchema).min(1).max(WAREHOUSE_LOCATION_BULK_MAX_LEVELS),
  purpose: purposeSchema.optional(),
  /** Report counts and sample codes without writing anything. */
  dryRun: z.boolean().default(false),
})
export type BulkCreateWarehouseLocationsInput = z.infer<typeof BulkCreateWarehouseLocationsSchema>

export const BulkCreateWarehouseLocationsResultSchema = z.object({
  dryRun: z.boolean(),
  total: z.number().int(),
  countsByType: z.record(typeSchema, z.number().int()),
  sampleFullCodes: z.array(z.string()),
})
export type BulkCreateWarehouseLocationsResult = z.infer<
  typeof BulkCreateWarehouseLocationsResultSchema
>

/* ---------- DTOs ---------- */

const flagsDto = {
  isStockable: z.boolean(),
  isPickable: z.boolean(),
  isReceivable: z.boolean(),
  isActive: z.boolean(),
  isBlocked: z.boolean(),
}

export const WarehouseLocationDtoSchema = z.object({
  id: z.string().uuid(),
  warehouseId: z.string().uuid(),
  parentId: z.string().uuid().nullable(),
  code: z.string(),
  fullCode: z.string(),
  name: z.string(),
  type: typeSchema,
  purpose: purposeSchema,
  treeDepth: z.number().int(),
  barcode: z.string().nullable(),
  sortOrder: z.number().int(),
  ...flagsDto,
  blockedReason: z.string().nullable(),
  blockedAt: z.string().datetime().nullable(),
  /** True when the location or any ancestor is blocked. */
  effectiveIsBlocked: z.boolean(),
  hasChildren: z.boolean(),
  width: z.string().nullable(),
  height: z.string().nullable(),
  depth: z.string().nullable(),
  maxWeight: z.string().nullable(),
  maxVolume: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type WarehouseLocationDto = z.infer<typeof WarehouseLocationDtoSchema>

export const WarehouseLocationPathItemSchema = z.object({
  id: z.string().uuid(),
  code: z.string(),
  name: z.string(),
  type: typeSchema,
})

export const WarehouseLocationDetailDtoSchema = WarehouseLocationDtoSchema.extend({
  /** Ancestors from the root down to (and including) this location. */
  path: z.array(WarehouseLocationPathItemSchema),
  warehouse: z.object({
    id: z.string().uuid(),
    code: z.string(),
    name: z.string(),
    type: z.enum(WAREHOUSE_TYPES),
    isActive: z.boolean(),
  }),
})
export type WarehouseLocationDetailDto = z.infer<typeof WarehouseLocationDetailDtoSchema>

export const WarehouseLocationListItemDtoSchema = z.object({
  id: z.string().uuid(),
  warehouseId: z.string().uuid(),
  parentId: z.string().uuid().nullable(),
  code: z.string(),
  fullCode: z.string(),
  name: z.string(),
  type: typeSchema,
  purpose: purposeSchema,
  treeDepth: z.number().int(),
  barcode: z.string().nullable(),
  sortOrder: z.number().int(),
  ...flagsDto,
  effectiveIsBlocked: z.boolean(),
  updatedAt: z.string().datetime(),
})
export type WarehouseLocationListItemDto = z.infer<typeof WarehouseLocationListItemDtoSchema>

export const DeleteWarehouseLocationResultSchema = z.object({ id: z.string().uuid() })
export type DeleteWarehouseLocationResult = z.infer<typeof DeleteWarehouseLocationResultSchema>

/* ---------- list (data table) ---------- */

export const WarehouseLocationOffsetListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(WAREHOUSE_LOCATION_LIST_MAX_PAGE_SIZE)
    .default(WAREHOUSE_LOCATION_LIST_DEFAULT_PAGE_SIZE),
  /** Matches code, name, full code or barcode. */
  search: z.string().trim().max(WAREHOUSE_LOCATION_NAME_MAX_LENGTH).optional(),
  warehouseId: z.string().uuid().optional(),
  parentId: z.string().uuid().optional(),
  rootOnly: queryBoolean.optional(),
  type: typeSchema.optional(),
  purpose: purposeSchema.optional(),
  isStockable: queryBoolean.optional(),
  isPickable: queryBoolean.optional(),
  isReceivable: queryBoolean.optional(),
  isActive: queryBoolean.optional(),
  /** Effective: true when the location or any ancestor is blocked. */
  isBlocked: queryBoolean.optional(),
  /** Stockable, active, in an active warehouse and not effectively blocked. */
  usable: queryBoolean.optional(),
})
export type WarehouseLocationOffsetListQuery = z.infer<
  typeof WarehouseLocationOffsetListQuerySchema
>

export const WarehouseLocationOffsetListResponseSchema = z.object({
  items: z.array(WarehouseLocationListItemDtoSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
})
export type WarehouseLocationOffsetListResponse = z.infer<
  typeof WarehouseLocationOffsetListResponseSchema
>

/* ---------- options (select combobox, cursor paginated) ---------- */

export const WarehouseLocationOptionListQuerySchema = z.object({
  search: z.string().trim().max(WAREHOUSE_LOCATION_NAME_MAX_LENGTH).optional(),
  warehouseId: z.string().uuid().optional(),
  purpose: purposeSchema.optional(),
  /** Defaults to true: pickers normally want stockable locations only. */
  stockableOnly: queryBoolean.optional(),
  /** Only locations that cannot hold stock, i.e. valid parents for new locations. Overrides stockableOnly. */
  containerOnly: queryBoolean.optional(),
  pickableOnly: queryBoolean.optional(),
  receivableOnly: queryBoolean.optional(),
  /** Defaults to true: hide inactive and effectively blocked locations. */
  usableOnly: queryBoolean.optional(),
  cursor: z.string().max(512).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(WAREHOUSE_LOCATION_OPTIONS_MAX_LIMIT)
    .default(WAREHOUSE_LOCATION_OPTIONS_DEFAULT_LIMIT),
})
export type WarehouseLocationOptionListQuery = z.infer<
  typeof WarehouseLocationOptionListQuerySchema
>

export const WarehouseLocationOptionCursorSchema = z.object({
  name: z.string(),
  id: z.string().uuid(),
})
export type WarehouseLocationOptionCursor = z.infer<typeof WarehouseLocationOptionCursorSchema>

/* ---------- tree, lookup, next code ---------- */

/**
 * Flat list for a warehouse (or the subtree under `parentId`). Clients nest it by parentId;
 * siblings arrive ordered by sortOrder then code.
 */
export const WarehouseLocationTreeQuerySchema = z.object({
  /** Lazy loading: return only descendants of this location. */
  parentId: z.string().uuid().optional(),
  /** Number of levels to return below the parent (or from the roots). Omit for everything. */
  depth: z.coerce.number().int().min(1).max(7).optional(),
  includeInactive: queryBoolean.optional(),
})
export type WarehouseLocationTreeQuery = z.infer<typeof WarehouseLocationTreeQuerySchema>

export const WarehouseLocationTreeNodeSchema = z.object({
  id: z.string().uuid(),
  parentId: z.string().uuid().nullable(),
  code: z.string(),
  fullCode: z.string(),
  name: z.string(),
  type: typeSchema,
  purpose: purposeSchema,
  treeDepth: z.number().int(),
  sortOrder: z.number().int(),
  isStockable: z.boolean(),
  isActive: z.boolean(),
  isBlocked: z.boolean(),
  hasChildren: z.boolean(),
})
export const WarehouseLocationTreeResponseSchema = z.object({
  items: z.array(WarehouseLocationTreeNodeSchema),
})
export type WarehouseLocationTreeResponse = z.infer<typeof WarehouseLocationTreeResponseSchema>

/** Scan lookup: a barcode, or a full code inside a warehouse. */
export const WarehouseLocationLookupQuerySchema = z
  .object({
    barcode: barcodeSchema.optional(),
    warehouseId: z.string().uuid().optional(),
    fullCode: z.string().trim().min(1).max(255).optional(),
  })
  .refine((v) => (v.barcode !== undefined) !== (v.fullCode !== undefined && v.warehouseId !== undefined), {
    message: "Provide either barcode, or warehouseId together with fullCode",
  })
export type WarehouseLocationLookupQuery = z.infer<typeof WarehouseLocationLookupQuerySchema>

export const WarehouseLocationNextCodeQuerySchema = z.object({
  parentId: z.string().uuid().optional(),
  prefix: z
    .string()
    .trim()
    .toUpperCase()
    .max(WAREHOUSE_LOCATION_BULK_PREFIX_MAX_LENGTH)
    .regex(WAREHOUSE_LOCATION_CODE_PREFIX_REGEX),
  pad: z.coerce.number().int().min(0).max(WAREHOUSE_LOCATION_BULK_PAD_MAX).default(2),
})
export type WarehouseLocationNextCodeQuery = z.infer<typeof WarehouseLocationNextCodeQuerySchema>

export const WarehouseLocationNextCodeResponseSchema = z.object({ code: z.string() })
export type WarehouseLocationNextCodeResponse = z.infer<
  typeof WarehouseLocationNextCodeResponseSchema
>
