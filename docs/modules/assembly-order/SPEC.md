# Assembly Order: Implementation Specification

| | |
|---|---|
| Version | 1.0 · 2026-11-27 |
| Status | proposed |
| Owner | Product owner |
| Depends on | item and units, warehouse and warehouse-location (PRODUCTION system location), batch, stock-movement, inventory-costing, accounting, assembly-cost-type, bill-of-materials (optional link), role (permissions), activity-log |

Docs only. Base: `main` at `51bf727`. Overview, open questions and build order: [`../assembly/README.md`](../assembly/README.md). Companions: [`PROGRESS.md`](./PROGRESS.md), [`TEST-PLAN.md`](./TEST-PLAN.md). Section 13 holds the repository evidence.

Legend: **[CURRENT]** exists in code, **[PROPOSED]** recommended, **[OPEN]** undecided (README section 5, Q numbers).

## 0. Reading order for agents

`AGENTS.md` files, then this file sections 1 to 3 and 9, then section 13, then the section for the current phase (section 12). Resume from PROGRESS.md.

## 1. Goals and non-goals

Goals:

1. Build one output item from existing stock items in one posted step: consume components, produce the output, roll up the real cost, keep batches traceable.
2. Support the simple case (an ad hoc order with no BOM, for example item A into bag B) and the repeatable case (an order scaled from a BOM).
3. Add non-stock cost (labor, machine, overhead, service) to the output cost through cost types.
4. Keep one ledger (stock movements), one costing model (layers) and one journal path (accounting service). No parallel balances.
5. Be safe to retry, safe under concurrency, and reversible while the output is untouched.

Non-goals (v1):

- No WIP, partial completion, scrap or by-products (README section 9).
- No disassembly, serial numbers, standard costing or variance accounts.
- No reservations (none exist yet) and no approval flow.
- No cross-warehouse components (Q5) and no purchasing of missing parts.

## 2. Domain model and boundaries

### 2.1 Entities

`assembly_orders` (document) has `assembly_order_components` (what to consume), `assembly_order_outputs` (what to produce, exactly one row in v1) and `assembly_order_cost_lines` (additional cost). Posting writes `assembly_order_consumptions` (one row per component batch and location actually consumed, with its cost) and fills result columns on the output row.

### 2.2 Reuse as is

| Existing piece | Used for |
|---|---|
| `stock_movements` and `stock_movement_lines` (types `assembly_consume`, `assembly_produce`) | The physical ledger. |
| `inventory_cost_layers` and `inventory_cost_allocations` | Cost of consumed components and the new output layer. |
| `batches`, `ensureBatches` | Output batch creation. |
| `postBusinessEvent` (new event, README section 7) | Journal for additional cost. |
| `items.can_assembled` | Output item gate. |

### 2.3 What this module owns and must not touch

Owns: the document, its lines, the consumption records, the link to its two movements and to its journal.

Must not: write `inventory_items`, `inventory_item_batches` or `batches` rows directly, create or change cost layers except through the costing service, or write journal rows except through the accounting service. UI code never calls the stock engine.

### 2.4 Two movements, one document

The engine allows one movement type and one `(source_type, source_id)` per posting. An assembly posts two movements in one transaction:

| Movement | type | source_type | source_id | From | To |
|---|---|---|---|---|---|
| Consume | `assembly_consume` | `assembly_order_consume` | order id | component locations (intent issue) | PRODUCTION (system) |
| Produce | `assembly_produce` | `assembly_order_produce` | order id | PRODUCTION (system) | output location (intent receive) |

Both source types fit the 40 character, lowercase rule. Because PRODUCTION holds no balance, the value that leaves the components is carried to the output layer in code inside the same transaction. That is why v1 cannot be split across requests.

## 3. Lifecycle and status model

```ts
export const ASSEMBLY_ORDER_STATUSES = ["DRAFT", "POSTED", "REVERSED", "CANCELLED"] as const
```

