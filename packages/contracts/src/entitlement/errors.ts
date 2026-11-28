/**
 * Entitlement error codes (saas-architecture SPEC 6.2). UPPER_SNAKE, stable:
 * clients and tests match on these strings.
 */
export const EntitlementErrorCode = {
  /** R10: module switched off or locked for this organization. */
  MODULE_NOT_ENABLED: "MODULE_NOT_ENABLED",
  /** R3: enabling blocked because a dependency is locked; body names it. */
  MODULE_DEPENDENCY_LOCKED: "MODULE_DEPENDENCY_LOCKED",
  /** R4: disabling blocked because dependents use it; body lists them. */
  MODULE_REQUIRED_BY: "MODULE_REQUIRED_BY",
  /** R10: feature not granted by plan, add-on or override. */
  FEATURE_NOT_IN_PLAN: "FEATURE_NOT_IN_PLAN",
  /** R10/R11/R12: numeric quota reached; creation blocked, reads stay open. */
  LIMIT_REACHED: "LIMIT_REACHED",
  /** R6: unknown catalog key in a plan, add-on, override or seed. */
  ENTITLEMENT_KEY_UNKNOWN: "ENTITLEMENT_KEY_UNKNOWN",
  /** Plan is not purchasable (hidden, legacy or admin-grant only). */
  PLAN_NOT_PURCHASABLE: "PLAN_NOT_PURCHASABLE",
  /** SPEC 3.2: write blocked by the organization's access state. */
  SUBSCRIPTION_ACCESS_RESTRICTED: "SUBSCRIPTION_ACCESS_RESTRICTED",
} as const

export type EntitlementErrorCode =
  (typeof EntitlementErrorCode)[keyof typeof EntitlementErrorCode]
