import { describe, expect, it } from "vitest"
import { getNextStep, getPreviousStep, getStepPosition } from "./steps"

const STEPS = ["identifier", "verify", "register"] as const
type Step = (typeof STEPS)[number]
const UNKNOWN = "unknown" as never

describe("getStepPosition", () => {
  it.each<[Step, number]>([
    ["identifier", 1],
    ["verify", 2],
    ["register", 3],
  ])("%s is step %i of 3", (step, current) => {
    expect(getStepPosition(STEPS, step)).toEqual({ current, total: 3 })
  })

  it("is 0 for a step outside the list", () => {
    expect(getStepPosition(STEPS, UNKNOWN)).toEqual({ current: 0, total: 3 })
  })
})

describe("getNextStep / getPreviousStep", () => {
  it("move one step along the list", () => {
    expect(getNextStep(STEPS, "identifier")).toBe("verify")
    expect(getPreviousStep(STEPS, "register")).toBe("verify")
  })

  it("return undefined at either end", () => {
    expect(getNextStep(STEPS, "register")).toBeUndefined()
    expect(getPreviousStep(STEPS, "identifier")).toBeUndefined()
  })

  it("return undefined for a step outside the list", () => {
    expect(getNextStep(STEPS, UNKNOWN)).toBeUndefined()
    expect(getPreviousStep(STEPS, UNKNOWN)).toBeUndefined()
  })
})
