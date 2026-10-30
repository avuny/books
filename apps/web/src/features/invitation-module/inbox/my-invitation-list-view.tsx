import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"

/** One inbox row, already translated and formatted. */
export type MyInvitationItem = {
  id: string
  /** The organization's name. */
  title: string
  /** The member type, e.g. "Team member". */
  badge: string
  /** Secondary facts, joined with " · ": code, channel, expiry, username. */
  details: string[]
}

export type MyInvitationListViewCopy = {
  title: string
  description: string
  emptyTitle: string
  emptyDescription: string
  acceptLabel: string
  declineLabel: string
}

export interface MyInvitationListViewProps {
  items: MyInvitationItem[]
  isLoading: boolean
  /** Already localized. Shown when loading failed. */
  errorMessage?: string | null
  copy: MyInvitationListViewCopy
  onAccept: (id: string) => void
  onDecline: (id: string) => void
}

/** Pure view of the signed-in user's open invitations. */
export function MyInvitationListView({
  items,
  isLoading,
  errorMessage,
  copy,
  onAccept,
  onDecline,
}: MyInvitationListViewProps) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-foreground">{copy.title}</h1>
        <p className="text-sm text-muted-foreground">{copy.description}</p>
      </div>

      {errorMessage ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}

      {isLoading ? (
        <div className="grid gap-3" aria-busy>
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
      ) : items.length === 0 && !errorMessage ? (
        <div className="flex flex-col items-center gap-1 rounded-lg border border-dashed border-border px-6 py-16 text-center">
          <p className="text-sm font-medium text-foreground">
            {copy.emptyTitle}
          </p>
          <p className="text-sm text-muted-foreground">
            {copy.emptyDescription}
          </p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-medium text-foreground">
                    {item.title}
                  </h2>
                  <Badge variant="outline">{item.badge}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {item.details.join(" · ")}
                </p>
              </div>

              <div className="flex shrink-0 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onDecline(item.id)}
                >
                  {copy.declineLabel}
                </Button>
                <Button type="button" onClick={() => onAccept(item.id)}>
                  {copy.acceptLabel}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
