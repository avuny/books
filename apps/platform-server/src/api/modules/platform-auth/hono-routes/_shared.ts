import { createDomainErrorResponseSchema, createResponseSchema } from "@avuny/utils"
import type { z } from "@avuny/zod"
import type { DB } from "@avuny/db"
import type { createRequirePlatformAuth } from "../platform-auth.middleware.js"

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

/** "/platform-auth/sessions/{sessionId}" -> "/platform-auth/sessions/:sessionId" */
export const honoPath = (openApiPath: string) =>
  openApiPath.replace(/\{([^}]+)\}/g, ":$1")

export interface PlatformAuthRouteDeps {
  db: DB
  requireAuth: ReturnType<typeof createRequirePlatformAuth>
}
