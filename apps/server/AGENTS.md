# AGENTS.md — Backend API Modules

This guide defines how to build and maintain backend domain modules under:

```text
apps/server/src/api/modules/<module-name>/
```

These rules are the default for every module. Domain-specific operations may be added, but they do not replace the six minimum service methods defined below.

## 1. What a module represents

A module represents a **domain capability / aggregate**, not necessarily one database table.

A repository is normally organized around an **aggregate root**: the entity that owns the lifecycle and consistency rules of a group of related records. It may read and write several tables when those tables form one aggregate.

For example, a sales order is an aggregate root and its line items are normally child entities of that order:

```text
SalesOrder aggregate
├── sales_orders        (aggregate root)
└── sales_order_lines   (owned child records)
```

The sales-order repository therefore owns operations involving both `sales_orders` and `sales_order_lines`. Creating an order and its lines, changing its lines, loading the order with its lines, and deleting an eligible draft order belong in the same repository boundary and, when they must succeed together, the same transaction.

Do **not** create a separate `sales_order_line` module just because `sales_order_lines` is a separate table. A child table belongs to its aggregate when its records:

- cannot exist meaningfully without the parent;
- are created, changed, and deleted through the parent's lifecycle;
- do not have an independent permission boundary or standalone business workflow.

A record that has its own lifecycle, permissions, workflows, or independent ownership may deserve its own module. References to another aggregate (for example, a customer or item referenced by a sales order) do not become owned child records: keep their ownership in their own modules and use their public APIs or documented domain ports when validation or behavior is needed.

## 2. Required module structure

Use the following structure as the normal starting point. Add files only when the module needs them, but keep the six service operations and the module's public boundary consistent.

```text
apps/server/src/api/modules/<module-name>/
├── <module-name>.repository.ts
├── <module-name>.service.ts
├── <module-name>.types.ts
├── <module-name>.permissions.ts
├── <module-name>.errors.ts
├── <module-name>.mapper.ts             # when row-to-DTO mapping is needed
├── deps.ts
├── testing.ts
├── <module-name>.service.spec.ts          # unit tests: fakes, no database
├── <module-name>.routes.int.test.ts       # route integration tests: real app + real test database
├── hono-routes/
│   ├── module-routes.types.ts
│   ├── create-<module-name>.route.ts
│   ├── list-<module-name>.route.ts
│   ├── <module-name>-options.route.ts
│   ├── get-<module-name>.route.ts
│   ├── update-<module-name>.route.ts
│   ├── delete-<module-name>.route.ts
│   ├── <additional-operation>.route.ts  # optional
│   └── index.ts
└── index.ts
```

The module name in filenames is kebab-case. TypeScript symbols use PascalCase or camelCase as appropriate. Use `.js` extensions in relative imports because the API uses ESM.

A module may also contain focused files such as `validation.ts`, `policy.ts`, `usage.ts`, or `calculations.ts` when that keeps substantial domain logic out of the service. Do not turn the module into a collection of one-file-per-function abstractions without a clear boundary.

## 3. Responsibilities and dependency direction

Keep responsibilities separate:

| File | Responsibility | Must not do |
|---|---|---|
| `*.repository.ts` | Drizzle queries, writes, aggregate loading, transaction access, mapping known database constraints to typed write reasons | Permission checks, HTTP handling, audit logging, user-facing business decisions |
| `*.service.ts` | Use cases, authorization, domain rules, transaction orchestration, DTO conversion, audit after commit | Build SQL queries or depend on Hono request/response objects |
| `*.mapper.ts` | Pure database-row / aggregate-to-DTO conversion | I/O, authorization, database access, business mutations |
| `*.permissions.ts` | Typed permission constants used by the service | Define a permission that is absent from the contracts module registry |
| `*.errors.ts` | HTTP metadata for the module's domain errors | Define new domain error codes |
| `deps.ts` | Construct and wire concrete repository, permission, audit, and other dependencies | Contain business logic |
| `hono-routes/` | HTTP path, validation, OpenAPI schema, auth middleware, service invocation, response mapping | Contain business rules or query the database directly |
| `testing.ts` / `*.spec.ts` | Fixtures, fake dependencies, and service behavior tests | Import production `deps.ts` into service unit tests |
| `index.ts` | Public exports for other modules and API composition | Expose private implementation details unnecessarily |

Use public module exports for cross-module imports. Another module must not import a private file such as `../item/item.repository.js` or reach into another module's `deps.ts`. Export the intended public service, types, or domain port from that module's `index.ts`.

If one use case must atomically coordinate multiple aggregates, make that orchestration explicit. Do not call two independently committing service methods and assume they form one transaction. Pass a shared transaction through a deliberately designed application/domain operation, or put the orchestration in an appropriate higher-level use case.

## 4. Repository conventions

### 4.1 Aggregate repository, not one repository per table

The repository owns all tables that make up its aggregate. Its public methods should speak in domain terms (`insertOrder`, `replaceLines`, `findOrder`, or similar), rather than exposing arbitrary table operations to the service.

For a parent with owned lines:

- Insert the parent and its lines in the same transaction.
- Load the parent and its required child records as one aggregate when the service needs the aggregate.
- Update the parent and replace/update its lines atomically when the input represents one complete order edit.
- Verify child IDs belong to the parent and organization before changing or removing them. Never trust a line ID supplied by the client on its own.
- Keep list-table queries focused on the aggregate root and list-item projection. Do not load every line for every row in a paginated table.
- Use deliberate foreign-key behavior: cascade only for child records whose lifecycle truly belongs to the parent; use restrict for records whose history must prevent deletion.

### 4.2 Standard repository shape

The exact method names may be domain-specific, but a typical aggregate repository exposes the following capabilities:

