import type { MiddlewareHandler } from "hono"
import { fail } from "@avuny/utils"
import { handleResult, getRequestLocale } from "@avuny/hono"
import { parsePermissionKey } from "@avuny/contracts"
import { trans } from "../../intl/i18next.js"
import { RoleErrorCode, roleErrorsHttpMap } from "./role.errors.js"
import { permissionChecker, type PermissionChecker } from "./role.permissions.js"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface RequirePermissionOptions {
  /** Path param that holds the organization id. Default: "orgId". */
  orgParam?: string
  /** Path param that holds the record id, for statements narrowed to one record. */
  resourceParam?: string
  /** Override for tests. */
  checker?: PermissionChecker
}

/**
 * Route guard: the signed-in user must hold `action:resource` inside the organization
 * named by the path. Put it AFTER requireAuth:
 *
 *   middleware: [requireAuth, requirePermission("read:organization-user")] as const,
 *
 * Owners pass; portal users and ex-members never do; managed members need an allow
 * statement from one of their roles and no deny. Denials use the standard domain-error
 * envelope (ROLE_PERMISSION_DENIED, 403).
 */
export function requirePermission(
  key: string,
  options: RequirePermissionOptions = {}
): MiddlewareHandler {
  parsePermissionKey(key) // a malformed key fails at startup, not at the first request
  const orgParam = options.orgParam ?? "orgId"
  const checker = options.checker ?? permissionChecker

  return async (c, next) => {
    const user = c.get("user") as { id: string } | undefined
    const orgId = c.req.param(orgParam)
    const resourceId = options.resourceParam ? c.req.param(options.resourceParam) : undefined

    const allowed =
      !!user &&
      !!orgId &&
      UUID.test(orgId) &&
      (await checker.check({ userId: user.id }, key, { orgId, resourceId }))

    if (!allowed)
      return handleResult({
        c,
        result: fail({
          error: RoleErrorCode.ROLE_PERMISSION_DENIED,
          msg: "You do not have permission to perform this action",
        }),
        successStatus: 200,
        errorMap: { ROLE_PERMISSION_DENIED: roleErrorsHttpMap.ROLE_PERMISSION_DENIED } as const,
        errorTrans: trans({ lang: getRequestLocale() }),
        moduleName: "role",
      })
    await next()
  }
}
