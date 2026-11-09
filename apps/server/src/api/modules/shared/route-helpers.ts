import { createDomainErrorResponseSchema, createResponseSchema } from "@avuny/utils"
import type { z } from "@avuny/zod"

/**
 * Same helpers as role/hono-routes/_shared.ts, shared by the unit, item and item-category
 * routes. Status codes are still written as literal keys at the call site, which keeps
 * createRoute's typing intact.
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