```ts
import { and, asc, eq, ilike, sql, type SQL } from "drizzle-orm"
import {
  type SalesOrderListFilters,
  type SalesOrderOptionFilters,
  type SalesOrderPatch,
} from "@avuny/contracts"
import {
  salesOrderLines,
  salesOrders,
  type DB,
  type NewSalesOrder,
  type NewSalesOrderLine,
  type SalesOrder,
  type Tx,
} from "@avuny/db"

const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&")

function constraintOf(err: unknown, sqlState: string): string | null {
  const e = err as {
    code?: string
    constraint?: string
    constraint_name?: string
    cause?: unknown
  }
  if (e && e.code === sqlState) return e.constraint ?? e.constraint_name ?? ""
  return e?.cause ? constraintOf(e.cause, sqlState) : null
}

export function createSalesOrderRepository({ db }: { db: DB }) {
  const exec = (tx?: Tx) => tx ?? db

  return {
    transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
      return db.transaction(fn)
    },

    // Aggregate write: persist root and owned children together.
    async insertAggregate(
      orgId: string,
      values: Omit<NewSalesOrder, "orgId" | "id">,
      lines: readonly Omit<NewSalesOrderLine, "orgId" | "id" | "salesOrderId">[],
      tx?: Tx,
    ) {
      try {
        const [order] = await exec(tx)
          .insert(salesOrders)
          .values({ ...values, orgId })
          .returning()

        if (!order) throw new Error("Sales order insert returned no row")

        const insertedLines = lines.length
          ? await exec(tx)
              .insert(salesOrderLines)
              .values(lines.map((line) => ({ ...line, orgId, salesOrderId: order.id })))
              .returning()
          : []

        return { ok: true as const, row: { ...order, lines: insertedLines } }
      } catch (err) {
        // Use the project's shared constraint-inspection helper here.
        if (constraintOf(err, "23505") === "ux_sales_order_org_number") {
          return { ok: false as const, reason: "number_taken" as const }
        }
        throw err
      }
    },

    // Aggregate read: always scope the root by organization; then load its owned lines.
    async findAggregate(
      orgId: string,
      id: string,
      tx?: Tx,
      opts: { forUpdate?: boolean } = {},
    ) {
      const rootQuery = exec(tx)
        .select()
        .from(salesOrders)
        .where(and(eq(salesOrders.orgId, orgId), eq(salesOrders.id, id)))
        .limit(1)

      const [order] = await (opts.forUpdate ? rootQuery.for("update") : rootQuery)
      if (!order) return null

      const lines = await exec(tx)
        .select()
        .from(salesOrderLines)
        .where(and(
          eq(salesOrderLines.orgId, orgId),
          eq(salesOrderLines.salesOrderId, id),
        ))
        .orderBy(asc(salesOrderLines.position), asc(salesOrderLines.id))

      return { ...order, lines }
    },

    // The data-table query returns root rows; it does not hydrate all child lines.
    async list(orgId: string, filters: SalesOrderListFilters, tx?: Tx) {
      const conditions: SQL[] = [eq(salesOrders.orgId, orgId)]
      if (filters.status) conditions.push(eq(salesOrders.status, filters.status))
      const where = and(...conditions)

      const rows = await exec(tx)
        .select()
        .from(salesOrders)
        .where(where)
        .orderBy(asc(salesOrders.createdAt), asc(salesOrders.id))
        .limit(filters.pageSize)
        .offset((filters.page - 1) * filters.pageSize)

      const [counted] = await exec(tx)
        .select({ total: sql<number>`count(*)::int` })
        .from(salesOrders)
        .where(where)

      return { rows, total: counted?.total ?? 0 }
    },

    // Picker query: return a small projection, not full aggregate DTOs.
    async listOptions(orgId: string, filters: SalesOrderOptionFilters, tx?: Tx) {
      const conditions: SQL[] = [eq(salesOrders.orgId, orgId)]
      if (filters.search) {
        conditions.push(ilike(salesOrders.orderNumber, `%${escapeLike(filters.search)}%`))
      }
      if (filters.after) {
        conditions.push(sql`(${salesOrders.orderNumber}, ${salesOrders.id}) > (${filters.after.name}::text, ${filters.after.id}::uuid)`)
      }

      return exec(tx)
        .select({ id: salesOrders.id, name: salesOrders.orderNumber })
        .from(salesOrders)
        .where(and(...conditions))
        .orderBy(asc(salesOrders.orderNumber), asc(salesOrders.id))
        .limit(filters.limit)
    },

    // Root/aggregate update methods should receive the same Tx when part of a use case.
    async updateAggregate(
      orgId: string,
      id: string,
      patch: SalesOrderPatch,
      tx?: Tx,
    ) {
      const [row] = await exec(tx)
        .update(salesOrders)
        .set({ ...patch, updatedAt: new Date() })
        .where(and(eq(salesOrders.orgId, orgId), eq(salesOrders.id, id)))
        .returning()
      return row ?? null
    },

    async replaceLines(
      orgId: string,
      salesOrderId: string,
      lines: readonly Omit<NewSalesOrderLine, "orgId" | "id" | "salesOrderId">[],
      tx: Tx,
    ) {
      // The parent must already be locked and verified by the service/use case.
      await exec(tx)
        .delete(salesOrderLines)
        .where(and(
          eq(salesOrderLines.orgId, orgId),
          eq(salesOrderLines.salesOrderId, salesOrderId),
        ))

      return lines.length
        ? exec(tx)
            .insert(salesOrderLines)
            .values(lines.map((line) => ({ ...line, orgId, salesOrderId })))
            .returning()
        : []
    },

    async delete(orgId: string, id: string, tx?: Tx) {
      // Return a typed reason when a known FK constraint prevents deletion.
      // Unknown database errors must be rethrown, not disguised as a business conflict.
      try {
        const deleted = await exec(tx)
          .delete(salesOrders)
          .where(and(eq(salesOrders.orgId, orgId), eq(salesOrders.id, id)))
          .returning({ id: salesOrders.id })
        return deleted.length
          ? { ok: true as const }
          : { ok: false as const, reason: "not_found" as const }
      } catch (err) {
        if (constraintOf(err, "23503") !== null) {
          return { ok: false as const, reason: "in_use" as const }
        }
        throw err
      }
    },
  }
}
```

