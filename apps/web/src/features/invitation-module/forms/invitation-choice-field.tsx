import { cn } from "@workspace/ui/lib/utils"

export type InvitationChoiceOption<T extends string> = {
  value: T
  /** Already localized. */
  label: string
  description?: string
}

export interface InvitationChoiceFieldProps<T extends string> {
  name: string
  legend: string
  options: readonly InvitationChoiceOption<T>[]
  value: T
  onChange: (value: T) => void
  disabled?: boolean
  /** Already localized. */
  errorMessage?: string
  className?: string
}

/** A small radio group: pick exactly one of a few options (type, channel). */
export function InvitationChoiceField<T extends string>({
  name,
  legend,
  options,
  value,
  onChange,
  disabled = false,
  errorMessage,
  className,
}: InvitationChoiceFieldProps<T>) {
  return (
    <fieldset
      className={cn("grid gap-2", className)}
      disabled={disabled}
      aria-invalid={errorMessage ? true : undefined}
    >
      <legend className="mb-2 text-sm font-medium text-foreground">
        {legend}
      </legend>

      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              "flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-card p-3 text-card-foreground",
              "has-[:checked]:border-primary has-[:checked]:bg-primary/5",
              "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
              "has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="mt-1 accent-primary"
            />
            <span className="grid gap-0.5">
              <span className="text-sm font-medium text-foreground">
                {option.label}
              </span>
              {option.description ? (
                <span className="text-xs text-muted-foreground">
                  {option.description}
                </span>
              ) : null}
            </span>
          </label>
        ))}
      </div>

      {errorMessage ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}
    </fieldset>
  )
}
