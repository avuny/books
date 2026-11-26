/**
 * Building blocks for every `<module>.rules.ts`.
 *
 * A rules file is PURE: no I/O, no injected dependencies, no throwing for business
 * outcomes. It answers questions about data the service already loaded and returns either
 * `null` (all good), a RuleViolation, or a RuleResult that carries a value. The service
 * decides when to load data and how to turn a violation into a domain failure.
 */
export interface RuleViolation<C extends string = string> {
  error: C
  msg: string
}

export type RuleResult<T, C extends string = string> =
  | { ok: true; value: T }
  | { ok: false; violation: RuleViolation<C> }

export const violation = <C extends string>(error: C, msg: string): RuleViolation<C> => ({
  error,
  msg,
})

export const pass = <T>(value: T): { ok: true; value: T } => ({ ok: true, value })

export const reject = <C extends string>(
  error: C,
  msg: string
): { ok: false; violation: RuleViolation<C> } => ({ ok: false, violation: { error, msg } })
