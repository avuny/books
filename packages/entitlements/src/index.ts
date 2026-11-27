/**
 * @avuny/entitlements: shared, runtime-agnostic entitlement domain code
 * (resolver, snapshot recompute, plan publish rules) used by both
 * `apps/server` (reads) and `apps/platform-server` (reads and writes).
 *
 * SCAFFOLD ONLY. No business logic yet. The resolver arrives in phase S2 of
 * docs/modules/saas-architecture/PROGRESS.md. Schemas live in `@avuny/contracts`
 * (contracts first); this package imports them, it does not redefine them.
 */

/** Kinds of entitlement, see docs/modules/saas-architecture/SPEC.md section 2.1. */
export const ENTITLEMENT_KINDS = ["module", "feature", "limit"] as const
export type EntitlementKind = (typeof ENTITLEMENT_KINDS)[number]
