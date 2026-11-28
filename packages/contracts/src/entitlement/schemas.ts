import { z } from "@avuny/zod"

import {
  PRODUCT_MODULE_KEYS,
} from "../modules/product-modules.js"
import {
  ACCESS_STATES,
  ADDON_BILLING_INTERVALS,
  ADDON_CODE_MAX_LENGTH,
  BILLING_INTERVALS,
  ENTITLEMENT_KINDS,
  LIMIT_UNLIMITED,
  MODULE_STATES,
  OVERRIDE_REASON_MAX_LENGTH,
  PLAN_CODE_MAX_LENGTH,
  PLAN_CODE_PATTERN,
  PLAN_NAME_MAX_LENGTH,
  PROVIDER_PRICE_REF_MAX_LENGTH,
  SUBSCRIPTION_STATUSES,
} from "./constants.js"

const id = z.string().uuid()
const timestamp = z.string().datetime()
/** ISO 4217 currency code. */
const currency = z.string().trim().length(3).toUpperCase()
/** Integer minor units as a string ("12500" = 125.00 in a two-decimal currency). */
const minorAmount = z.string().trim().regex(/^\d{1,15}$/, "Invalid amount")

/* ---------- entitlement keys (SPEC 2.1) ---------- */

export const EntitlementKindSchema = z.enum(ENTITLEMENT_KINDS)

/** Feature/limit names: snake_case, dotted segments allowed (`inventory.batch_tracking`). */
const keyName = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/, "Invalid entitlement key name")

export const ModuleEntitlementKeySchema = z
  .string()
  .startsWith("module.")
  .refine(
    (key) =>
      (PRODUCT_MODULE_KEYS as readonly string[]).includes(key.slice(7)),
    "Unknown product module"
  )
export const FeatureEntitlementKeySchema = z
  .string()
  .startsWith("feature.")
  .refine((key) => keyName.safeParse(key.slice(8)).success, "Invalid feature key")
export const LimitEntitlementKeySchema = z
  .string()
  .startsWith("limit.")
  .refine((key) => keyName.safeParse(key.slice(6)).success, "Invalid limit key")

/** `module.<key>`, `feature.<name>` or `limit.<name>` (SPEC 2.1). */
export const EntitlementKeySchema = z.union([
  ModuleEntitlementKeySchema,
  FeatureEntitlementKeySchema,
  LimitEntitlementKeySchema,
])
export type EntitlementKey = z.infer<typeof EntitlementKeySchema>

export const moduleEntitlementKey = (productModule: string) =>
  `module.${productModule}` as const
export const featureEntitlementKey = (name: string) =>
  `feature.${name}` as const
export const limitEntitlementKey = (name: string) => `limit.${name}` as const

/** The kind is the key prefix; they can never disagree. */
export const entitlementKindOf = (
  key: EntitlementKey
): z.infer<typeof EntitlementKindSchema> =>
  key.startsWith("module.")
    ? "module"
    : key.startsWith("feature.")
      ? "feature"
      : "limit"

/**
 * Resolved value for one entitlement: modules and boolean features are
 * boolean, enum features are a string, limits are an integer
 * (`-1` = unlimited, SPEC 2.1).
 */
export const EntitlementValueSchema = z.union([
  z.boolean(),
  z.string(),
  z.number().int(),
])
export type EntitlementValue = z.infer<typeof EntitlementValueSchema>

/** Limit value: integer, `-1` means unlimited (LIMIT_UNLIMITED). */
export const LimitValueSchema = z.number().int().min(LIMIT_UNLIMITED)

/* ---------- plans and add-ons (plan/SPEC.md, SPEC 5) ---------- */

export const BillingIntervalSchema = z.enum(BILLING_INTERVALS)
export const AddonBillingIntervalSchema = z.enum(ADDON_BILLING_INTERVALS)
export const SubscriptionStatusSchema = z.enum(SUBSCRIPTION_STATUSES)

export const PlanSchema = z.object({
  id,
  code: z.string().trim().regex(PLAN_CODE_PATTERN).max(PLAN_CODE_MAX_LENGTH),
  name: z.string().trim().min(1).max(PLAN_NAME_MAX_LENGTH),
  /** Ladder position; higher tier includes more. */
  tier: z.number().int().min(0),
  /** Shown on the public pricing page (Q10 hides `legacy`). */
  isPublic: z.boolean(),
  /** Self-serve checkout allowed; Enterprise is admin-grant only (Q8). */
  isPurchasable: z.boolean(),
  /** Default trial length in days, 0 = no trial (Q4: 14 for Pro). */
  trialDays: z.number().int().min(0),
  sort: z.number().int().min(0),
  metadata: z.record(z.string(), z.unknown()).nullish(),
})
export type Plan = z.infer<typeof PlanSchema>

export const PlanInputSchema = PlanSchema.omit({ id: true })
export type PlanInput = z.infer<typeof PlanInputSchema>

export const PlanPriceSchema = z.object({
  id,
  planId: id,
  currency,
  interval: BillingIntervalSchema,
  amountMinor: minorAmount,
  /** Adapter-specific price reference (R19: no runtime exchange rate). */
  providerPriceRef: z.string().trim().max(PROVIDER_PRICE_REF_MAX_LENGTH).nullish(),
  isActive: z.boolean(),
})
export type PlanPrice = z.infer<typeof PlanPriceSchema>

