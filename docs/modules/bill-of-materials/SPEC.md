# Bill of Materials: Implementation Specification

| | |
|---|---|
| Version | 1.0 · 2026-11-27 |
| Status | proposed |
| Owner | Product owner |
| Depends on | item and units, assembly-cost-type, role (permissions), activity-log. Read only: inventory (availability), inventory-costing (last actual cost) |

Docs only. Overview, open questions and build order: [`../assembly/README.md`](../assembly/README.md). Companions: [`PROGRESS.md`](./PROGRESS.md), [`TEST-PLAN.md`](./TEST-PLAN.md). The consuming document is [`../assembly-order/SPEC.md`](../assembly-order/SPEC.md).

Legend: **[CURRENT]** in code, **[PROPOSED]** recommended, **[OPEN]** undecided (README section 5).

## 0. Reading order for agents
`AGENTS.md` files, this file sections 1 to 3 and 9, section 13, then the phase in section 12. Resume from PROGRESS.md.

## 1. Goals and non-goals
Goals:
1. Store a reusable recipe: how much of which items (and which extra costs) make a given quantity of an output item.
2. Give fast answers: estimated cost, how many can be built from stock now, where an item is used.
3. Feed assembly orders by scaling. The BOM never moves stock or posts a journal.

Non-goals (v1): versions or effectivity dates, alternative components, routing or steps, by-products, approval. An assembly order can also be created with no BOM.

## 2. Domain model and boundaries
- `bills_of_materials`: one recipe header for one output item.
- `bom_lines`: component items with quantity, unit and scrap %.
- `bom_cost_lines`: extra cost (labor, machine, overhead, service) by cost type.
- A BOM is master data. It has no stock, no cost layers and no journal. Reads of stock and cost for the estimate and availability endpoints go through the existing services, never straight into their tables from the web.
- One output item can have several BOMs (for example two sizes of batch or two methods). At most one is the default (Q11).

## 3. Lifecycle and status model
No document lifecycle. A BOM is `is_active` true or false.

| Action | Rule |
|---|---|
| Create, update | Allowed any time. Does not change existing orders (they hold a snapshot). |
| Deactivate | Hides it from pickers. Existing orders keep their link. |
| Delete | Only if no order ever referenced it (`bom_id` on orders). Otherwise `BOM_IN_USE`, use deactivate. |
| Set default | Clears the previous default of the same output item in the same transaction. |

## 4. Business rules
- R1. `code` is required, 1 to 40 chars, uppercase letters, digits, dash and underscore, unique per organization (case-insensitive). `name` is required, max 120.
- R2. The output item must be active, inventory tracked and `can_assembled = true`.
- R3. Output quantity is positive (6 decimals), with a unit that belongs to the item (base or a defined conversion). The base quantity is stored.
- R4. At least one component line. At most 100 (`ASSEMBLY_MAX_COMPONENTS`, shared with orders).
- R5. A component item must be active and inventory tracked. Service items are rejected (Q7). The output item cannot be its own component.
- R6. One line per component item in a BOM (unlike orders there is no location here).
- R7. Component quantity is positive, unit belongs to the item. Scrap % is from 0 to 100 inclusive with up to 2 decimals (basis points in storage is fine). Scrap raises the quantity consumed: `consumed = line base qty x (1 + scrap / 100)`.
- R8. **No cycles.** A BOM may not (directly or through other active BOMs) need its own output item. On create, update and activate, walk the default BOM of every component item that is itself `can_assembled`, with a visited set and a depth limit of 10, and reject with `BOM_CYCLE`. Because several BOMs can exist per item, check every active BOM of each component item, not just the default.
- R9. At most one default BOM per output item (partial unique index on `(org_id, output_item_id)` where `is_default and is_active`). The first active BOM of an item becomes the default automatically.
- R10. Cost lines: cost type active, `amount_minor >= 0`, optional informational `quantity` and `rate_minor` (amount must equal their product rounded half up when both are present), `scales_with_qty` boolean (default true). At most 20 lines. The amounts are in the organization currency.
- R11. Components that are themselves assembled items are allowed (multi level). Each level needs its own posted assembly order. The BOM does not explode automatically in v1. The order form can warn when a component has stock shortage but a BOM exists ("build it first").
- R12. Deactivating an item or turning off `can_assembled` is blocked while an active BOM uses the item as output (`ITEM_HAS_ACTIVE_BOM`). Deactivating a component item is allowed but marks lines as "inactive item" in the UI, and the order create blocks them.
- R13. Every table row carries `org_id`, with composite FKs.

## 5. Database design
Money `bigint` minor units, quantities `quantity()`, org id on every row. Next free migration number after `0029`, shared with the other assembly modules (one migration per PR as the repo does).

```text
bills_of_materials
- code                       text, unique (org_id, lower(code))
- name                       text
- output_item_id             FK (org_id, item_id) restrict
- output_unit_id, output_qty, output_conversion_factor_snapshot, output_base_qty
- is_default                 boolean
- is_active                  boolean, default true
- notes                      text, max 500
- created_by, updated_by

bom_lines
- bom_id, line_no
- item_id                    FK (org_id, item_id) restrict
- unit_id, qty, conversion_factor_snapshot, base_qty
- scrap_percent              numeric(5,2), 0 to 100 check
- notes
- unique (bom_id, item_id)

bom_cost_lines
- bom_id, line_no
- cost_type_id               FK (org_id, id) restrict
- description                nullable
- quantity, rate_minor       nullable, informational
- amount_minor               bigint >= 0
- scales_with_qty            boolean default true
```

