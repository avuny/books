import { useRef, type FormEventHandler } from "react"
import type { UseFormReturn } from "react-hook-form"

import { OTP_CODE_LENGTH } from "@avuny/contracts"
import { FormShell, OtpField, SubmitButton } from "@workspace/ui/blocks/form"

import { fill } from "../lib/api-error"
import type { SignUpCopy } from "../types"

type Props = {
  form: UseFormReturn<{ code: string }>
  onSubmit: FormEventHandler<HTMLFormElement>
  isSubmitting: boolean
  errorMessage: string | null
  identifier: string
  secondsLeft: number
  canResend: boolean
  isResending: boolean
  locked: boolean
  resendCount: number
  maxResends?: number
  onResend: () => void
  onChangeIdentifier: () => void
  copy: SignUpCopy["verify"]
}

export function VerifyOtpForm(p: Props) {
  const { copy } = p
  const busy = p.isSubmitting || p.isResending
  const formRef = useRef<HTMLFormElement>(null)

  return (
    <FormShell
      title={copy.title}
      description={fill(copy.description, {
        identifier: p.identifier,
      })}
      errorMessage={p.errorMessage}
    >
      <form
        ref={formRef}
        onSubmit={p.onSubmit}
        noValidate
        className="space-y-6"
      >
        <OtpField
          control={p.form.control}
          name="code"
          label={copy.codeLabel}
          length={OTP_CODE_LENGTH}
          autoFocus
          disabled={busy || p.locked}
          onComplete={() => formRef.current?.requestSubmit()}
        />

        <SubmitButton
          className="w-full"
          disabled={p.locked}
          loading={p.isSubmitting}
          label={copy.submitLabel}
          loadingLabel={copy.submittingLabel}
        />
      </form>

      {/* Keep your existing resend countdown, resend button, and
          change-identifier section here unchanged. */}
    </FormShell>
  )
}
