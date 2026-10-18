// NEW: packages/hono/src/result/error-map.ts
import type { ClientErrorStatusCode } from "hono/utils/http-status"
import { createDomainErrorResponseSchema } from "@avuny/utils"

export type DomainErrorMeta = {
  statusCode: ClientErrorStatusCode
  responseMessage: string
  /** i18n key, filled in by defineErrorMap */
  messageKey?: string
}

export type ErrorMap<E extends string = string> = Record<E, DomainErrorMeta>

/**
 * Declares a module's error map once.
 * Adds the i18n key `${namespace}:errors.${CODE}` to every entry,
 * so routes no longer pass moduleName.
 */
export function defineErrorMap<
  const N extends string,
  const M extends Record<string, Omit<DomainErrorMeta, "messageKey">>,
>(namespace: N, map: M) {
  const entries = Object.entries(map).map(([code, meta]) => [
    code,
    { ...meta, messageKey: `${namespace}:errors.${code}` },
  ])

  return Object.fromEntries(entries) as {
    [K in keyof M]: M[K] & { messageKey: `${N}:errors.${K & string}` }
  }
}

type DomainErrorResponse = {
  description: string
  content: {
    "application/json": {
      schema: ReturnType<typeof createDomainErrorResponseSchema>
    }
  }
}

/**
 * Builds the OpenAPI error responses from the same error map the handler uses,
 * grouped by status, so docs and runtime cannot drift apart.
 */
export function domainErrorResponses<M extends ErrorMap>(errorMap: M) {
  const byStatus = new Map<number, string[]>()

  for (const [code, meta] of Object.entries(errorMap)) {
    byStatus.set(meta.statusCode, [...(byStatus.get(meta.statusCode) ?? []), code])
  }

  const responses = Object.fromEntries(
    [...byStatus].map(([status, codes]) => [
      status,
      {
        description: `Domain errors: ${codes.join(", ")}`,
        content: {
          "application/json": {
            schema: createDomainErrorResponseSchema(codes as [string, ...string[]]),
          },
        },
      },
    ]),
  )

  return responses as { [S in M[keyof M]["statusCode"]]: DomainErrorResponse }
}