The table and filter type names above illustrate the shape; use the real names and types from the module's contracts and database schema. Add the required unique/FK constraint handling for the actual domain. Prefer a shared constraint-inspection helper if the API already provides one. Catch only known SQL states and named constraints; rethrow unexpected errors so genuine defects are not hidden.

### 4.3 Repository rules

- Every organization-owned read and write must be scoped by `orgId`. Include it in child-table conditions too; do not rely only on a client-supplied parent ID.
- Put `orgId` before the record ID in repository signatures when that is the established local pattern.
- Accept an optional `tx?: Tx` on repository methods that can participate in a larger transaction. Use `const exec = (tx?: Tx) => tx ?? db`.
- The repository owns `transaction<T>(fn)` and passes the Drizzle `Tx` to the callback.
- Lock aggregate roots with `forUpdate` when a use case must serialize concurrent edits, posting, reservations, or state transitions.
- Return typed write outcomes for expected unique/FK conflicts. Do not return raw PostgreSQL errors to the service.
- Be careful when catching a PostgreSQL constraint error inside an existing transaction: PostgreSQL may mark that transaction as failed even after application code catches the error. If the configured driver does so, let the error escape the transaction and translate it after rollback, or use an explicit savepoint/rollback mechanism supported by the project. Do not return a failure value and then attempt to continue or commit an aborted transaction.
- Never use a repository method that silently opens its own transaction when the service has already supplied a transaction.
- Keep SQL, joins, filters, pagination, and database constraint names in this layer.
- Do not put authorization, activity-log calls, HTTP status codes, or localized messages in the repository.

## 5. Service conventions — six mandatory methods

Every module service must implement these methods with the same overall signature and behavior pattern:

| Method | Purpose | Expected permission |
|---|---|---|
| `create(actorId, orgId, input)` | Create one aggregate, including owned child records | `create:<resource>` |
| `update(actorId, orgId, id, input)` | Update an existing aggregate | `update:<resource>` |
| `delete(actorId, orgId, id)` | Delete an eligible aggregate, or return a domain error when deletion is not allowed | `delete:<resource>` |
| `listOptions(actorId, orgId, query)` | Return small, eligible picker options with cursor pagination | `read:<resource>` |
| `list(actorId, orgId, query)` | Return a paginated data-table response | `read:<resource>` |
| `get(actorId, orgId, id)` | Return one complete aggregate DTO | `read:<resource>` |

These six methods are mandatory even when the domain has additional operations. Add methods such as `approve`, `post`, `cancel`, `deactivate`, `reactivate`, `reverse`, `duplicate`, or `setDefault` when the domain requires them. Do not use an additional operation as a replacement for one of the six minimum methods.

A method's existence does not mean every record can always undergo that operation. For example, `delete` may return a typed `*_NOT_DELETABLE` error for a posted or historically referenced document. A financial or immutable domain still implements `delete` and expresses its rule explicitly.

### 5.1 Shared service pattern

Use typed `Result` responses from `@avuny/utils`. Check permission before repository access. Scope permission checks to the organization and, where the resource is record-scopable, to the record as well. Convert expected repository/domain failures into contract error codes. Convert database rows through mappers. Write audit records only after the relevant transaction commits.

A common internal transaction outcome is:

```ts
type Outcome<T> =
  | { ok: true; value: T }
  | { ok: false; error: Code; msg: string }

const stop = (error: Code, msg: string) => ({ ok: false as const, error, msg })
```

A service skeleton showing all six mandatory methods:

