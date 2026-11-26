import { createDomainErrorResponseSchema, createResponseSchema } from "@avuny/utils"
import type { z } from "@avuny/zod"

/**
 * Tiny response builders so every route file stays readable. Status codes are still
 * written as literal keys at the call site, which keeps createRoute's typing intact.
 * If createDomainErrorResponseSchema's signature differs, adjust it here only.
 */
export const jsonOk = <T extends z.ZodTypeAny>(description: string, schema: T) => ({
  description,
  content: { "application/json": { schema: createResponseSchema(schema) } },
})

export const jsonError = <const C extends readonly [string, ...string[]]>(
  description: string,
  codes: C
) => ({
  description,
  content: {
    "application/json": {
      schema: createDomainErrorResponseSchema([...codes] as never),
    },
  },
})

/** "/organizations/{orgId}/members" -> "/organizations/:orgId/members" */
export const honoPath = (openApiPath: string) =>
  openApiPath.replace(/\{([^}]+)\}/g, ":$1")

export const createErrorMap = <
  Code extends string,
  const M extends Partial<Record<Code, { statusCode: number; responseMessage: string }>>,
>(
  map: M
): Record<Code, M[keyof M]> => map as unknown as Record<Code, M[keyof M]>
