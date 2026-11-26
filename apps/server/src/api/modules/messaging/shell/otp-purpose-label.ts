const OTP_PURPOSE_LABELS: Record<string, string> = {
  SIGN_UP: "sign-up",
  ADD_IDENTIFIER: "request to add this email or phone number",
  UPDATE_IDENTIFIER: "request to change your email or phone number",
  FORGET_PASSWORD: "password reset",
}

/** Human wording for an OTP purpose enum value, so emails never show a raw key. */
export function otpPurposeLabel(purpose: string): string {
  return OTP_PURPOSE_LABELS[purpose] ?? "verification"
}
