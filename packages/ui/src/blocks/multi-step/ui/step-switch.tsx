import { Fragment, type ReactNode } from "react"

/** One render function per step, so a step is only built while it's active. */
export type StepViews<T extends string> = Record<T, () => ReactNode>

export type StepSwitchProps<T extends string> = {
  current: NoInfer<T>
  views: StepViews<T>
}

export function StepSwitch<T extends string>({
  current,
  views,
}: StepSwitchProps<T>) {
  // The key mounts every step fresh, even if two steps render the same component.
  return <Fragment key={current}>{views[current]()}</Fragment>
}
