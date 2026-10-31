---
name: contracts-module
description: Create or extend a shared contracts module in @avuny/contracts — constants, error codes, Zod schemas and DTOs, the index barrel, and en/ar locale files. Use this whenever the task adds a new domain, module or resource (e.g. "add a project module"), a new endpoint input/output shape, a new error code, or a new success message, even if the request only mentions the API or the web form. The contract always comes first.
---

# Contracts module

A contracts module is the single source of truth for one domain. API and web both import it. Build it **before** any route or UI.

## File layout (6 files)

```
packages/contracts/src/project/        ⚠ verify the base path
├── constants.ts      enums (as const), limits, patterns, audit events
├── errors.ts         error-code object + union type
├── schemas.ts        Zod input/DTO/list schemas + inferred types
├── index.ts          barrel
└── locales/
    ├── en.json       errors / labels / msgs
    └── ar.json       same keys, Arabic
```

## Step 1 — constants.ts

```ts
export const PROJECT_STATUSES = ["draft", "active", "archived"] as const

export const PROJECT_NAME_MIN_LENGTH = 2
export const PROJECT_NAME_MAX_LENGTH = 80
export const PROJECT_DESCRIPTION_MAX_LENGTH = 500
export const PROJECT_SEARCH_MAX_LENGTH = 100

export const PROJECT_DEFAULT_PAGE_SIZE = 20
export const PROJECT_MAX_PAGE_SIZE = 100

export const PROJECT_AUDIT_EVENTS = {
  CREATED: "project.created",
  UPDATED: "project.updated",
  DELETED: "project.deleted",
} as const
```

Real example to imitate: `organization-invitation/constants.ts` (statuses, channels, E.164 phone regex, token length bounds, audit events).

## Step 2 — errors.ts

Keys **equal** values, prefixed with the module in SCREAMING_SNAKE. Export a type with the same name as the const.

```ts
export const ProjectErrorCode = {
  PROJECT_NOT_FOUND: "PROJECT_NOT_FOUND",
  PROJECT_FORBIDDEN: "PROJECT_FORBIDDEN",
  PROJECT_NAME_TAKEN: "PROJECT_NAME_TAKEN",
  PROJECT_LIMIT_REACHED: "PROJECT_LIMIT_REACHED",
  PROJECT_ARCHIVED: "PROJECT_ARCHIVED",
} as const
export type ProjectErrorCode =
  (typeof ProjectErrorCode)[keyof typeof ProjectErrorCode]
```

Always include `<MODULE>_NOT_FOUND` and `<MODULE>_FORBIDDEN`. Add `_LIMIT_REACHED` when a plan limit applies.

## Step 3 — schemas.ts

```ts
import { z } from "@avuny/zod"            // never "zod"
import {
  PROJECT_DEFAULT_PAGE_SIZE, PROJECT_DESCRIPTION_MAX_LENGTH,
  PROJECT_MAX_PAGE_SIZE, PROJECT_NAME_MAX_LENGTH, PROJECT_NAME_MIN_LENGTH,
  PROJECT_SEARCH_MAX_LENGTH, PROJECT_STATUSES,
} from "./constants.js"                   // note the .js

export const ProjectStatusSchema = z.enum(PROJECT_STATUSES)

const ProjectNameSchema = z.string().trim()
  .min(PROJECT_NAME_MIN_LENGTH).max(PROJECT_NAME_MAX_LENGTH)
const ProjectDescriptionSchema = z.string().trim().max(PROJECT_DESCRIPTION_MAX_LENGTH)

/* ---------- inputs ---------- */
export const CreateProjectSchema = z.object({
  name: ProjectNameSchema,
  description: ProjectDescriptionSchema.nullish(),
})
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>

/** All optional; at least one must be sent. */
export const UpdateProjectSchema = z
  .object({
    name: ProjectNameSchema.optional(),
    description: ProjectDescriptionSchema.nullish(),
    status: ProjectStatusSchema.optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: "Send at least one field to update",
  })
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>

/* ---------- DTOs ---------- */
export const ProjectDtoSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  status: ProjectStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type ProjectDto = z.infer<typeof ProjectDtoSchema>

/** List rows are lighter than the detail DTO. */
export const ProjectListItemDtoSchema = ProjectDtoSchema.omit({ description: true })
  .extend({ memberCount: z.number().int() })
export type ProjectListItemDto = z.infer<typeof ProjectListItemDtoSchema>

/* ---------- list ---------- */
export const ProjectOffsetListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(PROJECT_MAX_PAGE_SIZE)
    .default(PROJECT_DEFAULT_PAGE_SIZE),
  status: ProjectStatusSchema.optional(),
  search: z.string().trim().min(1).max(PROJECT_SEARCH_MAX_LENGTH).optional(),
})
export type ProjectOffsetListQuery = z.infer<typeof ProjectOffsetListQuerySchema>

export const ProjectOffsetListResponseSchema = z.object({
  items: z.array(ProjectListItemDtoSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
})
export type ProjectOffsetListResponse = z.infer<typeof ProjectOffsetListResponseSchema>

export const DeleteProjectResponseSchema = z.object({ id: z.string().uuid() })
```

Cross-field rule? Use `superRefine` (see `CreateOrganizationInvitationSchema`: "email OR phone OR existing user"):

```ts
.superRefine((v, ctx) => {
  if (v.channel === "email" && !v.email && !v.inviteeUserId)
    ctx.addIssue({ code: "custom", path: ["email"], message: "…" })
})
```

## Step 4 — index.ts

```ts
export * from "./constants.js"
export * from "./errors.js"
export * from "./schemas.js"
```

Then export the module from the package root barrel if there is one ⚠.

## Step 5 — locales

Same key set in both files. Three groups: `errors` (one per code), `labels` (enum/UI vocabulary), `msgs` (success messages, SCREAMING_SNAKE). See `.agents/skills/locales/SKILL.md` for the full table and the parity script.

```json
// en.json
{
  "errors": {
    "PROJECT_NOT_FOUND": "Project not found.",
    "PROJECT_FORBIDDEN": "You are not allowed to manage projects in this organization.",
    "PROJECT_NAME_TAKEN": "A project with this name already exists.",
    "PROJECT_LIMIT_REACHED": "Your plan's project limit has been reached.",
    "PROJECT_ARCHIVED": "This project is archived."
  },
  "labels": { "draft": "Draft", "active": "Active", "archived": "Archived" },
  "msgs": {
    "PROJECT_CREATED": "Project created.",
    "PROJECTS_LISTED": "Projects retrieved successfully.",
    "PROJECT_UPDATED": "Project updated.",
    "PROJECT_DELETED": "Project deleted."
  }
}
```

## Checklist before moving on

- [ ] Every code in `errors.ts` has `errors.<CODE>` in **en and ar**
- [ ] No secret/hash field in any DTO
- [ ] Update schema can't be sent empty; arrays documented as "replaces"
- [ ] `index.ts` exports all three files
- [ ] `z` imported from `@avuny/zod`; relative imports end in `.js`
- [ ] Contracts package builds (`<pnpm --filter @avuny/contracts build>` ⚠)

Next: `.agents/skills/api-hono-routes/SKILL.md`.
