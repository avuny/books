# Rule: contracts

- Folder per module: `constants.ts`, `errors.ts`, `schemas.ts`, `index.ts`, `locales/en.json`, `locales/ar.json`.
- `constants.ts`: enums as `as const` arrays (`INVITATION_STATUSES`), numeric limits (`*_MAX_LENGTH`, `*_DEFAULT_PAGE_SIZE`), regex (`*_PATTERN`), audit event names (`<MODULE>_AUDIT_EVENTS`). SCREAMING_SNAKE.
- `errors.ts`: object whose keys equal values, prefixed with the module (`ORGANIZATION_INVITATION_NOT_FOUND`), plus a derived union type with the **same name** as the const.
- `schemas.ts`: `XSchema` const + `XInput` / `XDto` type from `z.infer`. Inputs are verbs (`CreateRoleSchema`), outputs are `…DtoSchema`.
- Dates in DTOs: `z.string().datetime()`. IDs: `z.string().uuid()`. Never expose hashes/secrets (`tokenHash` stays server-side).
- Update schemas: all fields optional + `.refine` "send at least one field". A sent array **replaces** the stored set; say so in a doc comment.
- Lists are offset-paginated: query `{ page (coerce, ≥1, default 1), pageSize (coerce, ≤MAX, default), …filters }`; response `{ items, page, pageSize, total }`.
- Cross-field validation: `.superRefine` with `ctx.addIssue({ code: "custom", path: [...], message })`.
- ESM: relative imports end in `.js` (`from "./constants.js"`).
- Add new exports to the module `index.ts`, and (if the package has one) the package root barrel.
