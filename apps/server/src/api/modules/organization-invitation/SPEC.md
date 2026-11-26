# Organization Invitation Module — Specification

> **Update this file** whenever a requirement changes: a new error code, a new route, a policy change, a new delivery channel, or anything else that alters observable behavior.

---

## 1. Purpose

The organization-invitation module allows organization managers to invite external people (or existing platform users) to join an organization with a specific role. It manages the full invitation lifecycle from creation through acceptance or decline/revocation, and handles notification delivery via email or WhatsApp.

---

## 2. Domain Model

### 2.1 Invitation Entity (`organization_invitations` table)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `org_id` | UUID | FK → organizations |
| `identifier` | text | Lowercased contact: email or E.164 phone |
| `role_id` | UUID | FK → roles — **required at creation** |
| `invitee_user_id` | UUID | Linked after sign-up auto-link, or at accept |
| `token_hash` | text | SHA-256 of the plaintext token; never exposed |
| `status` | enum | `pending`, `accepted`, `declined`, `revoked`, `expired` |
| `invited_by` | UUID | FK → organization_users (member id of inviter) |
| `expires_at` | timestamp | Creation time + 7 days; rotated on resend |
| `responded_at` | timestamp | Null until the invitee responds |
| `accepted_org_user_id` | UUID | FK → organization_users; set on accept |
| `send_count` | int | Starts at 1; incremented on resend |
| `last_sent_at` | timestamp | Last delivery attempt |

### 2.2 Statuses

```
created → pending ──► accepted
                  ──► declined
                  ──► revoked   (manager action)
                  ──► expired   (TTL elapsed)
```

A pending row past its `expires_at` is treated as `expired` even before the background job flips it.

---

## 3. Business Rules & Policies

### 3.1 Creation (`POST /organizations/{orgId}/invitations`)

- Actor must have `create:organization-invitation` permission in the org.
- Actor must be an **active member** of the organization.
- **`roleId` is required** — invitations without a role are rejected with `ORGANIZATION_INVITATION_ROLE_NOT_FOUND`.
- The resolved role must exist in the organization (`roleService.getById`).
- If the identifier matches an existing verified user and that user is already an **active member**, return `ORGANIZATION_INVITATION_ALREADY_MEMBER`.
- If the organization's plan member limit is reached (active + pending ≥ max), return `ORGANIZATION_INVITATION_LIMIT_REACHED`.
- Stale (expired) pending invitations for the same target are flipped to `expired` before inserting.
- If a live pending invitation for the same identifier/user already exists, return `ORGANIZATION_INVITATION_ALREADY_PENDING`.
- A plaintext 256-bit random token is generated; only its SHA-256 hash is stored.
- The token TTL is **7 days** (`INVITATION_TTL_DAYS`).
- After commit, an invitation notification is dispatched (email or WhatsApp) through the messaging module. Delivery failure does **not** roll back the invitation — the message in the response indicates whether delivery succeeded.

### 3.2 Resend (`POST /organizations/{orgId}/invitations/{id}/resend`)

- Actor must have `update:organization-invitation` permission.
- Invitation must be **pending** and **not expired**.
- Max resend count: **5** (`MAX_SEND_COUNT`). After that, return `ORGANIZATION_INVITATION_RESEND_LIMIT_REACHED`.
- Cooldown between resends: **60 seconds** (`RESEND_COOLDOWN_MS`). Violations return `ORGANIZATION_INVITATION_RESEND_TOO_SOON`.
- On resend, a fresh token is generated and the expiry window is reset to `now + 7 days`.
- Delivers the new token via the messaging module after update.

### 3.3 Revoke (`POST /organizations/{orgId}/invitations/{id}/revoke`)

- Actor must have `update:organization-invitation` permission.
- Invitation must be **pending**.
- Sets status to `revoked`.

### 3.4 List (Manager view) (`GET /organizations/{orgId}/invitations`)

- Actor must have `read:organization-invitation` permission.
- Offset-paginated; supports optional `status` filter.
- A pending row past `expires_at` is returned with effective status `expired`.

### 3.5 Preview (`POST /invitations/preview`) — Public

- Accepts the plaintext token; hashes it and looks up the row.
- Returns `InvitationPreviewDto` including org name, org code, identifier, role name (if any), and expiry.
- Returns `ORGANIZATION_INVITATION_NOT_FOUND` if no row matches the token.
- Returns `ORGANIZATION_INVITATION_EXPIRED` if the row is past its TTL.
- Returns `ORGANIZATION_INVITATION_NOT_PENDING` if already accepted/declined/revoked.
- Returns `ORGANIZATION_INVITATION_ORGANIZATION_UNAVAILABLE` if the org is not active.

### 3.6 Accept by Token (`POST /invitations/accept`) — Authenticated

Used when a **signed-in user** follows an email/WhatsApp link.

