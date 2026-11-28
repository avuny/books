import { createRoute } from "@hono/zod-openapi"
import { createOpenAPIRouter, handleResult } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  PlatformAcceptInviteResponseSchema,
  PlatformAcceptInviteSchema,
  PlatformAuthErrorCode as Code,
} from "@avuny/contracts/platform-admin"
import { platformAuthErrorsHttpMap as errors } from "../platform-auth.errors.js"
import { acceptInvite } from "../platform-auth.service.js"
import { jsonError, jsonOk, type PlatformAuthRouteDeps } from "./_shared.js"

const errorMap = { [Code.INVALID_INVITE]: errors.INVALID_INVITE }

/**
 * Invite acceptance step 1 (A1-04): the ONLY public route that creates an admin,
 * and only from a valid single-use invite (PAC1, spec 3.2). Returns the one-time
 * TOTP enrollment secret.
 */
export const acceptInviteRoute = ({ db }: PlatformAuthRouteDeps) => {
  const router = createOpenAPIRouter()

  const route = createRoute({
    method: "post",
    path: "/platform-auth/invites/accept",
    operationId: "platformAcceptInvite",
    tags: ["platform-auth"],
    summary: "Accept an admin invite: set name and password, start TOTP enrollment",
    request: {
      body: {
        content: { "application/json": { schema: PlatformAcceptInviteSchema } },
      },
    },
    responses: {
      200: jsonOk("Invite accepted; TOTP enrollment pending", PlatformAcceptInviteResponseSchema),
      410: jsonError("Invite invalid, used or expired", [Code.INVALID_INVITE]),
      ...globalErrorResponses,
    },
  })

  router.openapi(route, async (c) => {
    const result = await acceptInvite(db, c.req.valid("json"))
    return handleResult({
      c,
      result,
      successStatus: 200,
      errorMap,
      moduleName: "platform-auth",
    })
  })

  return router
}

export default acceptInviteRoute
