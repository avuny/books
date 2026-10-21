import type { FieldCopy } from "@workspace/ui/blocks/types"

export type SignInCopy = {
  title: string
  description: string
  identifier: FieldCopy
  password: FieldCopy
  submitLabel: string
  submittingLabel: string
  /** Shown above the sign-up link, e.g. "Don't have an account?" */
  signUpPrompt: string
  signUpLabel: string
}
