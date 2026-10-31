---
name: locales
description: Add or change translated strings — contracts locale files (errors, labels, msgs) and web UI strings in the same i18next namespace — in English and Arabic with identical keys, RTL-safe. Use whenever a task adds an error code, success message, enum label, table/form/dialog text, permission label, or any user-visible string, or touches en.json / ar.json / useTranslation, even if the user just says "add the text" or "translate it".
---

# Locales (en + ar)

## Two places, one namespace

| Where | Holds | Used by |
|---|---|---|
| `packages/contracts/src/<module>/locales/{en,ar}.json` ⚠ | `errors.<CODE>`, `labels.*`, `msgs.<MESSAGE_CODE>` | server (`trans({ lang })` + `handleResult`) **and** web (labels) |
| Web UI strings ⚠ confirm location | `list.*`, `create.*`, `update.*`, `details.*`, `table.*`, `fields.*`, `actions.*`, `empty.*`, `pagination.*`, `delete.*`, `type.*` | web containers via `useTranslation("<ns>")` |

The web reads both through one namespace (`useTranslation("role")` reads `labels.resources.*` from the contracts locale and `list.title` from the UI strings). Keep the namespace equal to the module's `moduleName` in `handleResult`.

## Contracts locale shape

```json
{
  "errors": { "PROJECT_NOT_FOUND": "Project not found." },
  "labels": { "draft": "Draft", "active": "Active", "archived": "Archived" },
  "msgs":   { "PROJECT_CREATED": "Project created." }
}
```

- `errors` — **exactly** one key per code in `errors.ts`. Sentence case, ends with a period, no technical words ("plan's limit reached", not "quota exceeded").
- `msgs` — SCREAMING_SNAKE success/info messages the service returns (`INVITATION_RESENT_DELIVERY_FAILED`).
- `labels` — vocabulary shared by UI: enum values (`pending`), channels (`email`, `whatsapp`), and for permission-aware modules `labels.resources.<res>`, `labels.actions.<act>` (include `"*"`), `labels.effects.<allow|deny>`, `labels.systemRoles.<name>`.

## Web UI string map (the keys the role-module containers use)

```json
{
  "actions":  { "create": "New project", "edit": "Edit", "view": "View", "delete": "Delete", "cancel": "Cancel" },
  "create":   { "title": "Create project", "description": "…", "submitLabel": "Create", "submittingLabel": "Creating…" },
  "update":   { "title": "Edit project",   "description": "…", "submitLabel": "Save",   "submittingLabel": "Saving…" },
  "fields": {
    "name":        { "label": "Name",        "placeholder": "e.g. Website redesign" },
    "description": { "label": "Description", "placeholder": "Optional" }
  },
  "list": {
    "title": "Projects", "description": "…",
    "tabs":   { "aria": "Filter by status", "all": "All", "draft": "Draft", "active": "Active", "archived": "Archived" },
    "search": { "placeholder": "Search projects", "clear": "Clear search" }
  },
  "table":  { "name": "Name", "status": "Status", "members": "Members", "actions": "Actions", "actionsFor": "Actions for {{name}}" },
  "empty":  { "title": "No projects yet", "description": "Create your first project." },
  "pagination": {
    "nav": "Pagination", "previous": "Previous", "next": "Next", "rowsPerPage": "Rows per page",
    "summary": "{{from}}–{{to}} of {{total}}", "pageOf": "Page {{page}} of {{pageCount}}", "goTo": "Go to page {{page}}"
  },
  "delete":  { "title": "Delete project?", "description": "“{{name}}” will be permanently deleted." },
  "details": { "back": "Back to projects", "createdAt": "Created", "updatedAt": "Updated" }
}
```

i18next interpolation is `{{name}}`. Plurals: pass `count` and add `_one`/`_other` (Arabic needs `_zero/_one/_two/_few/_many/_other` — provide at least `_one` and `_other` and let the fallback handle the rest unless the text shows a count).

## How code uses them

```tsx
const { t, i18n } = useTranslation("project")
t("list.title")
t("delete.description", { name })
t(`list.tabs.${scope}`)                                    // dynamic keys OK when the set is closed
t(`labels.${status}`, { defaultValue: status })            // open sets: always defaultValue
new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }).format(date)
```

Server messages are already localized: show `parseApiError(e).message`, never map codes in the web.

## Arabic / RTL

- Translate meaning, not words; keep product nouns consistent with the existing `ar.json` (e.g. "المؤسسة" for organization, "الدعوة" for invitation).
- Do not put punctuation that depends on direction inside translated strings; keep numbers/placeholders as `{{x}}`.
- Layout: logical utilities only (`ps-/pe-/ms-/me-/start/end`), `rtl:rotate-180` on directional icons.

## Parity check (run before finishing)

```bash
node .agents/skills/locales/scripts/check-locale-parity.mjs packages/contracts/src/project/locales
```

Exit code 1 lists keys missing from either language. Also confirm every code in `errors.ts` has an `errors.<CODE>` key (the script checks this when you pass `--errors <path/to/errors.ts>`).

## Checklist

- [ ] en and ar have identical key sets
- [ ] Every error code has a message; every service `msg` code has an `msgs` entry
- [ ] No hard-coded strings in TSX (including placeholders and aria-labels)
- [ ] Interpolations use `{{name}}`, not string concatenation
- [ ] Checked the screen in Arabic (layout flips, no clipped text)
