/**
 * Entitlement domain constants (saas-architecture SPEC 2.1, 3.1-3.3, 6.2).
 * Shared vocabulary for plans, entitlements, snapshots and module states.
 */

/** Kinds of entitlement, SPEC 2.1. The key prefix is the kind: `module.*`, `feature.*`, `limit.*`. */
export const ENTITLEMENT_KINDS = ["module", "feature", "limit"] as const
export type EntitlementKind = (typeof ENTITLEMENT_KINDS)[number]

/** Module state per organization, SPEC 3.3. */
export const MODULE_STATES = [
  "enabled",
  "off",
  "locked",
  "blocked_by_dependency",
  "winding_down",
] as const
export type ModuleState = (typeof MODULE_STATES)[number]

/** Organization access state, SPEC 3.2. Money problems never reach `suspended`. */
export const ACCESS_STATES = ["full", "grace", "restricted", "suspended"] as const
export type AccessState = (typeof ACCESS_STATES)[number]

/**
 * Subscription status, SPEC 3.1 (lifecycle owned by ../subscription/SPEC.md).
 * Only the first five are "live" and unique per organization (partial unique index).
 */
export const SUBSCRIPTION_STATUSES = [
  "created",
  "trialing",
  "active",
  "past_due",
  "canceling",
  "canceled",
  "expired",
] as const
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number]

export const SUBSCRIPTION_LIVE_STATUSES = [
  "created",
  "trialing",
  "active",
  "past_due",
  "canceling",
] as const satisfies readonly SubscriptionStatus[]

/** Billing intervals, plan/SPEC.md. `one_time` is for prices that do not renew. */
export const BILLING_INTERVALS = ["monthly", "yearly", "one_time"] as const
export type BillingInterval = (typeof BILLING_INTERVALS)[number]

/** Add-ons renew with the subscription, so no `one_time` (plan/SPEC.md). */
export const ADDON_BILLING_INTERVALS = ["monthly", "yearly"] as const
export type AddonBillingInterval = (typeof ADDON_BILLING_INTERVALS)[number]

/** `limit.*` value meaning "no quota" (SPEC 2.1). */
export const LIMIT_UNLIMITED = -1

export const PLAN_CODE_PATTERN = /^[a-z][a-z0-9_]*$/
export const PLAN_CODE_MAX_LENGTH = 50
export const PLAN_NAME_MAX_LENGTH = 100
export const ADDON_CODE_MAX_LENGTH = 50
export const OVERRIDE_REASON_MAX_LENGTH = 500
export const PROVIDER_PRICE_REF_MAX_LENGTH = 200
