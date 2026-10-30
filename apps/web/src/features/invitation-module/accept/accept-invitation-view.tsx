import type { ReactNode } from "react"

import { Skeleton } from "@workspace/ui/components/skeleton"

export type AcceptInvitationDetail = {
  label: string
  /** Already localized / formatted. */
  value: string
}

export interface AcceptInvitationViewProps {
  status: "loading" | "error" | "ready"
  /** Already localized. Shown when the invitation could not be loaded. */
  errorMessage?: string | null
  /** Heading and intro of the invitation, e.g. "Join Acme". */
  title: string
  description: string
  details: AcceptInvitationDetail[]
  /** The accept form, or the sign-in prompt for a signed-out visitor. */
  action?: ReactNode
}

/** Pure card shown for an invitation link. */
export function AcceptInvitationView({
  status,
  errorMessage,
  title,
  description,
  details,
  action,
}: AcceptInvitationViewProps) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm">
      {status === "loading" ? (
        <div className="grid gap-4" aria-busy>
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : status === "error" ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      ) : (
        <>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-foreground">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>

          <dl className="grid gap-3 text-sm">
            {details.map((detail) => (
              <div key={detail.label}>
                <dt className="text-xs text-muted-foreground">{detail.label}</dt>
                <dd className="break-words text-foreground">{detail.value}</dd>
              </div>
            ))}
          </dl>

          {action}
        </>
      )}
    </div>
  )
}