- Actor must be authenticated.
- Looks up invitation by token hash.
- For open invitations (no `invitee_user_id`): the actor's verified contacts (emails + phones) must include the `identifier`. Mismatch → `ORGANIZATION_INVITATION_IDENTITY_MISMATCH`.
- For targeted invitations (`invitee_user_id` set): actor must match.
- Invitation must be pending and not expired.
- Organization must be active.
- Actor must not already be an active member.
- Plan member limit checked; `ORGANIZATION_INVITATION_LIMIT_REACHED` if exceeded.
- Calls `organizationUserService.addMember` to add the user (re-activates if previously inactive).
- If invitation specifies a `role_id`, calls `roleService.assignRole` to assign the role.
- Sets invitation to `accepted`, revokes other pending invitations for the same person in the same org.
- Logs `INVITATION_ACCEPTED` and `ORGANIZATION_USER_JOINED` audit events.
- Returns the new `OrganizationUserDto`.

### 3.7 Accept from Inbox (`POST /me/invitations/{id}/accept`) — Authenticated

Used from the **in-app dashboard inbox** where invitations are already linked to the user.

- Identical acceptance logic to 3.6, but lookup is by `(invitationId, userId)` from `findForInvitee`.
- Identity check is implicit (the row already has `invitee_user_id = actor.id`).

### 3.8 List Mine (`GET /me/invitations`) — Authenticated

- Returns all open (`pending`, not expired) invitations addressed to the signed-in user.
- Filtered by `invitee_user_id = actor.id` and org status `active`.

### 3.9 Decline (`DELETE /me/invitations/{id}`) — Authenticated

- Sets invitation to `declined`.
- Invitation must be pending and not expired.
- Logs `INVITATION_DECLINED`.

---

## 4. Notification Delivery

### 4.1 Architecture

Delivery is handled by `InvitationNotifier` (port) backed by `createMessageInvitationNotifier` (adapter in `invitation.notifier.ts`), which delegates to the messaging module's `MessageSender`.

```
service.create / service.resend
       │
       └─► deliver(InvitationDelivery)
                  │
                  └─► InvitationNotifier.send(delivery)
                             │
                             └─► MessageSender.sendInvitation(input)
                                        │
                                   ┌────┴────┐
                                   │         │
                              Email (Resend)  WhatsApp (Graph API)
```

### 4.2 Channel Selection

The channel is determined by the `identifier`:
- **Phone numbers** (starting with `+`): WhatsApp
- **Everything else**: Email

### 4.3 Payload

The `sendInvitation` call receives:
- `to`: the identifier
- `type`: `"email"` | `"phone"`
- `orgName`: organization display name
- `link`: `${WEB_APP_URL}/invitations/accept?token=<plaintext-token>`
- `expiresAt`: invitation expiry timestamp

### 4.4 Delivery Failure Handling

Delivery runs **after** the transaction commits. If it throws, the error is logged (never including the token) and the response indicates partial success: `"Invitation created, but delivery failed. You can resend it"`. The invitation persists and can be resent.

---

## 5. Sign-up Auto-link (`linkPendingInvitations`)

When a user verifies a new email/phone, the auth module calls `service.linkPendingInvitations(userId, contact)`. This finds open invitations matching the contact's identifier and sets `invitee_user_id = userId` on them, making them appear in the user's inbox.

---

## 6. Background Job (`expireDueInvitations`)

A scheduled job calls `service.expireDueInvitations()` which bulk-flips all pending rows past their `expires_at` to status `expired`.

---

## 7. Error Codes

| Code | HTTP | When |
|---|---|---|
| `ORGANIZATION_INVITATION_NOT_FOUND` | 404 | Token/ID not found |
| `ORGANIZATION_INVITATION_FORBIDDEN` | 403 | Missing permission |
| `ORGANIZATION_INVITATION_ORGANIZATION_UNAVAILABLE` | 409 | Org is not active |
| `ORGANIZATION_INVITATION_ALREADY_MEMBER` | 409 | Invitee is already active |
| `ORGANIZATION_INVITATION_ALREADY_PENDING` | 409 | Duplicate pending invite |
| `ORGANIZATION_INVITATION_LIMIT_REACHED` | 409 | Plan member limit hit |
| `ORGANIZATION_INVITATION_TARGET_UNAVAILABLE` | 422 | No usable contact (unused — reserved) |
| `ORGANIZATION_INVITATION_NOT_PENDING` | 409 | Invitation not in pending state |
| `ORGANIZATION_INVITATION_EXPIRED` | 410 | Invitation past TTL |
| `ORGANIZATION_INVITATION_RESEND_TOO_SOON` | 429 | Cooldown not elapsed |
| `ORGANIZATION_INVITATION_RESEND_LIMIT_REACHED` | 409 | Max resend count exceeded |
| `ORGANIZATION_INVITATION_USERNAME_REQUIRED` | 422 | (reserved for future use) |
| `ORGANIZATION_INVITATION_USERNAME_TAKEN` | 409 | (reserved for future use) |
| `ORGANIZATION_INVITATION_IDENTITY_MISMATCH` | 403 | Token invite sent to different contact |
| `ORGANIZATION_INVITATION_ROLE_NOT_FOUND` | 404 | Role not found or not in org |

