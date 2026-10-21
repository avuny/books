import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "@avuny/zod"
import {
  AuthErrorCode,
  SignUpBodySchema,
  validatePasswordBytes,
  type AuthResponse,
} from "@avuny/contracts/user"
import { useSignUp } from "@/api"
import { parseApiError, resolveErrorMessage, unwrap, type ApiError } from "../lib/api-error"
import type { AppRouter, ErrorMessages } from "../types"

export type { AuthResponse }

function createSchema(mismatchMessage: string) {
  return SignUpBodySchema.pick({ name: true, password: true })
    .extend({ confirmPassword: z.string() })
    .superRefine((v, ctx) => {
      const bytesError = validatePasswordBytes(v.password)
      if (bytesError) ctx.addIssue({ code: "custom", path: ["password"], message: bytesError })
      if (v.password !== v.confirmPassword) {
        ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: mismatchMessage })
      }
    })
}

export type RegistrationValues = z.infer<ReturnType<typeof createSchema>>

type Options = {
  identifier: string
  verificationToken: string
  router: AppRouter
  redirectTo: string
  passwordMismatchMessage: string
  errorMessages: ErrorMessages
  onAuthenticated?: (auth: AuthResponse) => void
  onSuccess?: (data: { data: AuthResponse }) => void
  /** Proof rejected/expired: the flow should restart from step one. */
  onProofInvalid: () => void
}

export function useCompleteRegistrationStep(o: Options) {
  const schema = useMemo(() => createSchema(o.passwordMismatchMessage), [o.passwordMismatchMessage])

  const form = useForm<RegistrationValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", password: "", confirmPassword: "" },
  })
  const mutation = useSignUp()
  const [error, setError] = useState<ApiError | null>(null)

  const onSubmit = form.handleSubmit(async ({ name, password }) => {
    setError(null)
    try {
      const res = await mutation.mutateAsync({
        data: {
          identifier: o.identifier,
          name,
          password,
          verificationToken: o.verificationToken,
        },
      })
      if (o.onSuccess) {
        o.onSuccess(res as { data: AuthResponse })
      } else {
        o.onAuthenticated?.(unwrap<AuthResponse>(res))
        o.router.replace(o.redirectTo)
      }
    } catch (e) {
      const err = parseApiError(e)
      if (err.code === AuthErrorCode.INVALID_CREDENTIALS) return o.onProofInvalid()
      if (err.code === AuthErrorCode.WEAK_PASSWORD) {
        form.setError("password", {
          message: resolveErrorMessage(err, o.errorMessages) ?? undefined,
        })
        return
      }
      setError(err)
    }
  })

  return {
    form,
    onSubmit,
    isSubmitting: mutation.isPending,
    errorMessage: resolveErrorMessage(error, o.errorMessages),
  }
}
