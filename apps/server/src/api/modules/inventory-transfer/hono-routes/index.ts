import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, getRequestLocale, handleResult } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  CreateInventoryTransferSchema,
  DispatchInventoryTransferSchema,
  ReverseInventoryTransferSchema,
  SettleInventoryTransferSchema,
  InventoryTransferDtoSchema,
  InventoryTransferOffsetListQuerySchema,
  InventoryTransferOffsetListResponseSchema,
  InventoryTransferOptionDtoSchema,
  InventoryTransferOptionsQuerySchema,
  RoleErrorCode,
  UpdateInventoryTransferSchema,
} from "@avuny/contracts"
import { trans } from "../../../intl/i18next.js"
import { requireAuth as defaultRequireAuth } from "../../auth/index.js"
import { requirePermission as defaultRequirePermission } from "../../role/role.middleware.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import { inventoryTransferErrorMap } from "../inventory-transfer.error-map.js"
import { inventoryTransferErrorsHttpMap } from "../inventory-transfer.errors.js"
import { inventoryTransferService } from "../deps.js"
import type { RouteDeps } from "./module-routes.types.js"

const errorMap = inventoryTransferErrorMap as never

const codesWithStatus = (status: number) =>
  Object.entries(inventoryTransferErrorsHttpMap)
    .filter(([, v]) => v.statusCode === status)
    .map(([k]) => k) as [string, ...string[]]

const orgParam = z.object({ orgId: z.string().uuid() })
const idParam = z.object({ orgId: z.string().uuid(), id: z.string().uuid() })
const base = "/organizations/{orgId}/inventory-transfers"
const tags = ["inventory-transfer"]

