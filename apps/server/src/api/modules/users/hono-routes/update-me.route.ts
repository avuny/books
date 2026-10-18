import { createRoute } from "@hono/zod-openapi"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import {
  UpdateProfileBodySchema,
  UpdateProfileResponseSchema,
  UsersErrorCode,
} from "@avuny/contracts"
import {
  createResponseSchema,
  createDomainErrorResponseSchema,
  globalErrorResponses,
} from "@avuny/utils"
import { trans } from "../../../intl/i18next.js"
import { db } from "../../../db.js"
import { usersErrorsHttpMap } from "../core/errors/index.js"
import { updateUserProfile } from "../shell/users.service.js"
import { requireAuth } from "../../auth/index.js"

const router = createOpenAPIRouter()

const updateMeErrorMap = {
  IDENTIFIER_NOT_FOUND: usersErrorsHttpMap.IDENTIFIER_NOT_FOUND,
} as const

export const updateMeRoute = createRoute({
  method: "patch",
  path: "/me",
  operationId: "updateMe",
  tags: ["users"],
  summary: "Update current user's profile name (Slice 4a)",
  middleware: [requireAuth] as const,
  request: {
    body: {
      content: {
        "application/json": {
          schema: UpdateProfileBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Profile updated successfully",
      content: {
        "application/json": {
          schema: createResponseSchema(UpdateProfileResponseSchema),
        },
      },
    },
    404: {
      description: "User not found",
      content: {
        "application/json": {
          schema: createDomainErrorResponseSchema([
            UsersErrorCode.IDENTIFIER_NOT_FOUND,
          ]),
        },
      },
    },
    ...globalErrorResponses,
  },
})

router.openapi(updateMeRoute, async (c) => {
  const lang = getRequestLocale()
  const errorTrans = trans({ lang })
  const user = c.var.user
  const session = c.var.session
  const body = c.req.valid("json")

  const ipAddress =
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || undefined
  const userAgent = c.req.header("user-agent") || undefined
  const requestId = (c.var as unknown as { requestId?: string })?.requestId

  const result = await updateUserProfile(db, {
    userId: user.id,
    name: body.name,
    sessionId: session.id,
    ipAddress,
    userAgent,
    requestId,
  })

  return handleResult({
    c,
    result,
    successStatus: 200,
    errorMap: updateMeErrorMap,
    errorTrans,
    moduleName: "users",
  })
})

export default router
