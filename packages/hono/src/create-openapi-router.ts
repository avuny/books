import {
  apiValidationErrorSchema,
  type ApiValidationError,
  type ApiValidationIssue,
} from "@avuny/contracts/errors"
import { OpenAPIHono, type Hook, type RouteConfig } from "@hono/zod-openapi"

import { logHttpRequest } from "./create-log.js"

type RawIssue = {
  path: readonly PropertyKey[]
  code: string
  message: string
}

function toApiIssue({ path, code, message }: RawIssue): ApiValidationIssue {
  return {
    // JSON cannot represent symbol keys.
    path: path.filter((key): key is string | number => typeof key !== "symbol"),
    code,
    message, // Localize using your i18next instance.
  }
}

export const validationHook: Hook<any, any, any, any> = (result, c) => {
  if (result.success) {
    return undefined
  }

  const body: ApiValidationError = {
    success: false,
    type: "validation",
    code: "VALIDATION_ERROR",
    message: "Invalid request data", // Localize.
    errors: result.error.issues.map(toApiIssue),
  }

  logHttpRequest({
    c,
    level: "warn",
    error: body.errors,
    msg: "validation_error",
  })

  return c.json(body, 422)
}

// Explicit annotation prevents leaking the concrete Zod schema
// implementation type into generated declaration files.
export const validationErrorResponse: NonNullable<RouteConfig["responses"]> = {
  422: {
    description: "Validation error",
    content: {
      "application/json": {
        schema: apiValidationErrorSchema,
      },
    },
  },
}

export function createOpenAPIRouter() {
  return new OpenAPIHono({
    defaultHook: validationHook,
  })
}
