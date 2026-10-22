import {
  Alert,
  AlertTitle,
  AlertDescription,
} from "@workspace/ui/components/alert"
import { AlertCircle } from "lucide-react"

export type ErrorType = "domain" | "validation" | "system"

export type ErrorAlertProps = {
  errorMessage: string

  errorTitle?: string
}

export function ErrorAlert({
  errorMessage,

  errorTitle,
}: ErrorAlertProps) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{errorTitle}</AlertTitle>
      <AlertDescription>{errorMessage}</AlertDescription>
    </Alert>
  )
}
