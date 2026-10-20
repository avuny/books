export type AppRouter = {
  push: (href: string) => void
  replace: (href: string) => void
}

export type OtpChallenge = {
  challengeId: string
  expiresAt: string
  resendAvailableAt: string
}

export type FieldCopy = {
  label: string
  placeholder?: string
  description?: string
}

/** Localized messages keyed by API error code. `fallback` is mandatory. */
export type ErrorMessages = Partial<Record<string, string>> & { fallback: string }

export type SignUpCopy = {
  identifier: {
    title: string
    description: string
    field: FieldCopy
    submitLabel: string
    submittingLabel: string
  }
  verify: {
    title: string
    /** Supports the `{identifier}` placeholder. */
    description: string
    codeLabel: string
    submitLabel: string
    submittingLabel: string
    /** Supports `{seconds}`. */
    resendCountdownLabel: string
    resendLabel: string
    resendingLabel: string
    /** Supports `{count}` and `{max}`. Shown only when `maxResends` is set. */
    resendCounterLabel: string
    changeIdentifierLabel: string
  }
  register: {
    title: string
    description: string
    name: FieldCopy
    password: FieldCopy
    confirmPassword: FieldCopy
    passwordMismatchMessage: string
    submitLabel: string
    submittingLabel: string
  }
  /** Supports `{current}` and `{total}`. */
  stepLabel: string
}
