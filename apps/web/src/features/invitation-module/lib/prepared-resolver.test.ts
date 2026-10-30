import { describe, expect, it } from "vitest"

import { createPreparedResolver } from "./prepared-resolver"

type Values = { email: string }

// A hand-rolled schema keeps this test free of any zod dependency.
const schema = {
  safeParse(input: unknown) {
    const { email } = input as { email?: string }
    if (email === undefined) {
      return {
        success: false as const,
        error: {
          issues: [
            { path: ["email"], code: "custom", message: "Email required" },
            { path: ["email"], code: "custom", message: "second issue is ignored" },
          ],
        },
      }
    }
    return { success: true as const, data: { email } }
  },
}

const prepare = (values: Values) => ({ email: values.email.trim() || undefined })
const resolver = createPreparedResolver<Values, { email: string }>(schema, prepare)
const options = {} as never

describe("createPreparedResolver", () => {
  it("returns the parsed output when the prepared values are valid", async () => {
    const result = await resolver({ email: " a@b.co " }, undefined, options)
    expect(result).toEqual({ values: { email: "a@b.co" }, errors: {} })
  })

  it("reports the first issue per field when validation fails", async () => {
    const result = await resolver({ email: "   " }, undefined, options)
    expect(result.values).toEqual({})
    expect(result.errors).toEqual({
      email: { type: "custom", message: "Email required" },
    })
  })
})
