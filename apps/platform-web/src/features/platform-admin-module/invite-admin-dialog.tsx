import { useState } from "react"
import { Check, Copy } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Label } from "@workspace/ui/components/label"

import type { PlatformListRoles200DataItem as PlatformRoleDto } from "@/api/model"

import { RoleCheckboxGroup } from "./role-checkbox-group"

/** Localized strings for this dialog. Built and injected by the container. */
export type InviteAdminDialogCopy = {
  title: string
  description: string
  emailLabel: string
  emailPlaceholder: string
  rolesLabel: string
  rolesHelp: string
  submitLabel: string
  submittingLabel: string
  createdTitle: string
  createdDescription: string
  copyLink: string
  copiedLabel: string
  doneLabel: string
  cancelLabel: string
}

type InviteAdminDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  copy: InviteAdminDialogCopy
  roles: PlatformRoleDto[]
  onSubmit: (input: { email: string; roleIds: string[] }) => Promise<string>
  /** Already localized. Shown when submission fails. */
  errorMessage?: string | null
  isPending: boolean
}

// Invite flow UI: email + roles, then the one-time link is shown once.
export function InviteAdminDialog({
  open,
  onOpenChange,
  copy,
  roles,
  onSubmit,
  errorMessage,
  isPending,
}: InviteAdminDialogProps) {
  const [email, setEmail] = useState("")
  const [roleIds, setRoleIds] = useState<string[]>([])
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const reset = () => {
    setEmail("")
    setRoleIds([])
    setInviteUrl(null)
    setCopied(false)
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  const handleSubmit = async () => {
    const url = await onSubmit({ email: email.trim(), roleIds })
    setInviteUrl(url)
  }

  const handleCopy = async () => {
    if (!inviteUrl) return
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
  }

  const canSubmit =
    email.trim().length > 0 && roleIds.length > 0 && !isPending

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        {inviteUrl === null ? (
          <>
            <DialogHeader>
              <DialogTitle>{copy.title}</DialogTitle>
              <DialogDescription>{copy.description}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-email">{copy.emailLabel}</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={copy.emailPlaceholder}
                  autoComplete="off"
                  disabled={isPending}
                />
              </div>

              <RoleCheckboxGroup
                roles={roles}
                selectedIds={roleIds}
                onChange={setRoleIds}
                disabled={isPending}
                label={copy.rolesLabel}
                help={copy.rolesHelp}
              />

              {errorMessage && (
                <p className="text-sm text-destructive">{errorMessage}</p>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isPending}
              >
                {copy.cancelLabel}
              </Button>
              <Button onClick={handleSubmit} disabled={!canSubmit}>
                {isPending ? copy.submittingLabel : copy.submitLabel}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{copy.createdTitle}</DialogTitle>
              <DialogDescription>
                {copy.createdDescription}
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center gap-2">
              <code className="flex-1 break-all rounded-md border border-border bg-muted/40 px-3 py-2 font-mono text-xs text-foreground">
                {inviteUrl}
              </code>
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? (
                  <>
                    <Check className="size-3.5" /> {copy.copiedLabel}
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5" /> {copy.copyLink}
                  </>
                )}
              </Button>
            </div>

            <DialogFooter>
              <Button onClick={() => handleOpenChange(false)}>
                {copy.doneLabel}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
