import type { ErrorMessages, SignUpCopy } from "./types"

/**
 * Default English strings. You write these yourself: the feature never owns its text.
 * With i18next, build the same objects from `t()` inside a hook (see note below)
 * and memoize them.
 */
export const signUpCopy: SignUpCopy = {
  stepLabel: "Step {current} of {total}",
  identifier: {
    title: "Create your account",
    description: "Enter your email or phone number and we will send you a verification code.",
    field: {
      label: "Email or phone number",
      placeholder: "name@example.com",
    },
    submitLabel: "Send code",
    submittingLabel: "Sending code...",
  },
  verify: {
    title: "Verify your identity",
    description: "Enter the code we sent to {identifier}.",
    codeLabel: "Verification code",
    submitLabel: "Verify",
    submittingLabel: "Verifying...",
    resendCountdownLabel: "You can request a new code in {seconds}s",
    resendLabel: "Resend code",
    resendingLabel: "Sending...",
    resendCounterLabel: "Codes resent: {count} of {max}",
    changeIdentifierLabel: "Use a different email or phone",
  },
  register: {
    title: "Finish setting up",
    description: "Tell us your name and choose a password.",
    name: { label: "Full name", placeholder: "Jane Doe" },
    password: { label: "Password", placeholder: "At least 8 characters" },
    confirmPassword: { label: "Confirm password", placeholder: "Repeat your password" },
    passwordMismatchMessage: "Passwords do not match.",
    submitLabel: "Create account",
    submittingLabel: "Creating account...",
  },
}

/** Keys are the API error codes from @avuny/contracts. */
export const signUpErrors: ErrorMessages = {
  fallback: "Something went wrong. Please try again.",
  OTP_INVALID: "That code or identifier is not valid.",
  OTP_EXPIRED: "This code has expired. Request a new one.",
  OTP_ATTEMPTS_EXCEEDED: "Too many incorrect attempts. Request a new code.",
  OTP_RATE_LIMITED: "Too many requests. Please wait a while and try again.",
  OTP_RESEND_TOO_SOON: "Please wait a moment before requesting another code.",
  VERIFICATION_TOKEN_INVALID: "Verification failed. Please start again.",
  WEAK_PASSWORD: "This password is too weak. Choose a stronger one.",
  INVALID_IDENTIFIER_TYPE: "Use a valid email or phone number.",
}