| From | Action | To | Stock | Cost layers | Journal |
|---|---|---|---|---|---|
| (new) | create | DRAFT | none | none | none |
| DRAFT | update, delete | DRAFT, gone | none | none | none |
| DRAFT | cancel | CANCELLED | none | none | none |
| DRAFT | post | POSTED | consume and produce movements | components consumed, output layer created | additional cost only |
| POSTED | reverse | REVERSED | both movements reversed | allocations restored, output layer consumed | reversed |

Triggers: users with the matching permission (section 8). No system trigger. A reversed order stays visible and cannot be reposted; the user creates a new order (copy action in the UI).

## 4. Business rules

Tests reference these ids.

**Output and components**

- R1. The output item must be active, `can_assembled = true` and `is_inventory_tracked = true`.
- R2. Every component item must be active and `is_inventory_tracked = true`. Service items are rejected (Q7).
- R3. The output item cannot be a component of the same order. Two component lines may not share `(item, location)`.
- R4. v1 has exactly one output row. The schema allows more so a later rule change needs no migration.
- R5. Output quantity and component quantities are positive and fit 12 integer and 6 decimal digits. Stored in the entered unit with a conversion snapshot, and in base units (`base_qty`). Stock quantities are always base units.
- R6. At most `ASSEMBLY_MAX_COMPONENTS` (100) component lines. Batch expansion can still produce more movement lines; the total must stay under `STOCK_MOVEMENT_MAX_LINES` (1000) or the post fails with `ASSEMBLY_TOO_MANY_LINES`.
- R7. One warehouse per order. Every component location and the output location belong to it, are active and stockable. The engine also checks pickable and receivable (intents issue and receive). (Q5)

**Scaling from a BOM**

- R8. Creating from a BOM copies its lines into the order as a snapshot and keeps `bom_id` for reporting. Later BOM edits never change the order.
- R9. Scale factor = output base qty of the order / output base qty of the BOM. Component base qty = BOM line base qty x factor x (1 + scrap % / 100), rounded half up to 6 decimals per line (bigint math, no floating point). `planned_base_qty` keeps this value. The user may edit `base_qty` in a draft. `planned_base_qty` is never edited.
- R10. Cost lines with `scales_with_qty = true` are multiplied by the same factor and rounded half up to whole minor units. Others are copied as is.

**Availability and batches**

- R11. Before posting the service checks `on_hand - reserved >= required` per `(item, location, batch)`. The check applies even when the item allows negative stock. Assembly never creates negative stock (cost cannot be allocated to it).
- R12. The service, not the engine, picks the component batches (README finding 5). Rule: FEFO for expiry-tracked items, FIFO otherwise, same as the engine's `allocateBatches`, only batches with status `available`. A line with a user-chosen batch uses it. Each result row becomes one consumption record and one movement line with an explicit batch id.
- R13. A batch-tracked output needs a batch. The user may type a batch number; otherwise `ASM-<order number>` is used. The batch is created or reused through `ensureBatches` with `manufactured_on` = assembly date.
- R14. For an expiry-tracked output: `expires_on` = manufactured date + the item's default shelf life (`item_expiry_settings`), capped by the earliest `expires_on` among consumed expiry-tracked component batches. The user may enter an earlier date, never a later one (`ASSEMBLY_OUTPUT_EXPIRY_AFTER_COMPONENT`). No shelf life and no date: `ASSEMBLY_OUTPUT_EXPIRY_REQUIRED`. (Q6)
- R15. A non-batch-tracked output gets no batch.

**Cost**

- R16. Component cost is the real value taken from cost layers (`consumeFifo`), never the item's default cost price. Both valuation methods use the layers in v1 (Q3).
- R17. If the layers do not cover the full required quantity of any component, the post fails with `ASSEMBLY_COMPONENT_UNCOSTED` before any write. Nothing is estimated. (Q2)
- R18. All consumed layers and the order use one currency (the organization currency). Otherwise `ASSEMBLY_CURRENCY_MISMATCH`.
- R19. Total cost = sum of consumed allocation values + sum of cost line amounts (integer minor units). The output layer receives exactly this total as `received_value`. No value is lost or created by rounding. Cost per unit is a derived display value only.
- R20. A zero total cost is allowed and shows a warning in the UI.
- R21. Cost lines: the cost type must be active; `amount_minor >= 0`; optional `quantity` and `rate_minor` are informational (for example 3 hours x 5.00) and, when both are present, `amount_minor` must equal their product rounded half up. At most `ASSEMBLY_MAX_COST_LINES` (20).