export const PlanPriceInputSchema = PlanPriceSchema.omit({ id: true })
export type PlanPriceInput = z.infer<typeof PlanPriceInputSchema>

/**
 * One row of what a plan includes (SPEC 5 `plan_entitlements`): the kind is
 * carried by the key prefix, the value shape follows the kind.
 */
export const PlanEntitlementSchema = z
  .object({
    id,
    planId: id,
    key: EntitlementKeySchema,
    value: EntitlementValueSchema,
  })
  .superRefine((row, ctx) => {
    if (row.key.startsWith("module.") && typeof row.value !== "boolean") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Module entitlements are boolean",
      })
    }
    if (
      row.key.startsWith("limit.") &&
      (typeof row.value !== "number" ||
        !Number.isInteger(row.value) ||
        row.value < LIMIT_UNLIMITED)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Limit entitlements are integers, -1 = unlimited",
      })
    }
  })
export type PlanEntitlement = z.infer<typeof PlanEntitlementSchema>

export const PlanEntitlementInputSchema = z.object({
  key: EntitlementKeySchema,
  value: EntitlementValueSchema,
})
export type PlanEntitlementInput = z.infer<typeof PlanEntitlementInputSchema>

export const AddonSchema = z.object({
  id,
  code: z.string().trim().regex(PLAN_CODE_PATTERN).max(ADDON_CODE_MAX_LENGTH),
  name: z.string().trim().min(1).max(PLAN_NAME_MAX_LENGTH),
  /** What the add-on grants (modules, features) or increments (limits). */
  key: EntitlementKeySchema,
  /** Limit add-ons add this per quantity; module/feature add-ons use 1. */
  increment: z.number().int().min(1),
  isActive: z.boolean(),
})
export type Addon = z.infer<typeof AddonSchema>

export const AddonInputSchema = AddonSchema.omit({ id: true })
export type AddonInput = z.infer<typeof AddonInputSchema>

export const AddonPriceSchema = z.object({
  id,
  addonId: id,
  currency,
  interval: AddonBillingIntervalSchema,
  amountMinor: minorAmount,
  providerPriceRef: z.string().trim().max(PROVIDER_PRICE_REF_MAX_LENGTH).nullish(),
  isActive: z.boolean(),
})
export type AddonPrice = z.infer<typeof AddonPriceSchema>

/* ---------- switches, overrides, snapshot (SPEC 3.2, 3.3, 5) ---------- */

export const ModuleStateSchema = z.enum(MODULE_STATES)
export const AccessStateSchema = z.enum(ACCESS_STATES)

/**
 * Owner switch row (`organization_modules`). Rows are created lazily; a
 * missing row means the catalog `defaultOn` for that module (SPEC 5).
 */
export const ModuleSwitchSchema = z.object({
  moduleKey: z.enum(PRODUCT_MODULE_KEYS),
  enabled: z.boolean(),
})
export type ModuleSwitch = z.infer<typeof ModuleSwitchSchema>

/** Admin grant (`organization_entitlement_overrides`), R1: applied last. */
export const EntitlementOverrideSchema = z.object({
  id,
  orgId: id,
  key: EntitlementKeySchema,
  value: EntitlementValueSchema,
  reason: z.string().trim().min(1).max(OVERRIDE_REASON_MAX_LENGTH),
  grantedBy: id,
  /** Null = no expiry. */
  expiresAt: timestamp.nullish(),
})
export type EntitlementOverride = z.infer<typeof EntitlementOverrideSchema>

export const EntitlementOverrideInputSchema = EntitlementOverrideSchema.omit({
  id: true,
})
export type EntitlementOverrideInput = z.infer<typeof EntitlementOverrideInputSchema>

/** Per-module resolution inside the snapshot (SPEC 3.3). */
export const ResolvedModuleSchema = z.object({
  state: ModuleStateSchema,
  /** Plan, add-on or override grants the module (before switch/deps). */
  entitled: z.boolean(),
  /** Owner switch position (catalog defaultOn when never switched). */
  switchedOn: z.boolean(),
})
export type ResolvedModule = z.infer<typeof ResolvedModuleSchema>

/**
 * Stored resolution for one organization (`organization_entitlements`),
 * recomputed in the same transaction as any input change; `version` bumps
 * every recompute and readers compare versions, no time-based cache (R5).
 */
export const EntitlementSnapshotSchema = z.object({
  orgId: id,
  version: z.number().int().min(0),
  accessState: AccessStateSchema,
  /** Every product module, keyed by its catalog key. */
  modules: z.record(z.enum(PRODUCT_MODULE_KEYS), ResolvedModuleSchema),
  /** Resolved `feature.*` values (boolean or enum string). */
  features: z.record(z.string(), z.union([z.boolean(), z.string()])),
  /** Resolved `limit.*` values (-1 = unlimited). */
  limits: z.record(z.string(), LimitValueSchema),
  computedAt: timestamp,
})
export type EntitlementSnapshot = z.infer<typeof EntitlementSnapshotSchema>