Indexes: `(org_id, output_item_id)`, `(org_id, item_id)` on lines (where used), partial unique default index (R9), `(org_id, is_active)`. Lines cascade on BOM delete (only possible when never referenced).

The conversion factor is snapshotted so a later unit change does not rewrite the recipe. Base quantities are what orders scale.

## 6. Contracts and API
`packages/contracts/src/bill-of-materials/` (constants, errors, schemas, rules, locales en and ar). Server module `modules/bill-of-materials/` with the same layers as `inventory-transfer`.

| Method and path | Permission | Notes |
|---|---|---|
| `POST /boms` | create | Header, lines, cost lines. |
| `GET /boms` | read | Offset list. Filters: output item, active, search by code or name. |
| `GET /boms/:id` | read | Detail. |
| `PATCH /boms/:id` | update | Replace lines and cost lines as a set. |
| `DELETE /boms/:id` | delete | the delete rule in section 3. |
| `POST /boms/:id/activate`, `/deactivate`, `/set-default` | update | Cycle check on activate. |
| `GET /boms/:id/estimate?qty=&unitId=` | read | Scaled lines with item `costPrice` and the last actual layer cost where known. Total labeled "estimate". |
| `GET /boms/:id/availability?warehouseId=` | read | Max buildable quantity from stock available now: min over lines of floor(available / needed per output unit). Names the limiting item. |
| `GET /items/:id/boms` and `GET /items/:id/used-in` | read | Panels on item details. |

Errors: `BOM_NOT_FOUND`, `BOM_CODE_TAKEN`, `BOM_OUTPUT_ITEM_INVALID`, `BOM_COMPONENT_INVALID`, `BOM_COMPONENT_DUPLICATE`, `BOM_SELF_COMPONENT`, `BOM_CYCLE`, `BOM_TOO_MANY_LINES`, `BOM_NO_LINES`, `BOM_COST_TYPE_INVALID`, `BOM_SCRAP_INVALID`, `BOM_IN_USE`, `ITEM_HAS_ACTIVE_BOM`. Each has an en and ar locale key.

The estimate uses item default cost price and is clearly not the posted cost. The real cost comes only from posting (assembly order SPEC R16).

## 7. UI
Feature `apps/web/src/features/bill-of-materials-module/` (form architecture in `docs/FORMS.md`, copy in `docs/COPY.md`).
- List: code, name, output item, output quantity, line count, estimate, default badge, active.
- Form: header, component grid (item, quantity, unit, scrap %, notes), cost grid (type, description, quantity, rate, amount, scales with quantity). Live estimate panel.
- Detail: lines, estimate, availability for a chosen warehouse, "Create assembly order" action (opens the order form with the BOM and quantity).
- Item details: "Bills of materials" and "Used in" panels (read only).
- Empty, loading, error states; cycle error shows the chain of items; RTL and Arabic parity.

## 8. Permissions
Resource `bill_of_materials` in the registry: CRUD plus `activate`, `deactivate` (or covered by update, decide in phase 0). Sidebar group `inventory`, path `/boms`, en "Bills of materials", ar "قوائم المواد". Role defaults per Q14. Audit: `bill_of_materials.created`, `.updated`, `.deleted`, `.activated`, `.deactivated`, `.default_set`.

## 9. Accounting and inventory effects
None. No stock movement, cost layer or journal. Reads: availability uses `inventory_items` on hand minus reserved through the inventory read port, so the number matches what a post would accept. The estimate reads item cost prices and layer costs through ports.

## 10. Reporting
BOM list with estimate, where used, items with `can_assembled` and no BOM, BOMs whose component is inactive.

## 11. Acceptance criteria
1. AC1. Create, update, deactivate, delete follow R1 to R13 and section 3.
2. AC2. Cycles are rejected at any depth (A uses B uses A, and A uses B uses C uses A), including through a non default active BOM.
3. AC3. One default per output item, switching default is atomic.
4. AC4. Service items and inactive items are rejected as components or outputs.
5. AC5. Estimate scales by quantity and scrap and rounds as the order does (half up, 6 decimals).
6. AC6. Availability returns the correct limiting item and quantity, never negative.
7. AC7. A referenced BOM cannot be deleted, only deactivated.
8. AC8. Editing a BOM does not change an existing order.
9. AC9. Tenant isolation and permission matrix.
10. AC10. Locales en and ar parity.

## 12. Implementation tasks
See PROGRESS.md. Order: phase 0 checks, phase 3 (after the cost type module): contracts and schema, repository and service, estimate and availability, routes, web.

## 13. Repository checks before implementation
### 13.1 Done in this analysis
| Check | Result |
|---|---|
| `items.can_assembled` | Exists and is already on the item form and details. |
| Item unit conversions | Items have base unit and conversion definitions; orders and transfers snapshot the factor. |
| Registry shape | `modules/registry.ts` defines resources, actions, sidebar group and path. |

### 13.2 To verify in phase 0
1. How the item module exposes unit conversion helpers to other modules (reuse, do not copy).
2. Whether code uniqueness elsewhere uses `lower(code)` indexes (match the pattern).
3. The read port for availability (on hand minus reserved) and whether reserved is always zero today.
4. How the item module blocks flag changes, to add R12 without duplicating logic.
5. Role defaults file for new resources.

## 14. Decisions to preserve
- No versions. Orders snapshot BOM lines (Q11).
- BOM never touches stock, cost or journal.
- Cycle check over all active BOMs of component items.
- Estimates are labeled as estimates, real cost comes from posting.