```ts
import {
  type ActivityLogAction,
  type PermissionKey,
  RoleErrorCode,
  SalesOrderErrorCode as E,
  SalesOrderOptionCursorSchema,
  SALES_ORDER_AUDIT_EVENTS,
  type Code,
  type CreateSalesOrderInput,
  type DeleteSalesOrderResult,
  type OptionListResponse,
  type SalesOrderDto,
  type SalesOrderOffsetListQuery,
  type SalesOrderOffsetListResponse,
  type SalesOrderOptionListQuery,
  type UpdateSalesOrderInput,
} from "@avuny/contracts"
import { decodeCursor, fail, ok, toCursorPage, type Result } from "@avuny/utils"
import { toSalesOrderDto, toSalesOrderListItemDto } from "./sales-order.mapper.js"
import { SALES_ORDER_PERMISSIONS as P } from "./sales-order.permissions.js"
import type { SalesOrderServiceDeps } from "./sales-order.types.js"

type Outcome<T> =
  | { ok: true; value: T }
  | { ok: false; error: Code; msg: string }

const stop = (error: Code, msg: string) => ({ ok: false as const, error, msg })

export function createSalesOrderService(deps: SalesOrderServiceDeps) {
  const repo = deps.repository

  const can = (actorId: string, action: PermissionKey, orgId: string, resourceId = orgId) =>
    deps.permissions.check({ userId: actorId }, action, { resourceId, orgId })

  const forbidden = () =>
    fail({
      error: RoleErrorCode.ROLE_PERMISSION_DENIED,
      msg: "You do not have permission to perform this action",
    })

  const audit = (
    orgId: string,
    actorId: string,
    action: ActivityLogAction,
    resourceId: string,
    metadata?: Record<string, unknown>,
  ) => deps.activityLog.record({ orgId, actorId, action, resourceId, metadata })

  const toFailure = (outcome: { error: Code; msg: string }) =>
    fail({ error: outcome.error, msg: outcome.msg })

  return {
    async create(
      actorId: string,
      orgId: string,
      input: CreateSalesOrderInput,
    ): Promise<Result<SalesOrderDto, Code>> {
      if (!(await can(actorId, P.CREATE, orgId))) return forbidden()

      const outcome = await repo.transaction(async (tx): Promise<Outcome<SalesOrderDto>> => {
        // Validate referenced customer/items, quantities, prices, and domain rules here
        // before writing. Use public domain ports for other aggregates when required.
        const { lines, ...orderValues } = input
        const inserted = await repo.insertAggregate(orgId, orderValues, lines, tx)
        if (!inserted.ok) {
          return stop(E.SALES_ORDER_NUMBER_TAKEN, "A sales order with this number already exists")
        }
        return { ok: true, value: toSalesOrderDto(inserted.row) }
      })

      if (!outcome.ok) return toFailure(outcome)
      await audit(orgId, actorId, SALES_ORDER_AUDIT_EVENTS.CREATED, outcome.value.id)
      return ok({ data: outcome.value, msg: "Sales order created successfully" })
    },

    async update(
      actorId: string,
      orgId: string,
      id: string,
      input: UpdateSalesOrderInput,
    ): Promise<Result<SalesOrderDto, Code>> {
      if (!(await can(actorId, P.UPDATE, orgId, id))) return forbidden()

      const outcome = await repo.transaction(async (tx): Promise<Outcome<SalesOrderDto>> => {
        const current = await repo.findAggregate(orgId, id, tx, { forUpdate: true })
        if (!current) return stop(E.SALES_ORDER_NOT_FOUND, "Sales order not found")
        if (current.status !== "draft") {
          return stop(E.SALES_ORDER_NOT_EDITABLE, "Only draft sales orders can be changed")
        }

        // Validate the full replacement line set before the first write.
        const { lines: replacementLines, ...patch } = input
        const updated = await repo.updateAggregate(orgId, id, patch, tx)
        if (!updated) return stop(E.SALES_ORDER_NOT_FOUND, "Sales order not found")
        const lines = replacementLines !== undefined
          ? await repo.replaceLines(orgId, id, replacementLines, tx)
          : current.lines

        // Build the DTO from the rows already returned by the writes. Avoid a new
        // failure branch after mutations have started; see the transaction rule below.
        return { ok: true, value: toSalesOrderDto({ ...updated, lines }) }
      })

      if (!outcome.ok) return toFailure(outcome)
      await audit(orgId, actorId, SALES_ORDER_AUDIT_EVENTS.UPDATED, id, {
        changedFields: Object.keys(input),
      })
      return ok({ data: outcome.value, msg: "Sales order updated successfully" })
    },

    async delete(
      actorId: string,
      orgId: string,
      id: string,
    ): Promise<Result<DeleteSalesOrderResult, Code>> {
      if (!(await can(actorId, P.DELETE, orgId, id))) return forbidden()

      const outcome = await repo.transaction(async (tx): Promise<Outcome<{ id: string }>> => {
        const current = await repo.findAggregate(orgId, id, tx, { forUpdate: true })
        if (!current) return stop(E.SALES_ORDER_NOT_FOUND, "Sales order not found")
        if (current.status !== "draft") {
          return stop(E.SALES_ORDER_NOT_DELETABLE, "Only draft sales orders can be deleted")
        }
        const deleted = await repo.delete(orgId, id, tx)
        if (!deleted.ok && deleted.reason === "not_found") {
          return stop(E.SALES_ORDER_NOT_FOUND, "Sales order not found")
        }
        if (!deleted.ok) return stop(E.SALES_ORDER_IN_USE, "The sales order is referenced by other records")
        return { ok: true, value: { id } }
      })

      if (!outcome.ok) return toFailure(outcome)
      await audit(orgId, actorId, SALES_ORDER_AUDIT_EVENTS.DELETED, id)
      return ok({ data: { id }, msg: "Sales order deleted successfully" })
    },

    async listOptions(
      actorId: string,
      orgId: string,
      query: SalesOrderOptionListQuery,
    ): Promise<Result<OptionListResponse, Code>> {
      if (!(await can(actorId, P.READ, orgId))) return forbidden()
      const rows = await repo.listOptions(orgId, {
        search: query.search,
        after: decodeCursor(query.cursor, SalesOrderOptionCursorSchema),
        limit: query.limit + 1,
      })
      const page = toCursorPage(rows, query.limit, (row) => ({ name: row.name, id: row.id }))
      return ok({
        data: {
          items: page.items.map(({ id, name }) => ({ id, name })),
          nextCursor: page.nextCursor,
        },
        msg: "Sales order options retrieved successfully",
      })
    },

    async list(
      actorId: string,
      orgId: string,
      query: SalesOrderOffsetListQuery,
    ): Promise<Result<SalesOrderOffsetListResponse, Code>> {
      if (!(await can(actorId, P.READ, orgId))) return forbidden()
      const { rows, total } = await repo.list(orgId, {
        status: query.status,
        search: query.search || undefined,
        page: query.page,
        pageSize: query.pageSize,
      })
      return ok({
        data: {
          items: rows.map(toSalesOrderListItemDto),
          page: query.page,
          pageSize: query.pageSize,
          total,
        },
        msg: "Sales orders retrieved successfully",
      })
    },

    async get(
      actorId: string,
      orgId: string,
      id: string,
    ): Promise<Result<SalesOrderDto, Code>> {
      if (!(await can(actorId, P.READ, orgId, id))) return forbidden()
      const aggregate = await repo.findAggregate(orgId, id)
      if (!aggregate) return fail({ error: E.SALES_ORDER_NOT_FOUND, msg: "Sales order not found" })
      return ok({ data: toSalesOrderDto(aggregate), msg: "Sales order retrieved successfully" })
    },

    // Add domain-specific methods below the six required methods.
  }
}
```