**Posting**

- R22. Post runs in one database transaction. Steps in section 9.2. Everything that can fail on validation fails before the first write.
- R23. The order row is locked `FOR UPDATE` first, then status is checked. Post on a non-DRAFT order returns `ASSEMBLY_ORDER_NOT_DRAFT` (409) and changes nothing. The unique source index on stock movements is the second guard.
- R24. The assembly date (date only, organization local) is today or earlier and inside an open accounting period (`ASSEMBLY_PERIOD_CLOSED`). Movement `posted_at` is the posting time. (Q10)
- R25. The journal is posted only when the additional cost total is above zero. If the accounting service fails, the whole post fails (`ASSEMBLY_JOURNAL_FAILED`). The failure is never ignored (see the adjustment finding, README section 3).
- R26. The order stores `consume_movement_id`, `produce_movement_id` and `journal_entry_id` (nullable) after a successful post.

**Reversal and cancel**

- R27. Only POSTED orders can be reversed, once.
- R28. Reversal is allowed only if the full produced quantity is still on hand at the output location and batch and the output cost layer has `remaining_qty = received_qty` (`ASSEMBLY_OUTPUT_ALREADY_USED` otherwise). (Q9)
- R29. Reversal order: reverse the produce movement, consume the output layer, reverse the consume movement, restore the component allocations on their original layers (`restoreAllocationsOfLine`), reverse the journal with `reverseJournalEntry`. One transaction.
- R30. Cancel and edit and delete are DRAFT only.

**General**

- R31. Every table row carries `org_id`; composite FKs keep item, location, batch and warehouse in the same organization.
- R32. Order numbers are `ASM-` plus six digits, unique per organization, allocated under an advisory lock as the transfer module does. Do not copy the `count + 1` pattern.
- R33. Audit events are written after commit (section 8).
- R35. Extensibility hooks (staged production, see [`../assembly/STAGED-PRODUCTION.md`](../assembly/STAGED-PRODUCTION.md) section 7): the service is built from internal `issue`, `addCost` and `finish` operations that `post` composes in one transaction; the PRODUCTION location is resolved in one function; status transitions live in one table driven function; reports and trace read consumption and output rows, not movements by order id. Only `SINGLE_STEP` is accepted in v1.
- R34. An item that has a POSTED assembly keeps the existing lock on base unit, tracking flags and valuation method (already enforced once a movement exists). `can_assembled` cannot be turned off while an active BOM or a non-cancelled order references the item.

## 5. Database design

Money is `bigint` minor units (`money()`), quantities are `quantity()` (numeric, 6 decimals), conversion factors use `conversionFactor()`. Every table has `id`, `org_id` and `timestamps()`. Next migration: the next free number after `0029`.

### 5.1 Enums

`assembly_order_status` (`ASSEMBLY_ORDER_STATUSES`). The mapping key enum gets `ASSEMBLY_COST_ABSORBED` (README section 7).

### 5.2 Tables

