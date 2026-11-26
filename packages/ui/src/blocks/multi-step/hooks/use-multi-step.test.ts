import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { useMultiStep } from "./use-multi-step"

const STEPS = ["identifier", "verify", "register"] as const

describe("useMultiStep", () => {
  it("starts on the first step", () => {
    const { result } = renderHook(() => useMultiStep({ steps: STEPS }))

    expect(result.current).toMatchObject({
      step: "identifier",
      current: 1,
      total: 3,
      isFirst: true,
      isLast: false,
    })
  })

  it("can start on another step", () => {
    const { result } = renderHook(() =>
      useMultiStep({ steps: STEPS, initialStep: "verify" })
    )

    expect(result.current.step).toBe("verify")
  })

  it("moves forward and back, stopping at both ends", () => {
    const { result } = renderHook(() => useMultiStep({ steps: STEPS }))

    act(() => result.current.back())
    expect(result.current.step).toBe("identifier")

    act(() => result.current.next())
    act(() => result.current.next())
    expect(result.current).toMatchObject({ step: "register", isLast: true })

    act(() => result.current.next())
    expect(result.current.step).toBe("register")

    act(() => result.current.back())
    expect(result.current.step).toBe("verify")
  })

  it("jumps to a step and resets to the initial one", () => {
    const { result } = renderHook(() =>
      useMultiStep({ steps: STEPS, initialStep: "verify" })
    )

    act(() => result.current.goTo("register"))
    expect(result.current.step).toBe("register")

    act(() => result.current.reset())
    expect(result.current.step).toBe("verify")
  })
})
