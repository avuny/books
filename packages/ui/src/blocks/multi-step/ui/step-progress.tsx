import { cn } from "@workspace/ui/lib/utils"
import type { StepPosition } from "../lib/steps"

export type StepProgressProps = StepPosition & {
  /** Already-translated text, e.g. "Step 2 of 3". */
  label: string
  className?: string
}

export function StepProgress({
  current,
  total,
  label,
  className,
}: StepProgressProps) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={current}
      className={cn("space-y-2", className)}
    >
      <div className="flex gap-1.5" aria-hidden>
        {Array.from({ length: total }, (_, index) => {
          const done = index < current
          return (
            <span
              key={index}
              data-state={done ? "complete" : "pending"}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors motion-reduce:transition-none",
                done ? "bg-primary" : "bg-muted"
              )}
            />
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  )
}