```text
assembly_orders
- number                      text, ASM-######, unique (org_id, number)
- status                      assembly_order_status, default DRAFT
- mode                        text check in ('SINGLE_STEP'), default SINGLE_STEP; reserved for STAGED (see ../assembly/STAGED-PRODUCTION.md)
- warehouse_id                FK (org_id, warehouse_id) restrict
- assembly_date               date (org local)
- bom_id                      nullable FK (org_id, bom_id) restrict
- notes                       text, max 500
- currency                    char(3), set at post
- material_cost_minor         bigint, null until posted
- additional_cost_minor       bigint, null until posted
- total_cost_minor            bigint, null until posted
- consume_movement_id         nullable FK (org_id, id) restrict
- produce_movement_id         nullable FK (org_id, id) restrict
- journal_entry_id            nullable FK restrict
- posted_at, posted_by, reversed_at, reversed_by, cancelled_at, created_by

assembly_order_components            (planned, editable in DRAFT)
- assembly_order_id, line_no
- item_id                     FK (org_id, item_id)
- from_location_id            FK (org_id, warehouse_id, location_id) via warehouse_locations
- batch_id                    nullable, FK (org_id, item_id, batch_id); null = auto FEFO or FIFO
- unit_id, qty, conversion_factor_snapshot, base_qty
- planned_base_qty            what the BOM scaling produced (null for ad hoc lines)
- bom_line_id                 nullable, informational
- notes
- unique (assembly_order_id, item_id, from_location_id, batch_id) with batch_id null treated as one value

assembly_order_outputs               (exactly one row in v1, enforced by the service)
- assembly_order_id, line_no
- item_id, to_location_id
- unit_id, qty, conversion_factor_snapshot, base_qty
- batch_number                nullable, user input
- expires_on                  nullable date, user input (must satisfy R14)
- result_batch_id             nullable, set at post, FK (org_id, item_id, batch_id)
- result_movement_line_id     nullable, set at post
- result_cost_layer_id        nullable, set at post
- result_value_minor          nullable bigint, set at post (equals total cost)

assembly_order_cost_lines
- assembly_order_id, line_no
- cost_type_id                FK (org_id, id) restrict
- description                 nullable text
- quantity, rate_minor        nullable, informational
- amount_minor                bigint >= 0
- scales_with_qty             boolean, informational copy of the BOM flag

assembly_order_consumptions          (written at post, append only)
- assembly_order_id
- component_id                FK to assembly_order_components
- item_id, from_location_id, batch_id (nullable)
- base_qty
- posting_seq                 int, always 1 in v1 (staged production adds more events per order)
- movement_line_id            FK (org_id, id) to stock_movement_lines
- value_minor                 bigint, sum of the allocations of that movement line
```

### 5.3 Constraints and indexes

- Checks: quantities positive, `amount_minor >= 0`, status transitions only in the service, `ck_assembly_order_posted_fields` (movement ids, currency and totals are all set or all null, matching status POSTED or REVERSED).
- Output row: unique `(assembly_order_id)` in v1 is NOT added, so a later multi-output rule needs no migration. The service rule R4 enforces one row.
- Indexes: `(org_id, status, assembly_date)`, `(org_id, bom_id)` partial where not null, `(org_id, item_id)` on components and outputs (where-used and history), `(org_id, assembly_order_id)` on all child tables, `(org_id, batch_id)` on consumptions and outputs (trace).
- FKs to posted history use `ON DELETE RESTRICT`. Child lines of a DRAFT cascade on order delete.
- Not expressible in the schema (service and tests): item flags, batch status, location intents, stock sufficiency, currency match, the "exactly one output" rule.

## 6. Contracts and API

Contracts live in `packages/contracts/src/assembly-order/` (constants, errors, schemas, rules, locales en and ar, barrel). Server module `modules/assembly-order/` follows the six-method pattern of `inventory-transfer` (service, repository, mapper, errors, error map, permissions, `deps.ts` ports, `hono-routes/` one file per route).

### 6.1 Endpoints

| Method and path | Permission | Notes |
|---|---|---|
| `POST /assembly-orders` | create | Body: warehouse, date, optional `bomId`, output (item, qty, unit, location, batch number, expiry), components (when no BOM), cost lines. With `bomId` the server scales the BOM (R8 to R10). |
| `POST /assembly-orders/preview` | read | Same body, saves nothing. Returns scaled lines, availability per line, planned batch picks, estimated cost (item default prices), warnings. |
| `GET /assembly-orders` | read | Offset list: status, date range, output item, warehouse, search by number. |
| `GET /assembly-orders/:id` | read | Detail with lines, consumptions and result fields. |
| `PATCH /assembly-orders/:id` | update | DRAFT only. |
| `DELETE /assembly-orders/:id` | delete | DRAFT only. |
| `POST /assembly-orders/:id/post` | post | Section 9.2. |
| `POST /assembly-orders/:id/reverse` | reverse | Section 9.4. Body: reason (required, max 500). |
| `POST /assembly-orders/:id/cancel` | cancel | DRAFT only. |
| `GET /assembly-orders/:id/trace` | read | Which component batches went into the output batch, with quantities and costs. |
| `GET /batches/:id/assembly-trace` | read (batch) | Forward and backward trace for one batch (recall use). |

