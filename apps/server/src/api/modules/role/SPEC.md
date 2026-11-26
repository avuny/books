# Role Module — Specification

> **Update this file** whenever a requirement changes: a new error code, a new route, a policy change, or anything else that alters observable behavior.

---

## 1. Purpose

The role module provides Role-Based Access Control (RBAC) and permissions management across tenant organizations. It handles system roles (seeded and immutable), custom roles (gated by organization plan), granular resource-action permission statements with allow/deny semantics, member role assignments with privilege escalation prevention, and route-level authorization middleware.

---

## 2. Domain Model

### 2.1 Role Entity (`roles` table)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `org_id` | UUID / null | Null for global system roles; UUID for custom organization roles |
| `name` | text | Unique within organization/system scope |
| `description` | text / null | Human-readable explanation |
| `is_system` | boolean | True for built-in roles (`Owner`, `Admin`, `Member`, etc.) |
| `created_at` | timestamp | Creation time |
| `updated_at` | timestamp | Update time |

### 2.2 Role Permission Entity (`role_permissions` table)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `role_id` | UUID | FK → roles |
| `effect` | enum | `allow`, `deny` |
| `resource` | text | Target resource (e.g. `organization`, `organization-user`, `role`, `*`) |
| `action` | text | Target action (e.g. `create`, `read`, `update`, `delete`, `*`) |
| `resource_id` | text | Resource ID narrowing or wildcard `*` |

### 2.3 Member Roles Entity (`organization_user_roles` table)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `org_user_id` | UUID | FK → organization_users (managed member) |
| `role_id` | UUID | FK → roles |
| `assigned_by_user_id` | UUID | FK → users |
| `created_at` | timestamp | Timestamp assigned |

---

## 3. Business Rules & Policies

### 3.1 Permission Statements Evaluation (`canAccess`)
- `owner`: Organization owner has unconditional root access across all resources and actions.
- `portal` and inactive members: Have no permissions (`effective: none`).
- `managed` members: Evaluate effective permissions collected from all assigned roles.
  - A statement with `effect: 'deny'` always overrides any matching `allow`.
  - Wildcards `*` match any resource, action, or resourceId.

### 3.2 System Roles Protection
- System roles (`isSystem: true`) are seeded via `syncSystemRoles`.
- System roles cannot be renamed, edited, or deleted (`ROLE_SYSTEM_READONLY`).

### 3.3 Custom Roles (`POST /organizations/{orgId}/roles`, `PATCH ...`, `DELETE ...`)
- Creation and modification require the `customRoles` plan feature (`features.has(orgId, "customRoles")`). Fails with `ROLE_FEATURE_NOT_AVAILABLE` if absent.
- Names must be unique within the organization (`ROLE_NAME_TAKEN`).
- Every permission statement must be validated against `PERMISSION_CATALOG` (`ROLE_INVALID_PERMISSION`).
- A role currently assigned to any member cannot be deleted (`ROLE_IN_USE`).
- Modifying role permissions invalidates the cached permissions of all users holding the role.

### 3.4 Member Role Assignment (`PUT /organizations/{orgId}/members/{memberId}/roles`)
- Roles can only be assigned to active members of type `managed` (`ROLE_MEMBER_NOT_ASSIGNABLE`).
- Privilege escalation guard: the assigner must already possess every permission grant contained within the assigned roles (`ROLE_ESCALATION_NOT_ALLOWED`).
- Invalidates the cached permissions for the target member.

### 3.5 Permissions Discovery (`GET /me/organizations/{orgId}/permissions`)
- Returns the caller's effective statements and `isOwner` flag to drive dynamic UI element visibility in the frontend.

---

## 4. Error Codes

| Code | HTTP Status | Description |
|---|---|---|
| `ROLE_NOT_FOUND` | 404 | Role does not exist or is outside the organization. |
| `ROLE_PERMISSION_DENIED` | 403 | Caller lacks required permission. |
| `ROLE_NAME_TAKEN` | 409 | A role with this name already exists in the organization. |
| `ROLE_SYSTEM_READONLY` | 409 | System roles cannot be altered or deleted. |
| `ROLE_IN_USE` | 409 | The role cannot be deleted while assigned to members. |
| `ROLE_FEATURE_NOT_AVAILABLE` | 403 | Custom roles are not allowed by the organization's plan. |
| `ROLE_INVALID_PERMISSION` | 422 | A permission statement action or resource is unknown. |
| `ROLE_MEMBER_NOT_FOUND` | 404 | Target member not found. |
| `ROLE_MEMBER_NOT_ASSIGNABLE` | 409 | Target member is not an active managed user. |
| `ROLE_ESCALATION_NOT_ALLOWED` | 403 | Assigner attempted to grant permissions they do not possess. |

---

## 5. File Structure

```
apps/server/src/api/modules/role/
├── SPEC.md                           # This specification
├── deps.ts                           # DI wiring: database, repositories, resolver, checker, service
├── index.ts                          # Public barrel
├── role.errors.ts                    # HTTP status mappings
├── role.error-map.ts                 # Full error map
├── role.mapper.ts                    # Row to DTO mapping functions
├── role.middleware.ts                # requirePermission route middleware
├── role.permissions.ts               # createPermissionResolver, createRbacPermissionChecker
├── role.repository.ts                # Drizzle queries and transactions
├── role.seed.ts                      # Declarative system roles seed
├── role.service.ts                   # Business logic closure factory
├── role.service.spec.ts              # Service unit tests
├── role.rbac.spec.ts                 # RBAC evaluation tests
├── role.permissions.spec.ts          # Resolver tests
├── role.types.ts                     # Interfaces and deps bags
├── testing.ts                        # Test doubles (DummyPlanFeatures, DummyCache, etc.)
├── hono-routes/
│   ├── _shared.ts                    # Response & path helpers
│   ├── module-routes.types.ts        # RouteDeps interface
│   ├── index.ts                      # Aggregator & singletons
│   ├── create-role.route.ts          # POST /organizations/{orgId}/roles
│   ├── delete-role.route.ts          # DELETE /organizations/{orgId}/roles/{roleId}
│   ├── get-member-roles.route.ts     # GET /organizations/{orgId}/members/{memberId}/roles
│   ├── get-role.route.ts             # GET /organizations/{orgId}/roles/{roleId}
│   ├── my-permissions.route.ts       # GET /me/organizations/{orgId}/permissions
│   ├── permission-catalog.route.ts   # GET /permissions/catalog
│   ├── role-list.route.ts            # GET /organizations/{orgId}/roles
│   ├── role-options.route.ts         # GET /organizations/{orgId}/role-options
│   ├── set-member-roles.route.ts     # PUT /organizations/{orgId}/members/{memberId}/roles
│   └── update-role.route.ts          # PATCH /organizations/{orgId}/roles/{roleId}
└── __tests__/
    └── role.routes.test.ts           # Route-level unit tests
```

