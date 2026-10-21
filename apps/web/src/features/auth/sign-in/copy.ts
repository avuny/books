import type { ErrorMessages } from "@workspace/ui/blocks/types"
import type { SignInCopy } from "./types"

export const signInCopy: SignInCopy = {
  title: "Welcome back",
  description: "Sign in with your email, phone number or username.",
  identifier: { label: "Email, phone or username", placeholder: "name@example.com" },
  password: { label: "Password", placeholder: "Your password" },
  submitLabel: "Sign in",
  submittingLabel: "Signing in...",
  signUpPrompt: "Don't have an account?",
  signUpLabel: "Sign up",
}

/** Keys are API error codes from @avuny/contracts. */
export const signInErrors: ErrorMessages = {
  fallback: "Something went wrong. Please try again.",
  INVALID_CREDENTIALS: "Incorrect identifier or password.",
}
