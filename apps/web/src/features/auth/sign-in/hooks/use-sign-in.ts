import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { z } from "@avuny/zod"
import { SignInBodySchema, type AuthResponse } from "@avuny/contracts/user"
import { useSignIn } from "@/api"
import {
  parseApiError,
  resolveErrorMessage,
  unwrap,
  type ApiError,
} from "../../lib/api-error"
import type { AppRouter, ErrorMessages } from "@workspace/ui/blocks/types"

export type SignInValues = z.infer<typeof SignInBodySchema>
export type { AuthResponse }

type Options = {
  router: AppRouter
  redirectTo: string
  errorMessages: ErrorMessages
  onAuthenticated?: (auth: AuthResponse) => void
  onSuccess?: (data: { data: AuthResponse }) => void
}

export function useSignInForm({
  router,
  redirectTo,
  errorMessages,
  onAuthenticated,
  onSuccess,
}: Options) {
  const form = useForm<SignInValues>({
    resolver: zodResolver(SignInBodySchema),
    defaultValues: { identifier: "", password: "" },
  })
  const mutation = useSignIn()
  const [error, setError] = useState<ApiError | null>(null)

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null)
    try {
      const res = await mutation.mutateAsync({ data: values })
      if (onSuccess) {
        onSuccess(res as { data: AuthResponse })
      } else {
        onAuthenticated?.(unwrap<AuthResponse>(res))
        router.replace(redirectTo)
      }
    } catch (e) {
      setError(parseApiError(e))
      form.resetField("password")
    }
  })

  return {
    form,
    onSubmit,
    isSubmitting: mutation.isPending,
    errorMessage: resolveErrorMessage(error, errorMessages),
  }
}
