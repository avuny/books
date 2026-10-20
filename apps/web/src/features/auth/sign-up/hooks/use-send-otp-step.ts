import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { z } from "@avuny/zod"
import { SignUpSendOtpBodySchema, type SendOtpResponseSchema } from "@avuny/contracts"
import { useSignUpSendOtp } from "@/api"
import { parseApiError, resolveErrorMessage, unwrap, type ApiError } from "../lib/api-error"
import type { ErrorMessages, OtpChallenge } from "../types"

type Values = z.infer<typeof SignUpSendOtpBodySchema>

type Options = {
  defaultIdentifier: string
  errorMessages: ErrorMessages
  onSent: (identifier: string, challenge: OtpChallenge) => void
}

export function useSendOtpStep({ defaultIdentifier, errorMessages, onSent }: Options) {
  const form = useForm<Values>({
    resolver: zodResolver(SignUpSendOtpBodySchema),
    defaultValues: { identifier: defaultIdentifier },
  })
  const mutation = useSignUpSendOtp()
  const [error, setError] = useState<ApiError | null>(null)

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null)
    try {
      const res = await mutation.mutateAsync({ data: values })
      onSent(values.identifier, unwrap<z.infer<typeof SendOtpResponseSchema>>(res))
    } catch (e) {
      setError(parseApiError(e))
    }
  })

  return {
    form,
    onSubmit,
    isSubmitting: mutation.isPending,
    errorMessage: resolveErrorMessage(error, errorMessages),
  }
}
