import {
  apiErrorMessage,
  type ErrorMessageMap,
} from "@workspace/ui/lib/api-error"

import type { SignInFormValues } from "./sign-in-form"
import { useSignIn } from "@/api"
import { useAuthSuccessHandler } from "@/features/auth/use-auth-success-handler"

/**
 * API + auth side of sign-in. No UI and no i18n: localized error texts come in
 * as an argument. SSO, MFA, etc. land here.
 */
export function useSignInMutation(errors: ErrorMessageMap) {
  const handleAuthSuccess = useAuthSuccessHandler()

  const signIn = useSignIn({
    mutation: { onSuccess: (data) => handleAuthSuccess(data) },
  })

  return {
    submit: (values: SignInFormValues) => signIn.mutate({ data: values }),
    isPending: signIn.isPending,
    errorMessage: apiErrorMessage(signIn.error, errors),
  }
}
