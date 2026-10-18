// REFACTOR: packages/hono/src/result/handle-result.ts
import type { Context } from "hono"
import type {
  ClientErrorStatusCode,
  ContentfulStatusCode,
} from "hono/utils/http-status"
import type { Result } from "@avuny/utils"
import { logHttpRequest } from "../create-log.js"
import type { DomainErrorMeta } from "./error-map.js"

export type Translate = (key: string) => string

type HandleResultOptions<
  E extends string,
  S extends ContentfulStatusCode,
  SE extends ClientErrorStatusCode,
> = {
  successStatus: S
  errorMap: Record<E, DomainErrorMeta & { statusCode: SE }>
}

/**
 * The hono package knows nothing about i18n; the app injects `translate` once.
 * Success logging lives in requestLogger, not here.
 */
export function createResultHandler({ translate }: { translate?: Translate } = {}) {
  return function handleResult<
    T,
    E extends string,
    S extends ContentfulStatusCode,
    SE extends ClientErrorStatusCode,
  >(
    c: Context,
    result: Result<T, E>,
    { successStatus, errorMap }: HandleResultOptions<E, S, SE>,
  ) {
    if (!result.success) {
      // errorMap is typed Record<E, ...>, so every error code is mapped.
      const meta = errorMap[result.error]
      const message =
        (meta.messageKey ? translate?.(meta.messageKey) : undefined) ||
        meta.responseMessage

      logHttpRequest({
        c,
        level: "warn",
        msg: result.msg,
        errorCode: result.error,
        meta: result.meta,
      })

      return c.json(
        {
          success: false as const,
          code: result.error,
          message,
          type: "domain" as const,
        },
        meta.statusCode,
      )
    }

    return c.json({ success: true as const, data: result.data }, successStatus)
  }
}
