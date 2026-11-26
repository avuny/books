# Rule: RBAC

- Permission key = `"<action>:<resource>"` in kebab-case: `read:organization-user`. It is parsed to snake_case resource (`organization_user`). A malformed key **throws** — fix the typo, don't catch it.
- Statement = effect (`allow|deny`) + resource + action + resourceId; `*` is a wildcard for each. **Deny beats allow; no match = deny.** A statement scoped to one `resourceId` only matches checks for that id; collection checks need `*`.
- Owner: implicit full access. Portal users / non-members: none.
- Server: check in the service first (`canAccess(actorId, "create:project", orgId)`), then plan limits, then business rules. Return `fail({ error: <MODULE>_FORBIDDEN })`.
- Escalation guard: anyone who creates/edits a role must satisfy `grantsAll(actor, role.statements)`.
- Web: `useXAbilities` → `hasPermission(snapshot, key)`; only for show/hide.
- New resource ⇒ add to the permission catalog, to the relevant `SYSTEM_ROLES` entries, and add `labels.resources.<resource>` + `labels.actions.<action>` to **both** locales.
- System role `name` is a stable identity key (renaming creates a new role). Role names are translated via `labels.systemRoles.<name>`.
