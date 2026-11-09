import { fail } from "@avuny/utils"
import type { RuleViolation } from "./rules.js"

export type Failure<C extends string = string> = { failed: true; error: C; msg: string }

/**
 * Small toolbox for services that return Result<T, Code> and run business checks inside
 * a transaction callback. Create it once per module with that module's error-code union:
 *
 *   const { failure, fromViolation, isFailure, toFail, failWith, abort, abortable } =
 *     createFailureKit<Code>()
 *
 * `failure(...)` is returned from a transaction body when NOTHING has been written yet.
 * `abort(...)` is for failures found AFTER a write: it throws inside the transaction so
 * the database rolls back, and `abortable(...)` turns that throw back into a Failure.
 */
export function createFailureKit<C extends string>() {
  class Abort extends Error {
    readonly failure: Failure<C>
    constructor(failure: Failure<C>) {
      super(failure.msg)
      this.failure = failure
    }
  }

  const failure = (error: C, msg: string): Failure<C> => ({ failed: true, error, msg })

  return {
    failure,
    fromViolation: (v: RuleViolation<C>): Failure<C> => failure(v.error, v.msg),
    isFailure: (v: unknown): v is Failure<C> =>
      typeof v === "object" && v !== null && (v as Failure<C>).failed === true,
    toFail: (f: Failure<C>) => fail({ error: f.error, msg: f.msg }),
    failWith: (v: RuleViolation<C>) => fail({ error: v.error, msg: v.msg }),
    abort: (f: Failure<C>): never => {
      throw new Abort(f)
    },
    async abortable<T>(run: () => Promise<T>): Promise<T | Failure<C>> {
      try {
        return await run()
      } catch (err) {
        if (err instanceof Abort) return err.failure
        throw err
      }
    },
  }
}
