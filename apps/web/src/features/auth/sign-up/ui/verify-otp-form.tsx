import { useRef, type FormEventHandler } from "react"
import type { UseFormReturn } from "react-hook-form"
import { REGEXP_ONLY_DIGITS } from "input-otp"

import { OTP_CODE_LENGTH } from "@avuny/contracts"
import { Controller, type FieldError as RHFFieldError } from "react-hook-form"
import { Field, FieldError, FieldLabel } from "@workspace/ui/components/field"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@workspace/ui/components/input-otp"

import { fill } from "../lib/api-error"
import type { SignUpCopy } from "../types"
import { FormShell } from "./form-shell"
import { SubmitButton } from "./submit-button"

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
        <Controller
          control={p.form.control}
          name="code"
          render={({ field, fieldState }) => (
            <Field
              data-invalid={fieldState.invalid}
              className="flex flex-col items-center"
            >
              <FieldLabel htmlFor="otp-code" className="sr-only">
                {copy.codeLabel}
              </FieldLabel>

              <InputOTP
                {...field}
                id="otp-code"
                autoFocus
                maxLength={OTP_CODE_LENGTH}
                pattern={REGEXP_ONLY_DIGITS}
                inputMode="numeric"
                autoComplete="one-time-code"
                disabled={busy || p.locked}
                aria-invalid={fieldState.invalid}
                onComplete={() => formRef.current?.requestSubmit()}
              >
                <InputOTPGroup>
                  {Array.from({ length: OTP_CODE_LENGTH }, (_, i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>

              {fieldState.invalid && (
                <FieldError
                  errors={
                    fieldState.error ? [fieldState.error as RHFFieldError] : []
                  }
                />
              )}
            </Field>
          )}
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