All quantities travel as decimal strings, money as strings of minor units (same as accounting).

### 6.2 Error codes (UPPER_SNAKE, each with a locale key)

`ASSEMBLY_ORDER_NOT_FOUND`, `ASSEMBLY_ORDER_NOT_DRAFT`, `ASSEMBLY_ORDER_NOT_POSTED`, `ASSEMBLY_ORDER_ALREADY_REVERSED`, `ASSEMBLY_ORDER_NUMBER_TAKEN`, `ASSEMBLY_OUTPUT_ITEM_NOT_ASSEMBLABLE`, `ASSEMBLY_OUTPUT_COUNT_INVALID`, `ASSEMBLY_COMPONENT_ITEM_INVALID`, `ASSEMBLY_COMPONENT_DUPLICATE`, `ASSEMBLY_OUTPUT_IS_COMPONENT`, `ASSEMBLY_TOO_MANY_COMPONENTS`, `ASSEMBLY_TOO_MANY_LINES`, `ASSEMBLY_TOO_MANY_COST_LINES`, `ASSEMBLY_WAREHOUSE_MISMATCH`, `ASSEMBLY_BOM_NOT_FOUND`, `ASSEMBLY_BOM_OUTPUT_MISMATCH`, `ASSEMBLY_INSUFFICIENT_STOCK`, `ASSEMBLY_BATCH_UNAVAILABLE`, `ASSEMBLY_COMPONENT_UNCOSTED`, `ASSEMBLY_CURRENCY_MISMATCH`, `ASSEMBLY_COST_TYPE_INVALID`, `ASSEMBLY_COST_LINE_AMOUNT_MISMATCH`, `ASSEMBLY_OUTPUT_BATCH_REQUIRED`, `ASSEMBLY_OUTPUT_EXPIRY_REQUIRED`, `ASSEMBLY_OUTPUT_EXPIRY_AFTER_COMPONENT`, `ASSEMBLY_PERIOD_CLOSED`, `ASSEMBLY_DATE_IN_FUTURE`, `ASSEMBLY_JOURNAL_FAILED`, `ASSEMBLY_OUTPUT_ALREADY_USED`, `ASSEMBLY_MAPPING_MISSING`. Engine and accounting codes pass through the error map with their own messages.

### 6.3 Idempotency

Post and reverse are idempotent by status plus the unique movement source. A client retry after a lost response gets a 409 with the current status; the UI then reloads the order. No client idempotency key is needed. [OPEN, same as transfer Q11.]

## 7. UI

Web feature `apps/web/src/features/assembly-order-module/` using the form architecture in `docs/FORMS.md` (form, container, route) and copy through `t()` from the contracts locales (`docs/COPY.md`).

