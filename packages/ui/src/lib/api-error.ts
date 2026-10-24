export type ApiError = { code?: string; message?: string }

/** API error code -> localized text, plus a required `fallback`. */
export type ErrorMessageMap = { fallback: string } & Partial<
  Record<string, string>
>

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null

/** Extracts `{ code, message }` from an axios/fetch/orval error of any shape. */
export function parseApiError(error: unknown): ApiError {
  if (!isRecord(error)) return {}
  const response = isRecord(error.response) ? error.response : undefined
  const body = response?.data ?? error.data ?? error.body ?? error
  if (!isRecord(body)) return {}
  return {
    code: typeof body.code === "string" ? body.code : undefined,
    message: typeof body.message === "string" ? body.message : undefined,
  }
}

/**
 * Unwraps the `{ success, data }` envelope. Handles both a mutator that returns
 * the body directly and one that returns `{ data: body, status }`.
 * (Not used by the sign-in feature; kept because it was already in this file.)
 */
export function unwrap<T>(res: unknown): T {
  let body = res
  if (
    isRecord(body) &&
    "status" in body &&
    isRecord(body.data) &&
    "success" in body.data
  ) {
    body = body.data
  }
  if (isRecord(body) && "data" in body) return body.data as T
  throw new Error("Unexpected API response shape")
}

export function resolveErrorMessage(
  error: ApiError | null,
  messages: ErrorMessageMap
): string | null {
  if (!error) return null
  return (
    (error.code && messages[error.code]) || error.message || messages.fallback
  )
}

/**
 * Any mutation error -> the message to show in the form's alert.
 * Returns null when there is no error, so it can be passed straight to `errorMessage`.
 */
export function apiErrorMessage(
  error: unknown,
  messages: ErrorMessageMap
): string | null {
  return error == null
    ? null
    : resolveErrorMessage(parseApiError(error), messages)
}

export const fill = (
  template: string,
  values: Record<string, string | number>
) =>
  template.replace(/\{(\w+)\}/g, (_, k: string) =>
    String(values[k] ?? `{${k}}`)
  )
