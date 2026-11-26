import type { ReactNode } from "react"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { AlertCircleIcon } from "lucide-react"

export type StepAlertProps = {
  /** Nothing is rendered while this is empty. */
  message?: ReactNode
  variant?: "default" | "destructive"
  /** Swap the leading icon, e.g. with your own Icon component. */
  icon?: ReactNode
  className?: string
}

export function StepAlert({
  message,
  variant = "destructive",
  icon = <AlertCircleIcon />,
  className,
}: StepAlertProps) {
  if (!message) return null

  return (
    <Alert variant={variant} className={className}>
      {icon}
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}
