import { createRoute } from "@hono/zod-openapi"
import { createOpenAPIRouter, handleResult } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  PlatformAuthErrorCode as AuthCode,
  PlatformInviteAdminResponseSchema,
  PlatformInviteAdminSchema,
  PlatformManagementErrorCode as Code,
} from "@avuny/contracts/platform-admin"
import { platformManagementErrorsHttpMap as errors } from "../platform-management.errors.js"
import { inviteAdmin } from "../platform-admin.service.js"
import {
  createRequirePlatformPermission,
  getRequestContext,
} from "../../platform-auth/platform-auth.middleware.js"
import {
  honoPath,
  jsonError,
  jsonOk,
  type PlatformAuthRouteDeps,
} from "../../platform-auth/hono-routes/_shared.js"

const errorMap = {
  [Code.INVALID_ROLE_IDS]: errors.INVALID_ROLE_IDS,
  [Code.ESCALATION_DENIED]: errors.ESCALATION_DENIED,
  [Code.ADMIN_EXISTS]: errors.ADMIN_EXISTS,
  [Code.INVITE_PENDING]: errors.INVITE_PENDING,
}

/** Invites a new platform admin by email (A1-05, spec 3.2: invite-only). */
export const inviteAdminRoute = ({ db, requireAuth }: PlatformAuthRouteDeps) => {
  const router = createOpenAPIRouter()
  const requirePermission = createRequirePlatformPermission(
    db,
    "create:platform-admin"
  )

  const route = createRoute({
    method: "post",
    path: "/platform-admins/invite",
    operationId: "platformInviteAdmin",
    tags: ["platform-admin"],
    summary: "Invite a platform admin",
    middleware: [requireAuth, requirePermission] as const,
    request: {
      body: {
        content: { "application/json": { schema: PlatformInviteAdminSchema } },
      },
    },
    responses: {
      201: jsonOk("Invite created", PlatformInviteAdminResponseSchema),
      401: jsonError("Unauthenticated", [AuthCode.UNAUTHENTICATED]),
      403: jsonError("Forbidden", [
        Code.PERMISSION_DENIED,
        Code.ESCALATION_DENIED,
      ]),
      409: jsonError("Conflict", [Code.ADMIN_EXISTS, Code.INVITE_PENDING]),
      422: jsonError("Unknown role", [Code.INVALID_ROLE_IDS]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)

  router.openapi(route, async (c) => {
    const admin = c.get("platformAdmin")
    const result = await inviteAdmin(
      db,
      admin,
      c.req.valid("json"),
      getRequestContext(c)
    )
    return handleResult({
      c,
      result,
      successStatus: 201,
      errorMap,
      moduleName: "platform-admin",
    })
  })

  return router
}

export default inviteAdminRoute
