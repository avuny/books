export type ResultMeta = Record<string, unknown>

export type Ok<T> = {
  success: true
  data: T
  msg?: string
  meta?: ResultMeta
}

export type Fail<E extends string = string> = {
  success: false
  error: E
  msg: string
  meta?: ResultMeta
}

export type Result<T, E extends string = string> = Ok<T> | Fail<E>

/** Constructors prevent boolean widening and keep error codes literal. */
export const ok = <T>({
  data,
  msg,
  meta,
}: {
  data: T
  msg?: string
  meta?: ResultMeta
}): Ok<T> => ({ success: true, data, msg, meta })

export const fail = <const E extends string>({
  error,
  msg,
  meta,
}: {
  error: E
  msg: string
  meta?: ResultMeta
}): Fail<E> => ({ success: false, error, msg, meta })