The names and error values in this sample are illustrative; define the real input, response, cursor, and error types in `@avuny/contracts` before using them. Keep service method signatures and `Result` return types explicit.

### 5.2 Important transaction rule

Returning an ordinary `{ ok: false }` value from a Drizzle transaction callback does **not** automatically roll the transaction back. The database sees a normally completed callback unless the transaction is explicitly rolled back or an error is thrown.

Therefore:

1. Perform authorization before opening the transaction.
2. Lock and load the aggregate when concurrency matters.
3. Complete all expected validations before the first write whenever possible.
4. If a failure can still occur after writes have started, use the project's explicit transaction rollback mechanism. Do not return a failure sentinel and accidentally commit partial changes.
5. Keep audit writes after a successful commit. If audit delivery must be guaranteed together with the domain write, use a transactional outbox rather than writing to an external audit service inside the database transaction.

### 5.3 Authorization and permissions

Use `PermissionKey` from `@avuny/contracts`; do not build arbitrary permission strings at runtime. Keep the module's commonly used keys together:

```ts
import type { PermissionKey } from "@avuny/contracts"

export const SALES_ORDER_PERMISSIONS = {
  CREATE: "create:sales-order",
  READ: "read:sales-order",
  UPDATE: "update:sales-order",
  DELETE: "delete:sales-order",
  APPROVE: "approve:sales-order",
} as const satisfies Record<string, PermissionKey>
```

The resource part is the route/resource token generated for the module. For a registry key such as `sales_order`, the permission key commonly uses `sales-order`. Confirm the actual generated `PermissionKey` rather than inventing a string.

Permission checks should normally include `{ resourceId: orgId, orgId }` for organization-level grants. For a record-scopable permission, use the record ID as `resourceId` and keep `orgId` as the tenant boundary. The contracts registry's `scopable` setting determines whether record-level scoping is supported for that resource.

Use the shared `ROLE_PERMISSION_DENIED` error and the established role HTTP mapping. Do not define a module-specific copy of the shared permission error.

### 5.4 Audit logging

Audit only successful domain changes. Use the action values generated from the contracts module registry / exported module audit constants, typed as `ActivityLogAction`. Do not invent event strings in random service methods.

Audit metadata should be useful, small, and free of secrets. Prefer IDs, changed field names, status transitions, and other safe business context. Do not log passwords, tokens, payment credentials, or unnecessary personal data.

## 6. Types and permissions files

### `<module-name>.types.ts`

Keep the module's public inferred service/repository types here when useful:

```ts
import type { ActivityLogAction, PermissionKey } from "@avuny/contracts"
import { createSalesOrderRepository } from "./sales-order.repository.js"
import { createSalesOrderService } from "./sales-order.service.js"

export type SalesOrderRepository = ReturnType<typeof createSalesOrderRepository>
export type SalesOrderService = ReturnType<typeof createSalesOrderService>

export interface SalesOrderServiceDeps {
  repository: SalesOrderRepository
  permissions: {
    check(
      actor: { userId: string },
      action: PermissionKey,
      scope: { resourceId: string; orgId: string },
    ): Promise<boolean>
  }
  activityLog: {
    record(entry: {
      orgId: string
      actorId: string
      action: ActivityLogAction
      resourceId: string
      metadata?: Record<string, unknown>
    }): Promise<unknown>
  }
}
```

Adapt the port signatures to the real exported types from the role and activity-log modules. Keep dependency types explicit; do not solve a circular type problem with `any`.

### `<module-name>.permissions.ts`

Export the permission constants used by the service and constrain them with `satisfies Record<string, PermissionKey>`. Every grantable permission must exist in the contracts registry. Read-only or logged-only operations must not be given a permission just because they have an audit event.

## 7. Mapper conventions

A mapper is a pure conversion from database records / aggregate objects into public DTOs:

```ts
import type { SalesOrder, SalesOrderLine } from "@avuny/db"
import type { SalesOrderDto, SalesOrderListItemDto } from "@avuny/contracts"

type SalesOrderAggregate = SalesOrder & { lines: SalesOrderLine[] }

export function toSalesOrderDto(row: SalesOrderAggregate): SalesOrderDto {
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    status: row.status,
    lines: row.lines.map((line) => ({
      id: line.id,
      itemId: line.itemId,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function toSalesOrderListItemDto(row: SalesOrder): SalesOrderListItemDto {
  return {
    id: row.id,
    orderNumber: row.orderNumber,
    status: row.status,
    updatedAt: row.updatedAt.toISOString(),
  }
}
```

Adapt the fields to the actual contract schemas. DTOs must not expose internal database columns, tenant implementation details, secrets, or unneeded joined data. Convert `Date` values to the timestamp format required by the contract.

## 8. Error mapping and translations

### Domain error codes

Define domain error codes in `packages/contracts` following the contracts package rules. Error codes are public API: do not rename or reuse a shipped code. The service returns those codes; it does not return HTTP status codes.

### `<module-name>.errors.ts`

Map every module domain error to an HTTP status and a default response message. Keep the map exhaustive:

```ts
import type { ErrorMeta } from "@avuny/utils"
import type { SalesOrderErrorCode } from "@avuny/contracts"
import { roleErrorsHttpMap } from "../role/index.js"

export const salesOrderErrorsHttpMap = {
  SALES_ORDER_NOT_FOUND: {
    statusCode: 404,
    responseMessage: "Sales order not found",
  },
  SALES_ORDER_NUMBER_TAKEN: {
    statusCode: 409,
    responseMessage: "A sales order with this number already exists",
  },
  SALES_ORDER_NOT_EDITABLE: {
    statusCode: 409,
    responseMessage: "This sales order can no longer be edited",
  },
  SALES_ORDER_NOT_DELETABLE: {
    statusCode: 409,
    responseMessage: "This sales order cannot be deleted",
  },
  SALES_ORDER_IN_USE: {
    statusCode: 409,
    responseMessage: "The sales order is used by other records",
  },
} as const satisfies Record<SalesOrderErrorCode, ErrorMeta>

export const salesOrderErrorMap = {
  ...salesOrderErrorsHttpMap,
  ROLE_PERMISSION_DENIED: roleErrorsHttpMap.ROLE_PERMISSION_DENIED,
} as const
```

