import {
  useForm,
  type DefaultValues,
  type FieldPath,
  type FieldValues,
  type Resolver,
} from "react-hook-form"
import type { ErrorMessages } from "@workspace/ui/blocks/types"
import { parseApiError, resolveErrorMessage } from "./api-error"

export type UseApiFormOptions<T extends FieldValues, R> = {
  /** e.g. `zodResolver(SomeBodySchema)` from @avuny/contracts. */
  resolver: Resolver<T>
  defaultValues: DefaultValues<T>
  /** Calls the API and returns the unwrapped result. Throw on failure. */
  submit: (values: T) => Promise<R>
  onSuccess: (result: R) => void
  /** Localized messages keyed by API error code, plus `fallback`. */
  errorMessages: ErrorMessages
  /** API error code -> field that should show that error (e.g. USERNAME_TAKEN). */
  fieldErrors?: Partial<Record<string, FieldPath<T>>>
  /** API error code -> fields to clear (e.g. INVALID_CREDENTIALS -> password). */
  resetOnCode?: Partial<Record<string, FieldPath<T>[]>>
}

/**
 * The one place that wires useForm + resolver + API submit + server errors.
 * Every form hook should be a thin config over this.
 *
 * Server errors land in `errors.<field>` when mapped via `fieldErrors`,
 * otherwise in `errors.root.server` (exposed as `errorMessage`).
 * RHF clears root errors on every submit, so no extra state is needed.
 */
export function useApiForm<T extends FieldValues, R>({
  resolver,
  defaultValues,
  submit,
  onSuccess,
  errorMessages,
  fieldErrors,
  resetOnCode,
}: UseApiFormOptions<T, R>) {
  const form = useForm<T>({ resolver, defaultValues })

  const handleError = (error: unknown) => {
    const apiError = parseApiError(error)
    const code = apiError.code
    const message = resolveErrorMessage(apiError, errorMessages) ?? undefined

    // Reset before setError: resetField also clears that field's error.
    for (const name of (code && resetOnCode?.[code]) || []) {
      form.resetField(name)
    }

    const field = code ? fieldErrors?.[code] : undefined
    if (field) {
      form.setError(field, { type: "server", message }, { shouldFocus: true })
    } else {
      form.setError("root.server", { type: "server", message })
    }
  }

  const onSubmit = form.handleSubmit(async (values) => {
    let result: R
    try {
      result = await submit(values)
    } catch (error) {
      handleError(error)
      return
    }
    // Outside the try: a throwing onSuccess must not look like an API error.
    onSuccess(result)
  })

  return {
    form,
    onSubmit,
    isSubmitting: form.formState.isSubmitting,
    errorMessage: form.formState.errors.root?.server?.message ?? null,
  }
}
