import type { FieldErrors, FieldValues, Resolver } from "react-hook-form"

/** The part of a zod schema the resolver needs (works with any zod version). */
type SafeParsable<TOutput> = {
  safeParse(input: unknown):
    | { success: true; data: TOutput }
    | {
        success: false
        error: {
          issues: ReadonlyArray<{
            path: ReadonlyArray<PropertyKey>
            code: string
            message: string
          }>
        }
      }
}

/**
 * A react-hook-form resolver that validates `prepare(values)` instead of the raw
 * form values. Text inputs hold "" when empty, which a contract schema reads as a
 * bad value rather than "not sent"; `prepare` turns blanks into undefined first.
 * Issues are reported under their field path (the first issue per field wins).
 */
export function createPreparedResolver<TValues extends FieldValues, TOutput>(
  schema: SafeParsable<TOutput>,
  prepare: (values: TValues) => unknown
): Resolver<TValues, unknown, TOutput> {
  return (values) => {
    const result = schema.safeParse(prepare(values))
    if (result.success) return { values: result.data, errors: {} }

    const errors: Record<string, { type: string; message: string }> = {}
    for (const issue of result.error.issues) {
      const name = issue.path.map(String).join(".")
      if (name && !(name in errors)) {
        errors[name] = { type: issue.code, message: issue.message }
      }
    }
    return { values: {}, errors: errors as FieldErrors<TValues> }
  }
}
