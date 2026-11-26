import { Badge } from "@workspace/ui/components/badge"
import type { PartyAddressDto } from "../types.js"

export interface PartyAddressesProps {
  addresses: PartyAddressDto[]
  primaryLabel: string
}

export function PartyAddresses({
  addresses,
  primaryLabel,
}: PartyAddressesProps) {
  if (addresses.length === 0) {
    return <span className="text-muted-foreground text-sm">—</span>
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {addresses.map((a) => (
        <div
          key={a.id}
          className="bg-card text-card-foreground border-border rounded-lg border p-3 text-sm space-y-1"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">
              {a.label || a.addressLine1}
            </span>
            {a.isPrimary ? (
              <Badge variant="outline" className="text-xs">
                {primaryLabel}
              </Badge>
            ) : null}
          </div>
          <div className="text-muted-foreground text-xs space-y-0.5">
            <div>{a.addressLine1}</div>
            {a.addressLine2 ? <div>{a.addressLine2}</div> : null}
            <div>
              {[a.city, a.state, a.postalCode].filter(Boolean).join(", ")}
            </div>
            {a.countryCode ? <div className="uppercase">{a.countryCode}</div> : null}
          </div>
        </div>
      ))}
    </div>
  )
}
