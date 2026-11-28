/**
 * @avuny/entitlements: shared, runtime-agnostic entitlement domain code
 * (resolver, snapshot recompute, plan publish rules) used by both
 * `apps/server` (reads) and `apps/platform-server` (reads and writes).
 *
 * SCAFFOLD ONLY. No business logic yet. The resolver arrives in phase S2 of
 * docs/modules/saas-architecture/PROGRESS.md. Schemas live in `@avuny/contracts`
 * (contracts first); this package imports them, it does not redefine them.
 */

// Contracts own the vocabulary (S2-01); re-exported so existing imports keep working.
export { ENTITLEMENT_KINDS, type EntitlementKind } from "@avuny/contracts/entitlement"
