import type { ReactNode } from "react"
import { ArrowLeft, ExternalLink } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"

import {
  PartyAddresses,
  PartyEmails,
  PartyPhones,
  type PartyRoleBadgeCopy,
  PartyRoleBadges,
  PartyTypeBadge,
} from "../components/index.js"
import type { PartyDto } from "../types.js"

export interface PartyDetailsViewCopy {
  backLabel: string
  legalNameLabel: string
  taxNumberLabel: string
  websiteLabel: string
  notesLabel: string
  emailsTitle: string
  phonesTitle: string
  addressesTitle: string
  primaryEmailLabel: string
  primaryPhoneLabel: string
  primaryAddressLabel: string
  createdLabel: string
  updatedLabel: string
  salutationLabel: string
  partyTypeLabel: string
  inactiveNotice?: string | null
  roleBadgeCopy: PartyRoleBadgeCopy
}

export interface PartyDetailsViewProps {
  party: PartyDto | null
  isLoading: boolean
  errorMessage?: string | null
  copy: PartyDetailsViewCopy
  typeText: string
  salutationText?: string
  createdAt: string
  updatedAt: string
  onBack?: () => void
  editAction?: ReactNode
  currentRoleAction?: ReactNode
  oppositeRoleAction?: ReactNode
}

function isValidHttpUrl(string?: string | null): boolean {
  if (!string) return false
  try {
    const url = new URL(string)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

export function PartyDetailsView({
  party,
  isLoading,
  errorMessage,
  copy,
  typeText,
  salutationText,
  createdAt,
  updatedAt,
  onBack,
  editAction,
  currentRoleAction,
  oppositeRoleAction,
}: PartyDetailsViewProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true">
        {onBack ? (
          <div>
            <Button type="button" variant="ghost" size="sm" disabled>
              <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
              {copy.backLabel}
            </Button>
          </div>
        ) : null}
        <div className="grid gap-4">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    )
  }

  if (!party) {
    return (
      <div className="flex flex-col gap-6">
        {onBack ? (
          <div>
            <Button type="button" variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
              {copy.backLabel}
            </Button>
          </div>
        ) : null}
        <p role="alert" className="text-sm text-destructive">
          {errorMessage || "Party not found"}
        </p>
      </div>
    )
  }

  const hasHttpUrl = isValidHttpUrl(party.website)

  return (
    <div className="flex flex-col gap-6">
      {onBack ? (
        <div>
          <Button type="button" variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
            {copy.backLabel}
          </Button>
        </div>
      ) : null}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {party.displayName}
            </h1>
            <PartyTypeBadge partyType={party.partyType} label={typeText} />
            <PartyRoleBadges roles={party.roles} copy={copy.roleBadgeCopy} />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {oppositeRoleAction}
          {currentRoleAction}
          {editAction}
        </div>
      </div>

      {/* Inactive notice if applicable */}
      {copy.inactiveNotice ? (
        <div
          role="status"
          className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm text-warning-foreground"
        >
          {copy.inactiveNotice}
        </div>
      ) : null}

      {/* Details Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Basic Information */}
        <div className="rounded-lg border border-border bg-card p-5 text-card-foreground">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {typeText}
          </h2>
          <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">{copy.partyTypeLabel}</dt>
              <dd className="font-medium text-foreground">{typeText}</dd>
            </div>

            {salutationText ? (
              <div>
                <dt className="text-xs text-muted-foreground">{copy.salutationLabel}</dt>
                <dd className="font-medium text-foreground">{salutationText}</dd>
              </div>
            ) : null}

            <div>
              <dt className="text-xs text-muted-foreground">{copy.legalNameLabel}</dt>
              <dd className="font-medium text-foreground">{party.legalName || "—"}</dd>
            </div>

            <div>
              <dt className="text-xs text-muted-foreground">{copy.taxNumberLabel}</dt>
              <dd className="font-medium text-foreground">
                {party.taxNumber ? <bdi dir="ltr">{party.taxNumber}</bdi> : "—"}
              </dd>
            </div>

            <div className="sm:col-span-2">
              <dt className="text-xs text-muted-foreground">{copy.websiteLabel}</dt>
              <dd className="font-medium text-foreground">
                {party.website ? (
                  hasHttpUrl ? (
                    <a
                      href={party.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      <bdi dir="ltr">{party.website}</bdi>
                      <ExternalLink className="size-3.5" aria-hidden />
                    </a>
                  ) : (
                    <bdi dir="ltr">{party.website}</bdi>
                  )
                ) : (
                  "—"
                )}
              </dd>
            </div>

            <div>
              <dt className="text-xs text-muted-foreground">{copy.createdLabel}</dt>
              <dd className="text-foreground">{createdAt}</dd>
            </div>

            <div>
              <dt className="text-xs text-muted-foreground">{copy.updatedLabel}</dt>
              <dd className="text-foreground">{updatedAt}</dd>
            </div>
          </dl>
        </div>

        {/* Notes (if present) */}
        {party.notes ? (
          <div className="rounded-lg border border-border bg-card p-5 text-card-foreground">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {copy.notesLabel}
            </h2>
            <p className="whitespace-pre-wrap text-sm text-foreground">
              {party.notes}
            </p>
          </div>
        ) : null}
      </div>

      {/* Contacts Sections */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Emails */}
        <div className="rounded-lg border border-border bg-card p-5 text-card-foreground">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {copy.emailsTitle}
          </h2>
          <PartyEmails emails={party.emails} primaryLabel={copy.primaryEmailLabel} />
        </div>

        {/* Phones */}
        <div className="rounded-lg border border-border bg-card p-5 text-card-foreground">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {copy.phonesTitle}
          </h2>
          <PartyPhones phones={party.phones} primaryLabel={copy.primaryPhoneLabel} />
        </div>
      </div>

      {/* Addresses */}
      <div className="rounded-lg border border-border bg-card p-5 text-card-foreground">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {copy.addressesTitle}
        </h2>
        <PartyAddresses
          addresses={party.addresses}
          primaryLabel={copy.primaryAddressLabel}
        />
      </div>
    </div>
  )
}
