import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { z } from "@avuny/zod"
import { OtpErrorCode, VerifyOtpBodySchema, type VerifyOtpResponseSchema } from "@avuny/contracts"
import { useSignUpSendOtp, useVerifyOtp } from "@/api"
import { parseApiError, resolveErrorMessage, unwrap, type ApiError } from "../lib/api-error"
import { useCountdown } from "./use-countdown"
import type { ErrorMessages, OtpChallenge } from "../types"

const CodeSchema = VerifyOtpBodySchema.pick({ code: true })
type Values = z.infer<typeof CodeSchema>

type Options = {
  identifier: string
  challenge: OtpChallenge
  resendCount: number
  maxResends?: number
  errorMessages: ErrorMessages
  onVerified: (verificationToken: string) => void
  onResent: (challenge: OtpChallenge) => void
}

export function useVerifyOtpStep(o: Options) {
  const form = useForm<Values>({
    resolver: zodResolver(CodeSchema),
    defaultValues: { code: "" },
  })
  const verifyMutation = useVerifyOtp()
  const resendMutation = useSignUpSendOtp()
  const [error, setError] = useState<ApiError | null>(null)
  // Expired / too many attempts: the code is dead, only a resend can recover.
  const [locked, setLocked] = useState(false)
  const secondsLeft = useCountdown(o.challenge.resendAvailableAt)

  const onSubmit = form.handleSubmit(async ({ code }) => {
    if (locked) return
    setError(null)
    try {
      const res = await verifyMutation.mutateAsync({
        data: { challengeId: o.challenge.challengeId, code },
      })
      o.onVerified(unwrap<z.infer<typeof VerifyOtpResponseSchema>>(res).verificationToken)
    } catch (e) {
      const err = parseApiError(e)
      setError(err)
      form.reset({ code: "" })
      if (err.code === OtpErrorCode.OTP_ATTEMPTS_EXCEEDED || err.code === OtpErrorCode.OTP_EXPIRED) {
        setLocked(true)
      }
    }
  })

  const limitReached = o.maxResends !== undefined && o.resendCount >= o.maxResends
  const canResend = secondsLeft === 0 && !resendMutation.isPending && !limitReached

  const resend = async () => {
    if (!canResend) return
    setError(null)
    try {
      const res = await resendMutation.mutateAsync({ data: { identifier: o.identifier } })
      o.onResent(unwrap<OtpChallenge>(res))
      setLocked(false)
      form.reset({ code: "" })
    } catch (e) {
      setError(parseApiError(e))
    }
  }

  return {
    form,
    onSubmit,
    resend,
    canResend,
    secondsLeft,
    locked,
    resendCount: o.resendCount,
    isSubmitting: verifyMutation.isPending,
    isResending: resendMutation.isPending,
    errorMessage: resolveErrorMessage(error, o.errorMessages),
  }
}
