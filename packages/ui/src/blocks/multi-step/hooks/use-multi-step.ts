import { useCallback, useState } from "react"
import { getNextStep, getPreviousStep, getStepPosition } from "../lib/steps"

export type UseMultiStepOptions<T extends string> = {
  /** Ordered step ids. Declare at module level so callbacks stay stable. */
  steps: readonly [T, ...T[]]
  /** Defaults to the first step. */
  initialStep?: T
}

export function useMultiStep<T extends string>({
  steps,
  initialStep = steps[0],
}: UseMultiStepOptions<T>) {
  const [step, setStep] = useState<T>(initialStep)

  const goTo = useCallback((target: T) => setStep(target), [])
  const next = useCallback(
    () => setStep((current) => getNextStep(steps, current) ?? current),
    [steps]
  )
  const back = useCallback(
    () => setStep((current) => getPreviousStep(steps, current) ?? current),
    [steps]
  )
  const reset = useCallback(() => setStep(initialStep), [initialStep])

  const position = getStepPosition(steps, step)

  return {
    step,
    ...position,
    isFirst: position.current === 1,
    isLast: position.current === position.total,
    goTo,
    next,
    back,
    reset,
  }
}
