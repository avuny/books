# Organization User Module — Specification

> **Update this file** whenever a requirement changes: a new error code, a new route, a policy change, or anything else that alters observable behavior.

---

## 1. Purpose

The organization-user module manages memberships within organizations: listing members, changing usernames, deactivating/reactivating members, touching last-accessed timestamps for organization switching, and executing strict ownership transfers.

---

## 2. Domain Model

### 2.1 Organization User Entity (`organization_users` table)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key (membership ID) |
| `org_id` | UUID | FK → organizations |
| `user_id` | UUID | FK → users |
| `type` | enum | `owner`, `managed`, `portal` |
| `username` | text | Username scoped to the organization (`ux_org_username`) |
| `is_active` | boolean | Active status (false = deactivated/offboarded) |
| `last_accessed_at` | timestamp / null | Timestamp of recent access |
| `created_at` | timestamp | Timestamp created |
| `updated_at` | timestamp | Timestamp updated |

---

## 3. Business Rules & Policies

### 3.1 Listing Members (`GET /organizations/{orgId}/members`)
- Caller must have `read:organization-user` permission on the organization.
- Supports offset pagination (`page`, `pageSize`) and search/filter.

### 3.2 Switcher / My Organizations (`GET /me/organizations`)
- Lists all active memberships for the caller across all organizations, sorted by `lastAccessedAt` desc.

### 3.3 Touch Membership (`POST /me/organizations/{orgId}/touch`)
- Updates `last_accessed_at` timestamp for the caller's active membership in the target organization.
- Throttled to at most once per 60 seconds (`TOUCH_THROTTLE_MS = 60_000`).

### 3.4 Update Username (`PATCH /organizations/{orgId}/members/{memberId}`)
- Requires `update:organization-user` permission on the organization.
- Owner username cannot be changed by non-owners (`ORGANIZATION_USER_OWNER_PROTECTED`).
- Username must be unique per organization; collision returns `ORGANIZATION_USER_USERNAME_TAKEN`.
- Emits audit event `ORG_USER_AUDIT_EVENTS.USERNAME_CHANGED`.

### 3.5 Deactivate / Reactivate Member (`PUT /organizations/{orgId}/members/{memberId}/status`)
- Requires `deactivate:organization-user` permission on the organization.
- Protects the owner: owner cannot be deactivated via this endpoint (`ORGANIZATION_USER_OWNER_PROTECTED`).
- Prevents self-action: users cannot deactivate or reactivate themselves (`ORGANIZATION_USER_SELF_ACTION_NOT_ALLOWED`).
- When reactivating, verifies plan limits (`limits.getMax(orgId, resource)`). Fails with `ORGANIZATION_USER_LIMIT_REACHED` if reached.
- Emits audit event `ORG_USER_AUDIT_EVENTS.REACTIVATED` or `DEACTIVATED`.

### 3.6 Transfer Ownership (`POST /organizations/{orgId}/ownership-transfer`)
- Only the **current owner** can transfer ownership.
- The owner must enter the correct organization code as confirmation (`confirmCode !== org.code` fails with `ORGANIZATION_USER_CONFIRMATION_MISMATCH`).
- The target member must be an active member of type `managed` (`ORGANIZATION_USER_INVALID_OWNER_TARGET`).
- In an atomic transaction with advisory lock (`lockOrgMembership`), the old owner is demoted to `managed` and the target is promoted to `owner`.
- Emits audit event `ORG_USER_AUDIT_EVENTS.OWNERSHIP_TRANSFERRED`.

---

## 4. Error Codes

| Code | HTTP Status | Description |
|---|---|---|
| `ORGANIZATION_USER_NOT_FOUND` | 404 | Member or organization membership not found. |
| `ORGANIZATION_USER_FORBIDDEN` | 403 | Caller lacks permission or membership required. |
| `ORGANIZATION_USER_USERNAME_TAKEN` | 409 | Desired username is already taken in the organization. |
| `ORGANIZATION_USER_OWNER_PROTECTED` | 409 | Operation cannot be applied to the organization owner. |
| `ORGANIZATION_USER_SELF_ACTION_NOT_ALLOWED` | 409 | Caller cannot perform this status action on themselves. |
| `ORGANIZATION_USER_LIMIT_REACHED` | 409 | Organization plan limit for member type reached. |
| `ORGANIZATION_USER_INVALID_OWNER_TARGET` | 409 | Target for ownership transfer is not an active managed member. |
| `ORGANIZATION_USER_CONFIRMATION_MISMATCH` | 422 | Confirmation organization code did not match. |

---

## 5. File Structure

```
apps/server/src/api/modules/organization-user/
├── SPEC.md                                   # This specification
├── deps.ts                                   # DI wiring: database, permissions, activity log, limits
├── index.ts                                  # Public barrel
├── organization-user.errors.ts               # HTTP status mappings
├── organization-user.error-map.ts            # Exhaustive error map
├── organization-user.mapper.ts               # Row to DTO mapping functions
├── organization-user.repository.ts           # Drizzle queries & transactions
├── organization-user.service.ts              # Business logic closure factory
├── organization-user.service.spec.ts         # Service unit tests
├── organization-user.types.ts                # Port interfaces and deps bag
├── testing.ts                                # Test doubles (DummyPermissionChecker, DummyLimits, etc.)
├── hono-routes/
│   ├── _shared.ts                            # Response & path helpers
│   ├── module-routes.types.ts                # RouteDeps interface
│   ├── index.ts                              # Aggregator & singletons
│   ├── my-organization-list.route.ts         # GET /me/organizations
│   ├── organization-user-list.route.ts       # GET /organizations/{orgId}/members
│   ├── set-organization-user-status.route.ts # PUT /organizations/{orgId}/members/{memberId}/status
│   ├── touch-organization-membership.route.ts# POST /me/organizations/{orgId}/touch
│   ├── transfer-organization-ownership.route.ts # POST /organizations/{orgId}/ownership-transfer
│   └── update-organization-user.route.ts     # PATCH /organizations/{orgId}/members/{memberId}
└── __tests__/
    └── organization-user.routes.test.ts      # Route-level unit tests
```