The example must be kept synchronized with the actual error-code union. If the module adds an error code, update the HTTP map, route response declarations, and both locale files.

### API translations

Add the API error translations under:

```text
apps/server/src/api/intl/locales/<module-name>/
├── en.json
└── ar.json
```

Both files must contain the same error keys and complete messages. Do not update only one locale. Keep contracts UI translations and API error translations in their respective established locations; do not mix their responsibilities.

## 9. Dependency composition — `deps.ts`

`deps.ts` is the composition root for this module. It connects the abstract service to concrete dependencies:

- the shared database instance;
- the module repository factory;
- the permission checker;
- the activity-log service adapter;
- other explicit domain ports / registries required by the module.

Example:

```ts
import { db } from "../../db.js"
import { activityLogService } from "../activity-log/index.js"
import { permissionChecker } from "../role/index.js"
import { createSalesOrderRepository } from "./sales-order.repository.js"
import { createSalesOrderService } from "./sales-order.service.js"
import type { SalesOrderService } from "./sales-order.types.js"

let instance: SalesOrderService | undefined

export function getSalesOrderService(): SalesOrderService {
  if (!instance) {
    const repository = createSalesOrderRepository({ db })
    const activityLog = {
      record: (entry: Parameters<typeof activityLogService.log>[0]) =>
        activityLogService.log(entry),
    }

    instance = createSalesOrderService({
      repository,
      permissions: permissionChecker,
      activityLog,
    })
  }

  return instance
}

export const salesOrderService = new Proxy({} as SalesOrderService, {
  get(_target, prop) {
    if (typeof prop !== "string") return undefined
    const service = getSalesOrderService()
    if (!(prop in service)) return undefined
    return service[prop as keyof SalesOrderService]
  },
})
```

Adapt the activity-log adapter's input type to the actual exported API. If lazy construction is unnecessary, prefer simpler direct construction. If a proxy is required, keep it type-safe and do not use `as any` to bypass the service type.

## 10. Hono routes

Put HTTP endpoints under `hono-routes/`. The six standard service methods should have corresponding HTTP endpoints unless the API deliberately exposes a different transport contract. Each route should:

1. Define the method, path, `operationId`, tag, summary, middleware, request schemas, and response schemas with `createRoute`.
2. Use `@avuny/zod` for Zod schemas.
3. Validate organization IDs and record IDs as UUIDs when that is the contract.
4. Apply the established `requireAuth` middleware.
5. Read the authenticated actor from `c.get("user")`.
6. Call the service with `actorId`, `orgId`, and validated input.
7. Return through `handleResult`, `jsonOk`, `jsonError`, `globalErrorResponses`, and the module error map.
8. Keep business rules out of the route.

A typical route shape:

```ts
import { createRoute } from "@hono/zod-openapi"
import { z } from "@avuny/zod"
import { createOpenAPIRouter, getRequestLocale, handleResult } from "@avuny/hono"
import { globalErrorResponses } from "@avuny/utils"
import {
  CreateSalesOrderSchema,
  RoleErrorCode,
  SalesOrderDtoSchema,
  SalesOrderErrorCode as Code,
} from "@avuny/contracts"
import { trans } from "../../../intl/i18next.js"
import { honoPath, jsonError, jsonOk } from "../../shared/route-helpers.js"
import { roleErrorsHttpMap } from "../../role/index.js"
import { salesOrderErrorsHttpMap as errors } from "../sales-order.errors.js"
import type { RouteDeps } from "./module-routes.types.js"

const rawErrorMap = {
  SALES_ORDER_NUMBER_TAKEN: errors.SALES_ORDER_NUMBER_TAKEN,
  ROLE_PERMISSION_DENIED: roleErrorsHttpMap.ROLE_PERMISSION_DENIED,
} as const

const errorMap = rawErrorMap as Record<
  Code | RoleErrorCode,
  (typeof rawErrorMap)[keyof typeof rawErrorMap]
>

export const createSalesOrderRoute = ({ service, requireAuth }: RouteDeps) => {
  const router = createOpenAPIRouter()
  const route = createRoute({
    method: "post",
    path: "/organizations/{orgId}/sales-orders",
    operationId: "createSalesOrder",
    tags: ["sales-order"],
    summary: "Create a sales order",
    middleware: [requireAuth] as const,
    request: {
      params: z.object({ orgId: z.string().uuid() }),
      body: { content: { "application/json": { schema: CreateSalesOrderSchema } } },
    },
    responses: {
      201: jsonOk("Sales order created", SalesOrderDtoSchema),
      403: jsonError("Forbidden", [RoleErrorCode.ROLE_PERMISSION_DENIED]),
      409: jsonError("Conflict", [Code.SALES_ORDER_NUMBER_TAKEN]),
      ...globalErrorResponses,
    },
  })

  router.use(honoPath(route.path), requireAuth)
  router.openapi(route, async (c) => {
    const errorTrans = trans({ lang: getRequestLocale() })
    const user = c.get("user")
    const { orgId } = c.req.valid("param")
    const body = c.req.valid("json")
    const result = await service.create(user.id, orgId, body)

    return handleResult({
      c,
      result,
      successStatus: 201,
      errorMap,
      errorTrans,
      moduleName: "sales-order",
    })
  })

  return router
}
```

