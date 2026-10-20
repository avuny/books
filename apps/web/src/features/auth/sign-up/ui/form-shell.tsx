import type { ReactNode } from "react"
import { Alert, AlertDescription } from "@workspace/ui/components/alert"
import { AlertCircleIcon } from "lucide-react"

export function FormShell({
  title,
  description,
  errorMessage,
  children,
}: {
  title: string
  description: string
  errorMessage: string | null
  children: ReactNode
}) {
  return (
    <div className="space-y-6">
      <header className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </header>
      {errorMessage && (
        <Alert variant="destructive" role="alert">
          <AlertCircleIcon className="size-4 shrink-0" aria-hidden="true" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}
      {children}
    </div>
  )
}
