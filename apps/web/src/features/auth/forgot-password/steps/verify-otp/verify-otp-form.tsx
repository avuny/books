import { useRef } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import type { z } from "@avuny/zod"
import { OTP_CODE_LENGTH } from "@avuny/contracts"
import { VerifyOtpBodySchema } from "@avuny/contracts/user"

import { Button } from "@workspace/ui/components/button"
import { FormShell, OtpField, SubmitButton } from "@workspace/ui/blocks/form"

const CodeSchema = VerifyOtpBodySchema.pick({ code: true })

export type VerifyOtpFormValues = z.infer<typeof CodeSchema>

/** Localized strings for this form. Built and injected by the container. */
export type VerifyOtpCopy = {
  title: string
  /** Already interpolated with the identifier. */
  description: string
  codeLabel: string
  submitLabel: string
  submittingLabel: string
  resendPrompt: string
  resendLabel: string
  /** Resend button text during the cooldown, e.g. "Resend in 30s". */
  resendIn: string
  resendLimitReached: string
  changeIdentifierLabel: string
}

type VerifyOtpFormProps = {
  copy: VerifyOtpCopy
  onSubmit: (values: VerifyOtpFormValues) => void
  onResend: () => void
  onChangeIdentifier: () => void
  isPending: boolean
  isResending: boolean
  /** Code is dead (expired / too many attempts): only a resend recovers. */
  locked: boolean
  secondsLeft: number
  canResend: boolean
  limitReached: boolean
  /** Already localized. Shown in the form-level alert. */
  errorMessage?: string | null
}

// UI + validation only. No i18n, API, auth or navigation knowledge.
export function VerifyOtpForm({
  copy,
  onSubmit,
  onResend,
  onChangeIdentifier,
  isPending,
  isResending,
  locked,
  secondsLeft,
  canResend,
  limitReached,
  errorMessage,
}: VerifyOtpFormProps) {
  const form = useForm<VerifyOtpFormValues>({
    resolver: zodResolver(CodeSchema),
    defaultValues: { code: "" },
  })
  const formRef = useRef<HTMLFormElement>(null)
  const busy = isPending || isResending

  return (
    <FormShell
      title={copy.title}
      description={copy.description}
      errorMessage={errorMessage}
    >
      <form
        ref={formRef}
        onSubmit={form.handleSubmit((values) => onSubmit(values))}
        noValidate
        className="space-y-6"
      >
        <OtpField
          control={form.control}
          name="code"
          label={copy.codeLabel}
          length={OTP_CODE_LENGTH}
          autoFocus
          disabled={busy || locked}
          onComplete={() => formRef.current?.requestSubmit()}
        />

        <SubmitButton
          className="w-full"
          disabled={locked}
          loading={isPending}
          label={copy.submitLabel}
          loadingLabel={copy.submittingLabel}
        />
      </form>

      <div className="flex flex-col items-center gap-1 text-sm text-muted-foreground">
        {limitReached ? (
          <span>{copy.resendLimitReached}</span>
        ) : (
          <div className="flex items-center gap-1">
            <span>{copy.resendPrompt}</span>
            <Button
              type="button"
              variant="link"
              size="sm"
              className="px-0"
              disabled={!canResend}
              onClick={onResend}
            >
              {secondsLeft > 0 ? copy.resendIn : copy.resendLabel}
            </Button>
          </div>
        )}
        <Button
          type="button"
          variant="link"
          size="sm"
          className="px-0"
          disabled={busy}
          onClick={onChangeIdentifier}
        >
          {copy.changeIdentifierLabel}
        </Button>
      </div>
    </FormShell>
  )
}
