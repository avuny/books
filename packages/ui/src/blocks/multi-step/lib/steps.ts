export type StepPosition = {
  /** 1-based position of the active step, or 0 if it isn't in the list. */
  current: number
  total: number
}

export function getStepPosition<T extends string>(
  steps: readonly T[],
  step: T
): StepPosition {
  return { current: steps.indexOf(step) + 1, total: steps.length }
}

export function getNextStep<T extends string>(
  steps: readonly T[],
  step: T
): T | undefined {
  const index = steps.indexOf(step)
  return index === -1 ? undefined : steps[index + 1]
}

export function getPreviousStep<T extends string>(
  steps: readonly T[],
  step: T
): T | undefined {
  const index = steps.indexOf(step)
  return index > 0 ? steps[index - 1] : undefined
}