The error map in each route should contain the domain errors that route can return plus the shared permission error. The OpenAPI response declarations must list the matching status/error codes. Keep route dependencies in `module-routes.types.ts` and use the project's established middleware type.

In `hono-routes/index.ts`, create the router and mount all route factories. Register static paths such as `/sales-order-options` before parameterized paths such as `/sales-orders/{salesOrderId}` if their patterns could overlap. Export both the factory and configured routes when that is the module convention. Finally, mount the module routes in the API's top-level router composition.

## 11. Tests and test doubles

Create `testing.ts` with stable IDs, aggregate fixtures, fake repository methods, fake permission checks, fake audit logging, and any fake domain ports. Service tests should call `create<Module>Service` with those fakes; they should not import `deps.ts` or the real database.

At minimum, `*.service.spec.ts` must cover:

- authorization for **all six mandatory methods**; denied calls must not touch the repository or audit service;
- organization scoping in permission checks and repository calls;
- successful create/update/delete behavior;
- not-found and expected conflict outcomes;
- list pagination, filters, total count, and list-item mapping;
- option cursor handling and eligibility filters;
- full aggregate behavior, including child records such as order lines;
- audit action and metadata, and proof that audit is not called after a failed operation;
- concurrency/state-transition rules that are important to the module.

A useful authorization matrix:

```ts
const requiredCalls = [
  ["create", (t: TestContext) => t.service.create(ACTOR, ORG, createInput)],
  ["update", (t: TestContext) => t.service.update(ACTOR, ORG, RECORD_ID, updateInput)],
  ["delete", (t: TestContext) => t.service.delete(ACTOR, ORG, RECORD_ID)],
  ["listOptions", (t: TestContext) => t.service.listOptions(ACTOR, ORG, { limit: 20 })],
  ["list", (t: TestContext) => t.service.list(ACTOR, ORG, { page: 1, pageSize: 20 })],
  ["get", (t: TestContext) => t.service.get(ACTOR, ORG, RECORD_ID)],
] as const

it.each(requiredCalls)("denies %s without permission", async (_name, run) => {
  const t = setup()
  t.permissions.check.mockResolvedValue(false)

  const result = await run(t)

  expect(result).toMatchObject({ success: false, error: "ROLE_PERMISSION_DENIED" })
  expect(t.repository.transaction).not.toHaveBeenCalled()
  expect(t.repository.list).not.toHaveBeenCalled()
  expect(t.repository.findAggregate).not.toHaveBeenCalled()
  expect(t.activityLog.record).not.toHaveBeenCalled()
})
```

Add tests for each additional domain operation as well. Repository tests should cover SQL-specific behavior and named constraint translation separately from service tests.

### 11.1 Route integration tests (`<module-name>.routes.int.test.ts`)

Service tests prove branches with fakes. Route integration tests prove the **wiring and the real infrastructure**: route → auth → permission → service → repository → Postgres, tenant isolation, database constraints becoming the right error code, status codes and envelopes. Every module has exactly one such file at the module root; follow `.agents/skills/api-integration-tests/SKILL.md` and `docs/TESTING.md`.

Rules:

- They run the real app (`app.request`) against the dedicated test database. No `vi.mock` of services, repositories, permission checks, the database or the clock. Only external providers are substituted, by environment (`MESSAGE_SENDER_MODE=capture`).
- Arrange through the public API with the `test-support` factories (`createUser`, `createOrganization`, …). Every test builds its own tenant, so tests never share rows and run in parallel. Tests never delete or truncate; the database is rebuilt before the run and emptied after it.
- Each file covers every route of the module and every error code in the module's `errorsHttpMap` that can be reached over HTTP: 401 without a token; 403/404 for a user outside the organization on every read and write; the create → get → list → options → update → delete lifecycle; aggregate rules (child lines belong to the parent and the organization); unique/foreign-key/state conflicts triggered for real; 422 validation.
- Assert status, `success`, error `code` (from the `*ErrorCode` constants) and DTO fields, never message text.
- A repository that lets a known unique/FK violation escape as a 500 is a bug; the integration test for that error code must fail until the repository maps the constraint (§4.3).

## 12. `index.ts` — public module API

Export only what other modules and API composition need. A typical module entry point:

```ts
export { salesOrderRoutes, createSalesOrderRoutes } from "./hono-routes/index.js"
export { salesOrderService, getSalesOrderService } from "./deps.js"
export { createSalesOrderService } from "./sales-order.service.js"
export { salesOrderErrorsHttpMap } from "./sales-order.errors.js"
export { SALES_ORDER_PERMISSIONS } from "./sales-order.permissions.js"
export type { SalesOrderService, SalesOrderRepository } from "./sales-order.types.js"
```

Export additional domain ports or types only when another module genuinely needs them. Keep repository internals private unless there is a specific, documented reason to expose them.

## 13. Registering the module in the contracts registry

The central module/action registry lives at:

```text
packages/contracts/src/modules/registry.ts
```

This file is the source of truth for module resources, grantable permission actions, activity-log events, and sidebar metadata. Other lists are derived from it, including the permission catalog / `PermissionKey`, activity-log action types and allowed actions, sidebar tree/options/labels, and related seed data.

### 13.1 How an action is interpreted

Each action can define two independent properties:

```ts
interface ActionSpec {
  permission?: true
  event?: string
}
```

- `permission: true` means a role can be granted `<action>:<resource>`.
- `event: "approved"` means the activity log records `<module>.<event>`.
- Both can be present when the operation is grantable and audited.
- Only one can be present when the action is grantable but not logged, or logged but not independently grantable.

For example, `read` is commonly grantable but not logged. A lifecycle event such as `approved` may be logged and also have a permission. A system-driven event such as `joined` may be logged without a separately grantable permission.

