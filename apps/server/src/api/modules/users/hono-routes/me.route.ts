import { createRoute } from "@hono/zod-openapi"
import { createOpenAPIRouter, handleResult, getRequestLocale } from "@avuny/hono"
import { MeResponseSchema, UsersErrorCode } from "@avuny/contracts"
import {
  createResponseSchema,
  createDomainErrorResponseSchema,
  globalErrorResponses,
} from "@avuny/utils"
import { trans } from "../../../intl/i18next.js"
import { db } from "../../../db.js"
import { usersErrorsHttpMap } from "../core/errors/index.js"
import { getUserProfile } from "../shell/users.service.js"
import { requireAuth } from "../../auth/index.js"

const router = createOpenAPIRouter()

const meErrorMap = {
  IDENTIFIER_NOT_FOUND: usersErrorsHttpMap.IDENTIFIER_NOT_FOUND,
} as const

export const getMeRoute = createRoute({
  method: "get",
  path: "/me",
  operationId: "getMe",
  tags: ["users"],
  summary: "Get current signed-in user profile and identifiers",
  responses: {
    200: {
      description: "User profile returned successfully",
      content: {
        "application/json": {
          schema: createResponseSchema(MeResponseSchema),
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

router.use("/me", requireAuth)

router.openapi(getMeRoute, async (c) => {
  const lang = getRequestLocale()
  const errorTrans = trans({ lang })
  const user = c.get("user")

  const result = await getUserProfile(db, user.id)

  return handleResult({
    c,
    result,
    successStatus: 200,
    errorMap: meErrorMap,
    errorTrans,
    moduleName: "users",
  })
})

export default router
