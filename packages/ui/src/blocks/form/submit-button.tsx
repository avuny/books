import type { ComponentProps } from "react"
import { Button } from "@workspace/ui/components/button"
import { Loader2Icon } from "lucide-react"

export type SubmitButtonProps = Omit<
  ComponentProps<typeof Button>,
  "children"
> & {
  loading?: boolean
  label: string
  loadingLabel?: string
}

/** Reusable submit button: disables itself and shows a spinner while loading. */
export function SubmitButton({
  loading = false,
  label,
  loadingLabel,
  disabled,
  ...props
}: SubmitButtonProps) {
  return (
    <Button
      type="submit"
      disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading && (
        <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
      )}
      {loading ? (loadingLabel ?? label) : label}
    </Button>
  )
}