Use the shared `READ` / `CRUD` definitions where they match the module's actual behavior. Do not blindly use `CRUD` if an operation has special lifecycle semantics or is not supported by the domain.

### 13.2 Add the module entry

Add the module key in `MODULES` using `snake_case`. Define its actions and, when it should appear in the sidebar, its sidebar metadata:

```ts
sales_order: {
  sidebar: {
    group: "sales",
    icon: "shopping-bag",
    path: "/sales-orders",
    label: { en: "Sales orders", ar: "أوامر البيع" },
  },
  actions: {
    ...CRUD,
    approve: { permission: true, event: "approved" },
    cancel: { permission: true, event: "cancelled" },
    send: { event: "sent" },
  },
  scopable: true,
},
```

Before using a sidebar group, verify it exists in `SIDEBAR_GROUPS`. If it does not, add the group there with its icon and complete `en` / `ar` labels. The group declaration controls sidebar grouping/order. A module without `sidebar` metadata does not appear as a sidebar destination, but its permissions and events can still be registered.

Use:

- `snake_case` for the registry resource key, e.g. `sales_order`;
- the generated hyphenated resource token for permission/route keys, e.g. `sales-order`;
- an organization-relative path for the sidebar, e.g. `/sales-orders`;
- complete Arabic and English labels.

Set `scopable: true` only if the module's permissions are intended to support record-level `resource_id` grants. Do not enable it automatically for every module.

### 13.3 Registry changes have consequences

- Adding a permission action makes it available to the derived permission catalog and role UI/validation.
- Adding an event expands the activity-log action type and allowed event list.
- Adding sidebar metadata adds the module to the derived sidebar and seed composition.
- The seed synchronizes the plain-text module/action/sidebar records with this registry. The registry comments describe which records are inserted, updated, or removed by the seed; understand those effects before changing an existing entry.
- Removing or renaming a module/action can remove grants from all roles, including custom roles, on the next seed.
- Audit rows are historical and append-only. **Never remove or rename an event that has shipped.** Add a new event and deprecate the old behavior instead.
- Follow the actual database schema and seed behavior in the current codebase before concluding that a change needs or does not need a migration. Do not create a migration solely for a registry edit when the project stores the affected names as plain text and the seed owns synchronization.

After editing the registry, rebuild `@avuny/contracts` and check that the generated permission and activity-log types accept the module's permission constants and audit actions.

## 14. Build order for a new backend module

For a feature that introduces new persisted data, work in dependency order:

1. **Contracts:** add constants, error codes, schemas, inferred input/DTO/query types, cursor schema, audit constants where appropriate, exports, and contract tests. Follow `packages/contracts/AGENTS.md`. When an update input contains a line array that replaces all stored lines, document that replacement behavior beside the schema.
2. **Database:** add aggregate-root and owned-child tables, relations, indexes, unique/FK constraints, inferred row types, exports, and migrations. Keep child ownership and deletion behavior explicit.
3. **Contracts registry:** add the module/actions/sidebar data in `packages/contracts/src/modules/registry.ts`; add a sidebar group first if needed. Rebuild contracts and verify derived types.
4. **Repository:** implement tenant-scoped aggregate reads/writes, list and option queries, transactions, locks, and expected constraint mapping.
5. **Mapper and service:** implement DTO mapping, all six mandatory methods, authorization, business rules, transaction boundaries, audit-after-commit, and any additional domain operations.
6. **Dependency wiring and exports:** implement `deps.ts`, `index.ts`, route dependency types, and public module exports.
7. **Routes:** implement OpenAPI routes for the required methods and additional operations; mount the module in the API router composition.
8. **API translations:** add matching `en.json` and `ar.json` error translations under `apps/server/src/api/intl/locales/<module-name>/` and register the namespace wherever the API translation setup requires it.
9. **Tests:** repository tests where SQL-specific behavior matters; service tests (all six authorization paths); `<module-name>.routes.int.test.ts` (route integration, §11.1); route/OpenAPI tests where established.
10. **Verify:** build, typecheck, lint, and run the relevant tests for contracts, database, and server. Do not treat a successful API typecheck as proof that the contracts package or migration is correct.

## 15. Final checklist

Before considering a module complete, verify all of the following:

- [ ] The module models a domain capability / aggregate, not an arbitrary single table.
- [ ] The repository owns the aggregate root and its owned child tables; child IDs and tenant ownership are validated.
- [ ] All tenant-owned reads and writes are scoped by `orgId`.
- [ ] Repository methods accept `Tx` where they may participate in a larger use-case transaction.
- [ ] Expected database conflicts become typed write reasons; unexpected errors are rethrown.
- [ ] The service implements `create`, `update`, `delete`, `listOptions`, `list`, and `get`.
- [ ] Every service method checks authorization before repository access.
- [ ] Additional domain methods do not replace any mandatory method.
- [ ] Transaction failures cannot accidentally commit partial writes.
- [ ] Audit events are registered centrally and logged only after successful commits (or through a transactional outbox when atomic delivery is required).
- [ ] DTOs are mapped explicitly and do not leak internal columns.
- [ ] HTTP error metadata, OpenAPI response declarations, and both API locales cover the module's errors.
- [ ] The contracts registry includes the correct resource/actions and optional sidebar metadata.
- [ ] The module is mounted in the API router and exposes only its intended public API.
- [ ] Service tests cover denied access for all six mandatory methods, successful paths, errors, aggregate behavior, pagination, options, and audit behavior.
- [ ] `<module-name>.routes.int.test.ts` exists, hits every route, triggers every reachable error code, and `pnpm --filter @avuny/books-server test:int` passes.
- [ ] No test deletes, skips or weakens another test to pass; a bug fix starts with a failing regression test.
- [ ] No `any` is introduced to bypass a typing issue.
- [ ] Contracts build, database migration checks, server typecheck/lint, and relevant tests pass.
