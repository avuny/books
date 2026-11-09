# Item Category Module: Specification

> **Update this file** whenever a requirement changes: a new error code, a new route, a policy change, or anything else that alters observable behavior.

## 1. Purpose

A per-organization tree of item categories (adjacency list: `parent_id`). Every item belongs to exactly one category.

## 2. Domain model

`item_categories`: `id`, `org_id`, `parent_id` (null = root), `name`, `description`, `is_active`. Composite self-FK keeps a parent in the same organization. Sibling names are unique case-insensitively (two partial unique indexes: roots and non-roots). RESTRICT on the parent FK and on `items.category_id`.

## 3. Business rules (all in `item-category.rules.ts`, pure)

- The parent must exist (`ITEM_CATEGORY_PARENT_NOT_FOUND`).
- No cycles: a category cannot move under itself or a descendant (`ITEM_CATEGORY_CYCLE`).
- Depth: a root is depth 1, at most `ITEM_CATEGORY_MAX_DEPTH`. The moved subtree's height counts (`ITEM_CATEGORY_MAX_DEPTH_EXCEEDED`).
- Sibling names are unique, case-insensitively (`ITEM_CATEGORY_NAME_TAKEN`), checked under a per-organization advisory lock; the unique indexes catch any race.
- Only an unused leaf (no sub-categories, no items) can be deleted (`ITEM_CATEGORY_IN_USE`). Everything else is deactivated with `isActive: false`.
- `PATCH` sends only provided fields; `parentId: null` moves the category to the top level.

## 4. Routes (permission resource `item_category`, route keys `*:item-category`)

| Method | Path | Permission | Notes |
|---|---|---|---|
| GET | `/organizations/{orgId}/item-categories` | `read:item-category` | filters `search`, `isActive`, `parentId` (uuid or `root`); counts included |
| GET | `/organizations/{orgId}/item-categories/tree` | `read:item-category` | whole tree, flat; the client nests by `parentId` |
| GET | `/organizations/{orgId}/item-category-options` | `read:item-category` | picker: active categories, id + name, cursor paging |
| GET | `/organizations/{orgId}/item-categories/{categoryId}` | `read:item-category` | |
| POST | `/organizations/{orgId}/item-categories` | `create:item-category` | |
| PATCH | `/organizations/{orgId}/item-categories/{categoryId}` | `update:item-category` | |
| DELETE | `/organizations/{orgId}/item-categories/{categoryId}` | `delete:item-category` | |

`/tree` is registered before `/{categoryId}`; keep that order.

## 5. Error codes

| Code | HTTP | Description |
|---|---|---|
| `ITEM_CATEGORY_NOT_FOUND` | 404 | Category missing or in another organization |
| `ITEM_CATEGORY_PARENT_NOT_FOUND` | 422 | The chosen parent does not exist |
| `ITEM_CATEGORY_NAME_TAKEN` | 409 | A sibling already has this name |
| `ITEM_CATEGORY_CYCLE` | 422 | Move under itself or a descendant |
| `ITEM_CATEGORY_MAX_DEPTH_EXCEEDED` | 422 | Nesting deeper than the maximum |
| `ITEM_CATEGORY_IN_USE` | 409 | Has sub-categories or items |

## 6. Files

```
item-category/
├── SPEC.md
├── deps.ts
├── index.ts
├── testing.ts
├── item-category.errors.ts
├── item-category.error-map.ts
├── item-category.mapper.ts
├── item-category.repository.ts
├── item-category.rules.ts          # PURE tree rules injected into the service
├── item-category.service.ts        # orchestration only
├── item-category.types.ts
├── item-category.rules.spec.ts
├── item-category.service.spec.ts
├── hono-routes/
└── __tests__/item-category.routes.test.ts
```
