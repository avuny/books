import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
  type FieldError as RHFFieldError,
} from "react-hook-form"
import { REGEXP_ONLY_DIGITS } from "input-otp"

import { Field, FieldError, FieldLabel } from "@workspace/ui/components/field"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@workspace/ui/components/input-otp"

export type OtpFieldProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
  control: Control<TFieldValues>
  name: TName
  label: string
  /** Defaults to true — visually hides the label (screen-reader only). */
  labelSrOnly?: boolean
  length: number
  autoFocus?: boolean
  disabled?: boolean
  /** Called when all slots are filled. */
  onComplete?: () => void
  className?: string
}

export function OtpField<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  control,
  name,
  label,
  labelSrOnly = true,
  length,
  autoFocus = false,
  disabled = false,
  onComplete,
  className,
}: OtpFieldProps<TFieldValues, TName>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field
          data-invalid={fieldState.invalid}
          className={`flex flex-col items-center${className ? ` ${className}` : ""}`}
        >
          <FieldLabel
            htmlFor="otp-code"
            className={labelSrOnly ? "sr-only" : undefined}
          >
            {label}
          </FieldLabel>

          <InputOTP
            {...field}
            id="otp-code"
            autoFocus={autoFocus}
            maxLength={length}
            pattern={REGEXP_ONLY_DIGITS}
            inputMode="numeric"
            autoComplete="one-time-code"
            disabled={disabled}
            aria-invalid={fieldState.invalid}
            onComplete={onComplete}
          >
            <InputOTPGroup>
              {Array.from({ length }, (_, i) => (
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
  )
}
