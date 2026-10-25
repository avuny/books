import type { ComponentType } from "react"
import { cn } from "@workspace/ui/lib/utils"
import { getStepPosition, type StepPosition } from "../lib/steps"
import { StepProgress, type StepProgressProps } from "./step-progress"
import { StepSwitch, type StepViews } from "./step-switch"

export type MultiStepFlowProps<T extends string> = {
  /** Ordered step ids; the order drives the progress indicator. */
  steps: readonly T[]
  /** Active step, owned by the caller (useMultiStep, a reducer, a router...). */
  current: T
  /** What to render per step. Return null while a step's data isn't ready. */
  views: StepViews<T>
  /** Builds the translated progress text, e.g. (p) => fill(copy.stepLabel, p). */
  formatLabel: (position: StepPosition) => string
  /** Swap the progress indicator. */
  Progress?: ComponentType<StepProgressProps>
  className?: string
}

export function MultiStepFlow<T extends string>({
  steps,
  current,
  views,
  formatLabel,
  Progress = StepProgress,
  className,
}: MultiStepFlowProps<T>) {
  const position = getStepPosition(steps, current)

  return (
    <div className={cn("mx-auto w-full max-w-sm space-y-6", className)}>
      <Progress {...position} label={formatLabel(position)} />
      <StepSwitch current={current} views={views} />
    </div>
  )
}
