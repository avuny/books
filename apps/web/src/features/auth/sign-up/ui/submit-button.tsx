import type { ComponentProps } from "react"
import { Button } from "@workspace/ui/components/button"
import { AlertCircleIcon } from "lucide-react"

type Props = Omit<ComponentProps<typeof Button>, "children"> & {
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
}: Props) {
  return (
    <Button
      type="submit"
      disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading && (
        <AlertCircleIcon name="Loader2" className="animate-spin" aria-hidden />
      )}
      {loading ? (loadingLabel ?? label) : label}
    </Button>
  )
}