export const createInventoryTransferRoutes = ({
  service,
  requireAuth,
  requirePermission = defaultRequirePermission,
}: RouteDeps) => {
  const router = createOpenAPIRouter()

  const errs = {
    403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
    404: jsonError("Not found", codesWithStatus(404)),
    409: jsonError("Conflict", codesWithStatus(409)),
    422: jsonError("Invalid request", codesWithStatus(422)),
    ...globalErrorResponses,
  }

  const run = async (
    c: any,
    successStatus: 200 | 201,
    call: (userId: string) => Promise<any>
  ) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const result = await call(c.get("user").id)
    return handleResult({ c, result, successStatus, errorMap, errorTrans, moduleName: "inventory-transfer" } as never)
  }

  const options = createRoute({
    method: "get",
    path: `${base}/options`,
    operationId: "listInventoryTransferOptions",
    tags,
    summary: "List inventory transfer options",
    middleware: [requireAuth, requirePermission("read:inventory-transfer")] as const,
    request: { params: orgParam, query: InventoryTransferOptionsQuerySchema },
    responses: {
      200: jsonOk("Options", z.object({ items: z.array(InventoryTransferOptionDtoSchema) })),
      ...errs,
    },
  })
  router.use(honoPath(options.path), requireAuth)
  router.openapi(options, (c) =>
    run(c, 200, (uid) => service.listOptions(uid, c.req.valid("param").orgId, c.req.valid("query"))) as never
  )

  const create = createRoute({
    method: "post",
    path: base,
    operationId: "createInventoryTransfer",
    tags,
    summary: "Create a draft inventory transfer with lines",
    middleware: [requireAuth, requirePermission("create:inventory-transfer")] as const,
    request: {
      params: orgParam,
      body: { content: { "application/json": { schema: CreateInventoryTransferSchema } } },
    },
    responses: { 201: jsonOk("Inventory transfer created", InventoryTransferDtoSchema), ...errs },
  })
  router.use(honoPath(create.path), requireAuth)
  router.openapi(create, (c) =>
    run(c, 201, (uid) => service.create(uid, c.req.valid("param").orgId, c.req.valid("json"))) as never
  )

  const list = createRoute({
    method: "get",
    path: base,
    operationId: "listInventoryTransfers",
    tags,
    summary: "List inventory transfers with pagination and filters",
    middleware: [requireAuth, requirePermission("read:inventory-transfer")] as const,
    request: { params: orgParam, query: InventoryTransferOffsetListQuerySchema },
    responses: { 200: jsonOk("Inventory transfers", InventoryTransferOffsetListResponseSchema), ...errs },
  })
  router.use(honoPath(list.path), requireAuth)
  router.openapi(list, (c) =>
    run(c, 200, (uid) => service.list(uid, c.req.valid("param").orgId, c.req.valid("query"))) as never
  )

  const cancel = createRoute({
    method: "post",
    path: `${base}/{id}/cancel`,
    operationId: "cancelInventoryTransfer",
    tags,
    summary: "Cancel a draft inventory transfer",
    middleware: [requireAuth, requirePermission("cancel:inventory-transfer")] as const,
    request: { params: idParam },
    responses: { 200: jsonOk("Inventory transfer cancelled", InventoryTransferDtoSchema), ...errs },
  })
  router.use(honoPath(cancel.path), requireAuth)
  router.openapi(cancel, (c) =>
    run(c, 200, (uid) => {
      const { orgId, id } = c.req.valid("param")
      return service.cancel(uid, orgId, id)
    }) as never
  )

  const action = <B extends z.ZodTypeAny>(
    name: string,
    summary: string,
    permission: "dispatch" | "return" | "reverse",
    schema: B,
    call: (uid: string, orgId: string, id: string, body: any) => Promise<any>
  ) => {
    const r = createRoute({
      method: "post",
      path: `${base}/{id}/${name}`,
      operationId: `${name}InventoryTransfer`,
      tags,
      summary,
      middleware: [requireAuth, requirePermission(`${permission}:inventory-transfer` as never)] as const,
      request: { params: idParam, body: { required: false, content: { "application/json": { schema } } } },
      responses: { 200: jsonOk(summary, InventoryTransferDtoSchema), ...errs },
    })
    router.use(honoPath(r.path), requireAuth)
    router.openapi(r, (async (c: any) => {
      const { orgId, id } = c.req.valid("param")
      const body = c.req.valid("json") ?? {}
      return run(c, 200, (uid) => call(uid, orgId, id, body))
    }) as never)
  }
  action("dispatch", "Dispatch a draft inventory transfer", "dispatch", DispatchInventoryTransferSchema, (u, o, i, b) =>
    service.dispatch(u, o, i, b)
  )
  action("return", "Return what is in transit to the source", "return", SettleInventoryTransferSchema, (u, o, i, b) =>
    service.returnToSource(u, o, i, b)
  )
  action("reverse", "Reverse a dispatch before anything was received", "reverse", ReverseInventoryTransferSchema, (u, o, i, b) =>
    service.reverseDispatch(u, o, i, b)
  )

  const get = createRoute({
    method: "get",
    path: `${base}/{id}`,
    operationId: "getInventoryTransfer",
    tags,
    summary: "Get an inventory transfer by ID",
    middleware: [requireAuth, requirePermission("read:inventory-transfer")] as const,
    request: { params: idParam },
    responses: { 200: jsonOk("Inventory transfer", InventoryTransferDtoSchema), ...errs },
  })
  router.use(honoPath(get.path), requireAuth)
  router.openapi(get, (c) =>
    run(c, 200, (uid) => {
      const { orgId, id } = c.req.valid("param")
      return service.get(uid, orgId, id)
    }) as never
  )

  const update = createRoute({
    method: "patch",
    path: `${base}/{id}`,
    operationId: "updateInventoryTransfer",
    tags,
    summary: "Update a draft inventory transfer",
    middleware: [requireAuth, requirePermission("update:inventory-transfer")] as const,
    request: {
      params: idParam,
      body: { content: { "application/json": { schema: UpdateInventoryTransferSchema } } },
    },
    responses: { 200: jsonOk("Inventory transfer updated", InventoryTransferDtoSchema), ...errs },
  })
  router.use(honoPath(update.path), requireAuth)
  router.openapi(update, (c) =>
    run(c, 200, (uid) => {
      const { orgId, id } = c.req.valid("param")
      return service.update(uid, orgId, id, c.req.valid("json"))
    }) as never
  )

  const del = createRoute({
    method: "delete",
    path: `${base}/{id}`,
    operationId: "deleteInventoryTransfer",
    tags,
    summary: "Delete a draft inventory transfer",
    middleware: [requireAuth, requirePermission("delete:inventory-transfer")] as const,
    request: { params: idParam },
    responses: { 200: jsonOk("Inventory transfer deleted", z.object({ id: z.string().uuid() })), ...errs },
  })
  router.use(honoPath(del.path), requireAuth)
  router.openapi(del, (c) =>
    run(c, 200, (uid) => {
      const { orgId, id } = c.req.valid("param")
      return service.delete(uid, orgId, id)
    }) as never
  )

  return router
}

export const inventoryTransferRoutes = createInventoryTransferRoutes({
  service: inventoryTransferService,
  requireAuth: defaultRequireAuth,
})

export default inventoryTransferRoutes
