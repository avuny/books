# Organization Module — Specification

> **Update this file** whenever a requirement changes: a new error code, a new route, a policy change, or anything else that alters observable behavior.

---

## 1. Purpose

The organization module manages the core lifecycle of tenant organizations: creation, retrieval, updates, and soft deletion. It governs organization ownership limits, unique subdomain codes, name uniqueness per owner, and membership-aware list querying.

---

## 2. Domain Model

### 2.1 Organization Entity (`organizations` table)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `code` | text | Unique subdomain/identifier across platform; indexed (`ux_org_code`) |
| `name` | text | Organization display name |
| `status` | enum | `active`, `suspended`, `closed` |
| `countryCode` | text | ISO 3166-1 alpha-2 country code |
| `stateId` | UUID / null | Optional administrative region |
| `defaultCurrency` | text | ISO 4217 currency code (e.g. `USD`, `EGP`) |
| `timezone` | text | IANA timezone (e.g. `UTC`, `Africa/Cairo`) |
| `ownerId` | UUID | FK → users (initial creator / owner) |
| `createdAt` | timestamp | Creation timestamp |
| `updatedAt` | timestamp | Last update timestamp |

---

## 3. Business Rules & Policies

### 3.1 Creation (`POST /organizations`)
- Actor must have `create:organization` permission.
- The organization code must not be in `RESERVED_ORGANIZATION_CODES` (e.g., `admin`, `api`, `app`, `auth`, `support`, etc.); otherwise fails with `ORGANIZATION_CODE_RESERVED`.
- User cannot exceed maximum owned organizations allowed by their plan/limits (`ORGANIZATION_LIMIT_REACHED`).
- Owner-level advisory lock (`repo.lockOwner`) is acquired to serialize concurrent creations by the same user.
- Organization name must be unique among organizations owned by the user (`ORGANIZATION_NAME_TAKEN`).
- Creation automatically establishes the initial owner membership and records an audit log entry in the same transaction (`AUDIT_EVENT_TYPES.ORGANIZATION_CREATED`).
- Code collisions on database unique constraint map to `ORGANIZATION_CODE_TAKEN`.

### 3.2 Update (`PATCH /organizations/{id}`)
- Actor must have `update:organization` permission on the organization.
- If renaming, checks name uniqueness for the owner (case-insensitive differences excluded from rejection).
- Updates invalidate the organization cache entry `organization:{id}`.
- Records audit log entry `AUDIT_EVENT_TYPES.ORGANIZATION_UPDATED`.

### 3.3 Soft Delete (`DELETE /organizations/{id}`)
- Actor must have `delete:organization` permission on the target organization.
- Soft-deletes the organization (flips status to `closed`); rows are never hard-deleted.
- Invalidates cache entry `organization:{id}`.
- Records audit log entry `AUDIT_EVENT_TYPES.ORGANIZATION_DELETED`.

### 3.4 Retrieval & Lists
- `getById`: Read-through cache with 300s TTL. Permission `read:organization` is checked before serving cached data.
- `getOffsetPaginationList`: Lists organizations the caller is an active member of, with offset pagination and search filtering.
- `getCursorPaginationList`: Key-set / cursor pagination for dropdowns and selectors.
- `count`: Returns total count of accessible organizations.

---

## 4. Error Codes

| Code | HTTP Status | Description |
|---|---|---|
| `ORGANIZATION_NOT_FOUND` | 404 | Organization does not exist or caller cannot view it. |
| `ORGANIZATION_FORBIDDEN` | 403 | Caller lacks required permission. |
| `ORGANIZATION_LIMIT_REACHED` | 409 | User has reached the maximum number of owned organizations. |
| `ORGANIZATION_NAME_TAKEN` | 409 | An organization with this name already exists under the owner. |
| `ORGANIZATION_CODE_TAKEN` | 409 | The chosen code is already in use by another organization. |
| `ORGANIZATION_CODE_RESERVED` | 422 | The chosen code is a reserved system word. |

---

## 5. File Structure

```
apps/server/src/api/modules/organization/
├── SPEC.md                           # This specification
├── deps.ts                           # DI wiring: database, permissions, activityLog, cache
├── index.ts                          # Public barrel (only entrypoint for other modules)
├── organization.errors.ts            # HTTP status mappings
├── organization.error-map.ts         # Exhaustive error map
├── organization.mapper.ts            # Row to DTO mapping functions
├── organization.repository.ts        # Drizzle queries & transactions
├── organization.service.ts           # Business logic closure factory
├── organization.service.spec.ts      # Service unit tests
├── organization.types.ts             # Port interfaces and deps bag
├── testing.ts                        # Test doubles (DummyPermissionChecker, DummyCache, etc.)
├── hono-routes/
│   ├── _shared.ts                    # jsonOk, jsonError, honoPath helpers
│   ├── module-routes.types.ts        # RouteDeps interface
│   ├── index.ts                      # Aggregator & singletons
│   ├── create-organization.route.ts  # POST /
│   ├── get-organization.route.ts     # GET /:id
│   ├── update-organization.route.ts  # PATCH /:id
│   └── organization-list.route.ts    # GET /
└── __tests__/
    └── organization.routes.test.ts   # Route-level unit tests
```

