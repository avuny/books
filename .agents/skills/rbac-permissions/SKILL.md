---
name: rbac-permissions
description: Add permissions for a new resource, extend system roles, check access in services, and show/hide web UI by permission, following the repo's IAM-style RBAC (allow/deny statements, wildcards, owner, canAccess, hasPermission, grantsAll). Use whenever a task introduces a new module that needs access control, adds a button or nav item that depends on a permission, creates or edits roles/system roles, or mentions permissions, canAccess, hasPermission, RBAC, or "who can do X".
---

# RBAC / permissions

Pure rules live in contracts `rbac.ts` (shared by server and web). System roles in `system-roles.ts`. Custom roles are rows (`roles`, `role_permissions`, `organization_user_roles`).

## Mental model (memorize)

- Statement: `{ effect: "allow" | "deny", resource, action, resourceId }`; `"*"` is a wildcard in each slot.
- **Deny beats allow. No matching statement = denied.**
- A statement scoped to a specific `resourceId` only matches checks for that id; a collection-level check (no id) needs `"*"`.
- `EffectivePermissions`: `owner` (full), `none` (portal users, ex-members, strangers), `member` (statements).

```ts
evaluate([allow("*","*"), deny("organization","delete")], { resource: "organization", action: "delete" }) // false
evaluate([allow("*","read")], { resource: "project", action: "read" })                                      // true
evaluate([allow("project","read")], { resource: "project", action: "read", resourceId: "abc" })             // true  (wildcard id)
evaluate([{ ...allow("project","read"), resourceId: "abc" }], { resource: "project", action: "read" })      // false (collection check)
```

## Permission keys

`"<action>:<resource>"`, kebab-case, parsed to snake_case resource: `"update:organization-user"` → `{ action: "update", resource: "organization_user" }`. Malformed keys **throw** on purpose.

Standard actions per resource: `create`, `read`, `update`, `delete` (+ domain verbs like `archive`).

## Adding a new resource (`project`) — 5 steps

1. **Catalog** — register `project` with its actions (`create/read/update/delete[/archive]`) wherever the permission catalog is built ⚠ (the `getPermissionCatalog` endpoint's source). `scopable: true` only if per-record statements make sense.
2. **System roles** — edit `SYSTEM_ROLES` in `system-roles.ts`:

```ts
{
  name: "Team manager",
  description: "Manages members, invitations and projects; can view roles and the organization.",
  statements: [
    allow("organization", "read"),
    allow("organization_user", "*"),
    allow("organization_invitation", "*"),
    allow("project", "*"),                 // ← new
    allow("role", "read"),
  ],
},
```
   `Administrator` (`allow("*","*")`) and `Viewer` (`allow("*","read")`) already cover it. Then run `<pnpm seed:roles>` ⚠ — it syncs system roles; removing a role from the array never deletes it from the DB; **never rename** a system role (name = identity).
3. **Service check** (server enforces):

```ts
if (!(await canAccess(actorId, "create:project", orgId)))
  return fail({ error: Code.PROJECT_FORBIDDEN })
// then plan limits → business rules → write
```
4. **Web abilities** (UI only): `useProjectAbilities` in `project-api.ts` (see `web-feature-module/references/templates-api-and-types.md`) using `hasPermission(snapshot, "create:project")`.
5. **Labels** — add to **both** locales: `labels.resources.project`, and any new `labels.actions.<verb>`. Without them the role editor shows the raw token.

## Role management safety

- Creating/updating a role: `grantsAll(actor, role.statements)` must hold, otherwise it's privilege escalation → `ROLE_FORBIDDEN`-style error.
- System roles are read-only on the server; the web hides edit/delete for `isSystem`.
- A role still assigned to members can't be deleted (web disables the action; server returns the error code).
- The role picker UI only handles plain `allow <action> on <resource> *`; wildcards/denies/scoped statements are preserved untouched (`isPickableStatement`, `countHiddenStatements`). Don't "clean up" statements you can't display.

## Web gating examples

```tsx
const abilities = useProjectAbilities(orgId)
actions={abilities.canCreate ? <ProjectButton orgId={orgId} /> : null}      // hide create button
if (abilities.canDelete) actions.push({ id: "delete", … })                   // hide row action
```

For nav visibility call `hasPermission(snapshot, "read:project")` where the sidebar items are built ⚠.

## Open decision (don't pre-empt)

Permission checks currently run **inside the service**. A route-level `requireAccess(userId, orgId, "create", "invoice")` middleware has been proposed but not adopted. Keep using `canAccess` in services unless the maintainers decide otherwise.

## Checklist

- [ ] Resource + actions in the catalog
- [ ] `SYSTEM_ROLES` reviewed (and `seed:roles` run)
- [ ] Service checks `canAccess` first, returns `<MODULE>_FORBIDDEN`
- [ ] Web only hides UI; nothing relies on it for security
- [ ] `labels.resources.*` / `labels.actions.*` in en **and** ar
- [ ] Tests for any new pure RBAC helper (`rbac.test.ts` style)