---

## 8. Routes Summary

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/organizations/{orgId}/invitations` | ✅ | Create & send invitation |
| `GET` | `/organizations/{orgId}/invitations` | ✅ | List invitations (manager) |
| `POST` | `/organizations/{orgId}/invitations/{id}/resend` | ✅ | Resend invitation |
| `POST` | `/organizations/{orgId}/invitations/{id}/revoke` | ✅ | Revoke invitation |
| `POST` | `/invitations/preview` | ❌ Public | Preview by token |
| `POST` | `/invitations/accept` | ✅ | Accept by token (from email link) |
| `GET` | `/me/invitations` | ✅ | List my invitations |
| `POST` | `/me/invitations/{id}/accept` | ✅ | Accept from dashboard inbox |
| `DELETE` | `/me/invitations/{id}` | ✅ | Decline from dashboard inbox |

---

## 9. File Structure

```
apps/server/src/api/modules/organization-invitation/
├── SPEC.md                                   ← this file
├── deps.ts                                   ← singleton composition (DI wiring)
├── index.ts                                  ← public barrel (only file other modules import)
├── invitation.notifier.ts                    ← InvitationNotifier adapter (uses messaging module)
├── organization-invitation.error-map.ts      ← full Code → ErrorMeta map (all codes)
├── organization-invitation.errors.ts         ← re-exports ErrorCode + HTTP map
├── organization-invitation.mapper.ts         ← row → DTO converters
├── organization-invitation.repository.ts     ← Drizzle queries
├── organization-invitation.service.ts        ← business logic (closure factory)
├── organization-invitation.service.spec.ts   ← Vitest unit tests (service)
├── organization-invitation.types.ts          ← service/repo types + port interfaces
├── testing.ts                                ← test helpers / factories
├── user-directory.adapter.ts                 ← UserDirectory port impl (reads verified contacts)
├── hono-routes/
│   ├── _shared.ts                            ← jsonOk / jsonError / honoPath helpers
│   ├── module-routes.types.ts                ← RouteDeps interface
│   ├── index.ts                              ← router aggregator + singletons
│   ├── create-organization-invitation.route.ts
│   ├── organization-invitation-list.route.ts
│   ├── resend-organization-invitation.route.ts
│   ├── revoke-organization-invitation.route.ts
│   ├── preview-organization-invitation.route.ts
│   ├── accept-organization-invitation.route.ts
│   ├── my-invitation-list.route.ts
│   ├── accept-my-invitation.route.ts
│   └── decline-my-invitation.route.ts
└── __tests__/
    ├── create-invitation.route.test.ts
    ├── organization-invitation-list.route.test.ts
    ├── resend-organization-invitation.route.test.ts
    ├── revoke-organization-invitation.route.test.ts
    ├── preview-invitation.route.test.ts
    ├── accept-invitation.route.test.ts
    ├── accept-my-invitation.route.test.ts
    ├── decline-my-invitation.route.test.ts
    └── my-invitation-list.route.test.ts
```

---

## 10. Dependency Rules

- **Only `index.ts`** is imported by other modules. Never import internal paths.
- The service **never imports a repository directly** — it receives `repo` via constructor injection in `OrganizationInvitationServiceDeps`.
- The service depends on **service interfaces** (`OrganizationUserService`, `RoleService`) from their respective `index.ts` files.
- `organization-invitation.mapper.ts` imports `OrganizationSummary` from `./organization-invitation.types.js` — never from other modules.
- `deps.ts` wires all concrete implementations; it is the only file that knows about `db`, `config`, and other module singletons.

---

## 11. Constants

| Constant | Value | File |
|---|---|---|
| `INVITATION_TTL_DAYS` | 7 | `organization-invitation.service.ts` |
| `RESEND_COOLDOWN_MS` | 60 000 ms | `organization-invitation.service.ts` |
| `MAX_SEND_COUNT` | 5 | `organization-invitation.service.ts` |
| `INVITATION_IDENTIFIER_MAX_LENGTH` | (see constants.ts) | `@avuny/contracts` |
| `INVITATION_TOKEN_MIN_LENGTH` | (see constants.ts) | `@avuny/contracts` |
| `INVITATION_TOKEN_MAX_LENGTH` | (see constants.ts) | `@avuny/contracts` |

---

## 12. Permissions

| Action | Permission Key |
|---|---|
| Create invitation | `create:organization-invitation` |
| Read invitation list | `read:organization-invitation` |
| Resend / Revoke | `update:organization-invitation` |

Permissions are checked via `permissionChecker.check({ userId }, action, { orgId })` from the `role` module.