- **List:** number, date, output item, quantity, warehouse, total cost, status badge. Filters: status, date, item.
- **Create and edit form (one page, three blocks):**
  1. Output: item picker (only `can_assembled` items), quantity and unit, output location, optional BOM picker (defaults to the item's default BOM), batch number and expiry when tracked.
  2. Components: grid prefilled from the BOM or empty. Columns: item, location, batch (auto or pick), quantity and unit, planned quantity, available now, per-line status (short stock in red). Add and remove rows.
  3. Additional costs: grid of cost type, description, quantity, rate, amount.
  A side panel shows the live preview: material cost estimate, additional cost, estimated cost per unit, warnings (zero cost, uncosted stock, expiry capped). The preview calls `/preview` and says "estimate" until posted.
- **Detail:** header, lines, after post the real consumptions (batch, location, cost), result batch and cost per unit, links to the two stock movements and the journal entry. Actions by status: Post (confirm dialog), Reverse (reason), Cancel, Copy.
- **Post confirm text:** "Posting takes the components out of stock and puts the new item in. It cannot be edited afterwards, only reversed while the new stock is untouched."
- **Item details:** panels "Bills of materials" (as output) and "Used in" (as component), plus last assembly cost.
- **Stock movement list:** already renders the two types. Check the direction display (consume is OUT, produce is IN) per the root AGENTS rule about virtual locations. Never show the PRODUCTION location name.
- **States:** empty list, loading, server error with the localized code, short stock inline, closed period, read-only view for users without post permission.
- **RTL and Arabic:** every key in en and ar, `sync:i18n:check` clean, numeric inputs stay left to right inside RTL layout, check the grid on narrow screens.

## 8. Permissions

New resource `assembly_order` in `packages/contracts/src/modules/registry.ts`: CRUD plus `post`, `reverse`, `cancel` (event names `posted`, `reversed`, `cancelled`). Sidebar group `inventory`, path `/assembly-orders`, label en "Assembly orders", ar "أوامر التجميع". Defaults (Q14): owner and admin all; inventory roles read, create, update, post; others none. Run the sidebar seed on production after deploy.

Audit events: `assembly_order.created`, `.updated`, `.deleted`, `.posted`, `.reversed`, `.cancelled`.

## 9. Accounting and inventory effects

### 9.1 What changes at each stage

| Stage | on hand (components) | on hand (output) | cost layers | journal |
|---|---|---|---|---|
| Draft, update, cancel | none | none | none | none |
| Post | down by consumed base qty per batch and location | up by output base qty | component layers depleted, one new output layer | Dr Inventory, Cr Manufacturing cost absorbed (additional cost only) |
| Reverse | restored | down by output base qty | layers restored, output layer consumed | reversal of the above |

### 9.2 Post algorithm

All inside `db.transaction`. Validate everything first, write second.

1. Load and lock the order `FOR UPDATE`. Reject unless DRAFT. Check assembly date and period.
2. Re-validate items (R1 to R3), locations, cost types, and the account mapping for `ASSEMBLY_COST_ABSORBED` when additional cost is above zero (`ASSEMBLY_MAPPING_MISSING`).
3. Resolve component batches (R12) and check availability (R11). Check the number of movement lines (R6).
4. Resolve or create the output batch only after step 6 (needs consumed batch expiry), but verify the inputs now.
5. Post the **consume** movement: `stockMovement.post({ type: "assembly_consume", sourceType: "assembly_order_consume", sourceId: order.id, sourceRef: number, lines })`. Lines carry explicit batch ids. The engine locks balances in key order. A failure returns before writing.
6. For each consume line (by returned line id): find the `inventory_items` row and, for batches, the `inventory_item_batches` row; call `consumeFifo`. If `uncoveredQty > 0` fail with `ASSEMBLY_COMPONENT_UNCOSTED` (this check also runs as a dry check in step 3 against the layers so the common case fails before any write). Sum the allocation values per line into `assembly_order_consumptions`.
7. Compute material cost, add cost lines, get total (R19).
8. Resolve or create the output batch through `ensureBatches` (R13, R14).
9. Post the **produce** movement (`assembly_produce`, `assembly_order_produce`).
10. Create the output cost layer through the costing service with `received_value = total`, `received_qty = output base qty`, source line = the produce line.
11. If additional cost is above zero, call `postBusinessEvent({ event: "assembly_cost", sourceId: order.id, date, amountMinor, ... }, tx)`. On failure throw so the transaction rolls back.
12. Update the order: status POSTED, movement ids, journal id, totals, currency, posted_at, posted_by; update the output row result columns.
13. After commit: audit event.

Idempotency and ordering notes: steps 5 and 9 use unique sources, so a repeated post cannot duplicate movements. Steps 5 and 6 run in this order because `consumeFifo` needs the movement line id and the balance rows. Locks: order, then engine balances (sorted), then cost layers `FOR UPDATE`. Two orders that use the same component serialize on the balance rows.

### 9.3 Costing detail

- Per component line: `value = sum(allocated_value)`. The costing service already keeps integer math with exact remainder (`valueOfTake`), so the sum of takes equals the layer value.
- The output layer is one layer per output batch. With one output row, one layer. Its age (`received_at`) is the produce movement time, so FIFO for later sales treats it as new stock.
- Layer reads for later sales: sales delivery consumes this layer like any receipt layer. The output layer has `origin_cost_layer_id = null` (it is a new base layer, not derived), which satisfies `ux_inventory_cost_layer_org_base_*`.
- Valuation method: see Q3. If the owner chooses to block weighted average items, add `ASSEMBLY_VALUATION_METHOD_UNSUPPORTED`.

### 9.4 Reversal algorithm

All inside one transaction, section 4 R27 to R29. Steps: lock order, check POSTED and not reversed; check the output stock and layer (R28); `stockMovement.reverse` for the produce movement; consume the output layer (`consumeLayersOfSourceLine`); `stockMovement.reverse` for the consume movement; `restoreAllocationsOfLine` for each consume line; `reverseJournalEntry` when a journal exists; set REVERSED, `reversed_at`, `reversed_by`, reason. A reversal of a consume movement returns stock to the original location and batch.

### 9.5 Accounting

- **Why only additional cost posts:** the chart has one `INVENTORY_ASSET` account for all stock items. Components leaving and the output arriving both sit inside it, so materials need no line. If per-category inventory accounts are added later, add component credit and output debit lines here behind that change.
- **Template `assembly_cost`:** Dr `INVENTORY_ASSET` amount, Cr `ASSEMBLY_COST_ABSORBED` amount. Source type `assembly_cost` (append to `ACCOUNTING_SOURCE_TYPES`), source id = order id. Zero amount is never posted (the template drops zero lines and the service rejects an empty entry), so the caller skips the call.
- **Absorption:** labor and overhead are real expenses booked elsewhere (salaries, rent). The credit to the absorbed account offsets them, so the cost moves into inventory without changing profit at the time of assembly. It reaches cost of goods sold when the output is sold. The balance left on the absorbed account is under or over absorption.
- **Presentation check (phase 0):** the account has type EXPENSE with a credit balance. Verify that the profit and loss report shows it correctly.
- **Backfill:** `syncAccountingDefaults` adds the mapping and account for existing organizations. If an organization already uses code 5600 for a custom account, the initializer rolls that organization back today. Handle by choosing the next free code, or leaving the key unmapped so the post fails with `ASSEMBLY_MAPPING_MISSING` and a clear message.
- **Currency and period:** organization currency only. Posting date must be in an open period (the accounting service checks it).

## 10. Reporting and reconciliation

Views and reports:

1. Assembly orders by status, date, output item, warehouse.
2. Cost breakdown per order: materials by component, additional cost by type, cost per output unit.
3. Component usage by item and period; planned versus actual quantity (yield variance) from `planned_base_qty`.
4. Batch trace, both directions (which component batches are inside this output batch, and where an output batch went is covered by the sales and transfer movements).
5. Absorbed cost versus the balance of the absorbed account.

Reconciliation invariants, run as tests and later as a job (`docs/FEATURE-TRACKING.md` section 4):

- I1. For each POSTED order: sum of consumption values + additional cost = output layer `received_value`.
- I2. Sum of consume quantities per item equals the quantity on the consume movement; produce movement quantity equals the output base qty.
- I3. Sum of `inventory_cost_allocations` of the consume lines equals the sum of consumption values.
- I4. The journal total equals additional cost and is balanced; no journal exists when additional cost is zero.
- I5. A REVERSED order leaves every touched layer at its pre-post remaining quantity and value, and the journal pair nets to zero.
- I6. `inventory_items.on_hand_qty` equals the movement ledger for the touched items and batches (existing reconciliation).

## 11. Acceptance criteria

Each maps to a test in [`TEST-PLAN.md`](./TEST-PLAN.md).

1. AC1. A draft (create, update, delete, cancel) changes no stock, layer or journal.
2. AC2. Creating from a BOM scales quantities and costs by the factor and scrap %, rounds half up at 6 decimals, and keeps `planned_base_qty`.
3. AC3. An ad hoc order with no BOM can be created and posted.
4. AC4. Post consumes the exact components (explicit batches), produces the output, and creates one output layer valued at materials plus additional cost.
5. AC5. Post with insufficient stock in any component location or batch fails with no write.
6. AC6. Post with stock that has no cost layer fails with `ASSEMBLY_COMPONENT_UNCOSTED` and no write.
7. AC7. Batch-tracked and expiry-tracked output: batch created or reused, expiry capped by the earliest component expiry, a later date is rejected.
8. AC8. Additional cost posts one balanced journal (Dr Inventory, Cr absorbed). No additional cost posts no journal. A failing journal aborts the whole post.
9. AC9. Repeated post and concurrent post produce one pair of movements, one layer set and one journal.
10. AC10. Two orders racing for the same component cannot overdraw it.
11. AC11. Reverse restores components (stock, batches, layers) and removes the output, and reverses the journal.
12. AC12. Reverse is blocked once any output quantity was used or sold.
13. AC13. Tenant isolation: another organization cannot read or use the order, BOM, cost type, batch or location.
14. AC14. Permission matrix: each endpoint denies without its permission and touches nothing.
15. AC15. Reconciliation invariants I1 to I6 hold after every scenario above.
16. AC16. Locales en and ar match and no raw keys show.
17. AC17. The trace endpoints return the component batches of an output batch and back.

## 12. Implementation tasks

Phases and task ids live in [`PROGRESS.md`](./PROGRESS.md). Order: 0 decisions, 1 accounting and costing groundwork (README section 8), 4 drafts, 5 post, 6 reverse, 7 web, 8 reports and hardening. The BOM and cost type modules come before phase 4 in the overall plan.

## 13. Repository checks before implementation

### 13.1 Done in this analysis (evidence)

| Check | Result |
|---|---|
| `items.can_assembled` | Exists in schema, service create and update, mapper, web form and details. No other use. |
| Movement types | `assembly_consume` and `assembly_produce` in `STOCK_MOVEMENT_TYPES`; sides in `stock-movement/rules.ts` SIDES. |
| Batch expansion | `commit` step 1b splits outbound lines with no batch. Mapping to request lines is lost (README finding 5). |
| Source uniqueness | `ux_stock_movement_org_source` on `(org_id, source_type, source_id)` where `source_id` is not null and not a reversal. |
| Costing methods | `consumeFifo`, `consumeLayersOfSourceLine`, `deriveLayer`, `restoreAllocationsOfLine`, `createCostLayer`, `recordAllocation`. No weighted average code. |
| Layer lookup | Receipt code finds the `inventory_items` row after the movement (`costLayerAdapter` in `purchase-receipt/deps.ts`) and throws if it is missing. |
| Accounting | `INVENTORY_ASSET` single account; no production or labor keys; mapping keys are a DB enum. |
| Transactions | `createDbClient` uses a WebSocket pool transaction in production, pass-through on the local proxy. |
| Numbering | `inventory-transfer.repository.ts` `nextDocumentNumber` uses an advisory lock and max suffix. |

### 13.2 To verify in phase 0

1. Every existing organization has the PRODUCTION system location (new organizations get it from `warehouse.defaults.ts`). Add a backfill if not.
2. The default role grants file and how the registry feeds the permission picker (add locale labels in en and ar for the new resources).
3. Profit and loss presentation of a credit balance on an EXPENSE account.
4. Whether `postBusinessEvent` accepts a new event name without a migration (sources are plain strings per the contracts comment) and where the `PostBusinessEventInput` schema lists events.
5. `allocateBatches` behavior for equal expiry dates, to reuse the same tie-break.
6. The warehouse "stockable, receivable, pickable" rules for the PRODUCTION location (it is a counterparty, so no check) and for output locations of purpose `production`.
7. Max request time of a post with 100 components on the Worker (measure on a copy before raising limits).

## 14. Decisions to preserve

- Single-step post with two movements and one transaction in v1. WIP is a later phase with its own location role.
- Real cost from layers, never default prices. Uncosted stock blocks the post (Q2).
- Batches are picked by the assembly service so the genealogy is exact.
- Only additional cost posts a journal, through a new absorbed mapping key (Q4).
- The order snapshots BOM data. BOM edits never rewrite history.
- The output table allows several rows, the service allows one.
- Reversal only while the output is untouched.
- v1 must stay extendable to staged production with WIP. Keep the hooks of R35 and do not add unused states or tables.

Open questions: README section 5. Risks: README section 10.
