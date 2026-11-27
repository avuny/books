# Item Assembly: overview, decisions and build plan

| | |
|---|---|
| Version | 1.0 · 2026-11-27 |
| Status | proposed (docs only, nothing implemented) |
| Owner | Product owner (requested 2026-11-27) |
| Base | `main` at `51bf727` (migrations up to `0029_item_unit_prices`) |
| Specs | [`bill-of-materials`](../bill-of-materials/SPEC.md), [`assembly-order`](../assembly-order/SPEC.md), [`assembly-cost-type`](../assembly-cost-type/SPEC.md) |

Legend: **[CURRENT]** exists in code today, **[PROPOSED]** recommended, **[OPEN]** needs the owner's answer (section 5).

## 1. The ask

Let a user create an item from existing items. The range is wide: put item A in a bag (item B) and sell the result, up to building a complex product from many parts. The user can also add cost that is not stock: labor, machine time, overhead, a service. Stock, batches, stock movements, inventory projections, costing and accounting must all stay correct.

## 2. What the repo already gives us (verified in code)

| Fact | Where |
|---|---|
| `items.can_assembled` already exists (default false), is editable on the item form and shown on item details. **Nothing uses it yet.** | `packages/db/src/schema/item/item.ts`, `apps/web/src/features/item-module/` |
| Movement types `assembly_consume` and `assembly_produce` already exist in the TS list and the DB enum. Sides are fixed: consume goes from a real location (issue) to the PRODUCTION system location, produce goes from PRODUCTION to a real location (receive). No enum migration is needed. English and Arabic labels and badges exist. | `packages/contracts/src/stock-movement/constants.ts`, `rules.ts`, `locales/` |
| A PRODUCTION system location is created with a new warehouse set up. It is a counterparty: it has **no stock balance**. | `apps/server/src/api/modules/warehouse/warehouse.defaults.ts`, `rules.ts` |
| The ledger ties one posting to one movement type and one `(source_type, source_id)`. So one assembly needs two movements (consume and produce) that share a source id and use two source types. | `stock-movement.ts` (unique index `ux_stock_movement_org_source`) |
| Cost layers are per `inventory_items` row (and batch). `consumeFifo`, `deriveLayer`, `consumeLayersOfSourceLine` and `restoreAllocationsOfLine` exist in the costing service since the transfer module. Allocations are stored per outgoing movement line. | `modules/inventory-costing/inventory-costing.service.ts` |
| Inventory is **one org-wide account** (`INVENTORY_ASSET`). Moving value between items does not change the books. | `posting-templates.ts`, transfer spec 13.7 |
| Mapping keys are an append-only DB enum. There is **no key for labor, overhead or production cost**. `postBusinessEvent` drops zero amount lines and fails when nothing is left. | `accounting/constants.ts`, `posting-templates.ts` |
| Batches: `ensureBatches` creates or reuses batches (purchase receipt uses it). An outbound line with no batch is split FEFO (expiry-tracked) or FIFO by the engine. Issue needs status `available`; receive allows `available` or `quarantined`. | `batch.service.ts`, `stock-movement.service.ts`, `batch/rules.ts` |
| `db.transaction` is a real transaction in production (short-lived Neon WebSocket pool). On the local test proxy it is a pass-through, so rollback cannot be asserted in tests. `docs/TESTING.md` still says it is a pass-through everywhere: that note is out of date for production. | `packages/db/src/client.ts` |

## 3. Findings that shape the design

1. **Weighted average is not implemented.** `weighted_average` is in the valuation enum but every costing path uses FIFO layers. Assembly must pick one behaviour (Q3).
2. **Stock without a cost layer exists.** Adjustment gains create no layer. Assembling from such stock would understate the product cost (Q2).
3. **The adjustment journal never posts** (always amount 0, failure ignored, transfer spec 13.5). Assembly must treat a failed journal as a rollback, never ignore it.
4. **The GL effect of a pure assembly is zero** with one inventory account. Only the additional costs (labor, overhead, service) need a journal. The design keeps a hook for per-category inventory accounts later.
5. **Engine batch auto-allocation loses the mapping** between a request line and the batch lines it expands to. The transfer module solved this by allocating batches in its own service. Assembly must do the same, because it must record which component batch went into which output batch (recall and traceability).
6. **No WIP concept.** The PRODUCTION location holds no balance, so goods cannot sit "in production" between consume and produce. That is why v1 is a single-step post (both movements in one transaction) and WIP is phase 2.

## 4. Module map

| Module | Purpose | Spec |
|---|---|---|
| `bill-of-materials` (BOM) | Reusable recipe: output item and quantity, component lines with scrap %, additional cost lines. Estimate and "how many can I build" views. Optional: an assembly can be ad hoc with no BOM. | [SPEC](../bill-of-materials/SPEC.md) |
| `assembly-order` | The posting document. Draft, then post (consume components, produce output, cost roll-up, journal for additional cost), reverse, cancel. Holds the batch and cost genealogy. | [SPEC](../assembly-order/SPEC.md) |
| `assembly-cost-type` | Small catalog of non-stock cost kinds (labor, machine, overhead, service) used by BOMs and orders. | [SPEC](../assembly-cost-type/SPEC.md) |
| Changes to existing modules | accounting, inventory-costing, item, batch, permissions registry, sidebar, activity log. | section 7 |

## 5. Decisions the owner should confirm (defaults are used until answered)

| # | Question | Default used in the specs |
|---|---|---|
| Q1 | v1 scope: single-step assembly (no WIP) or full production orders with WIP, partial completion and scrap? | Single-step in v1. WIP production orders are phase 2 (section 9). |
| Q2 | Component stock that has no cost layer (for example adjustment gains): block, or fall back to the item's default cost price? | Block with a clear error. A later flag can allow the fallback, marked "estimated". |
| Q3 | Weighted average items: consume FIFO layers anyway until weighted average exists, or block assembly for them? | Consume FIFO layers and document the gap. The first weighted average implementation must go into the costing service so assembly and sales share it. |
| Q4 | Labor, machine and overhead: credit a new "Manufacturing cost absorbed" account (standard absorption costing), or credit accounts payable or cash directly? | New mapping key `ASSEMBLY_COST_ABSORBED`, default account 5600. Real wages stay in Salaries. The difference shows as under or over absorbed. |
| Q5 | One warehouse per assembly order, or components from several warehouses? | One warehouse per order. Move stock with a transfer first. |
| Q6 | Output expiry for expiry-tracked products: shelf life from the item, capped by the earliest component expiry? | Yes. The user may shorten it, not lengthen it. |
| Q7 | Service items (not stock tracked) as BOM lines? | No. Use cost types for non-stock cost. |
| Q8 | Can the produced batch start as `quarantined` (pending QC)? The engine allows receive into quarantine. | Default `available`; the order has a "produce as quarantined" switch (phase 2 UI). |
| Q9 | Reversal after the output was sold or used? | Blocked. The fix is a disassembly document (phase 2) or an adjustment. |
| Q10 | Business date: may a user backdate an assembly? | Date must be today or earlier and inside an open period. Stock movement time is the posting time. |
| Q11 | BOM versioning? | No versions. An order snapshots the BOM lines at draft time, so editing a BOM never changes history. Several BOMs per output item are allowed, one default. |
| Q12 | Default cost types seeded per organization (Labor, Overhead)? | Yes, plus the user can add more. |
| Q13 | Should posting update the item's default `cost_price`? | No. The BOM shows an estimate and the last actual cost. |
| Q14 | Which built-in roles get assembly permissions? | Owner and admin full access. Inventory roles: read, create, update, post. Verify the role defaults file in phase 0. |

## 6. Worked example

Gift set (output, 1 unit, base unit "pc"). Components per set: 3 candles, 1 box, 2 m ribbon. Additional cost: packing labor 15.00.

Stock at the moment of posting (FIFO layers): candles layer 20.00 each, box 8.00, ribbon 1.00 per m.

| Step | Effect |
|---|---|
| Post 10 sets | Consume movement: candles -30, boxes -10, ribbon -20 m, all to PRODUCTION. Allocations: candles 600.00, boxes 80.00, ribbon 20.00 = 700.00. |
| Additional cost | Labor 150.00 (10 x 15.00). |
| Produce movement | Gift set +10 into the chosen location. New cost layer: received qty 10, value 850.00, so 85.00 per set. |
| Journal | Dr Inventory 150.00, Cr Manufacturing cost absorbed 150.00. Materials moved inside Inventory, so no line. |
| Reverse (if untouched) | Produce reversed, consume reversed, allocations restored on the original layers, journal reversed. |

## 7. Changes to existing modules

| Module | Change | Needed by |
|---|---|---|
| accounting | Append mapping key `ASSEMBLY_COST_ABSORBED` (DB enum migration, allowed type EXPENSE), default chart account 5600, backfill for existing organizations, new event `assembly_cost` and source type `assembly_cost`, locale labels. | assembly-order post |
| inventory-costing | New helper to find the `inventory_items` row and `inventory_item_batches` row for a movement line (the same lookup `costLayerAdapter` does for receipts). Optional `weighted_average` support decision (Q3). No change to existing methods. | assembly-order post |
| item | Use `can_assembled`: output items need it. Block turning it off while an active BOM or a posted assembly uses the item. Item details gets "Bills of materials" and "Used in" panels. | BOM, UI |
| batch | Reuse `ensureBatches`. New read for forward and backward trace (which component batches went into which output batch). | assembly-order trace |
| warehouse | Verify every organization (old ones too) has the PRODUCTION system location. Add a backfill if not. | assembly-order post |
| `modules/registry.ts` and permissions | Add `bill_of_materials`, `assembly_order`, `assembly_cost_type` with actions. Run the sidebar seed on production after deploy. | all |
| activity-log | New audit events (see each spec). | all |
| docs | `docs/features/REGISTRY.md` rows (added in this PR). Later: note the assembly types in `packages/contracts/src/stock-movement/SPEC.md`. | docs |

## 8. Build order and gates

| Phase | Content | Gate |
|---|---|---|
| 0 | Owner answers Q1 to Q14. Run the repository checks of each SPEC section 13. | Answers logged in each PROGRESS decision log. |
| 1 | Accounting and costing groundwork: mapping key, chart account, backfill, `assembly_cost` event, costing lookup helper. | Existing tests pass. New tests for the event and the backfill. Journal fails loudly. |
| 2 | `assembly-cost-type` backend and UI. | Module gate in its TEST-PLAN. |
| 3 | `bill-of-materials` backend, then UI (cycle check, estimate, availability). | Module gate. |
| 4 | `assembly-order` drafts (create, scale from BOM, preview, update, cancel). | No stock, cost or journal effect from drafts, tested. |
| 5 | `assembly-order` post (movements, batches, costing, journal) with the reconciliation invariants. | AC for post, idempotency and concurrency pass. |
| 6 | Reverse. | Reversal AC pass. |
| 7 | Web UI for orders, item panels, trace view. | e2e main journey and permission-denied journey. |
| 8 | Reports and reconciliation job, registry and docs updates, post-deploy smoke. | Invariants documented and running. |

Each phase ships as its own PR. Phases 1 to 3 do not change stock behaviour, so they are safe to merge early.

## 9. Phase 2 (not in v1, but v1 must not block it)

- **Production orders with WIP:** release, issue components in several steps, record labor actuals, complete in parts, scrap and by-products. Needs a stockable WIP location role (the existing PRODUCTION role is a counterparty with no balance), a WIP journal (Dr WIP, Cr Inventory, then Dr Inventory, Cr WIP), and cost variance accounts.
- **Disassembly:** the reverse recipe (unpack a bag into parts). Model as an order kind that reuses the same two movement types in the opposite roles.
- **Standard costing and variances,** **serial numbers** (the repo has no serial support today), **by-products and multiple outputs** (the schema already has an outputs table so this is a rule change, not a migration).
- **Auto-explode:** build a missing sub-assembly from its own BOM when a parent order lacks stock.

## 10. Risks

1. Production and tests differ on transactions (section 2). Validate before writing, keep every write idempotent by source id, and do not rely on rollback in unit or route tests.
2. A wrong cost basis is expensive to fix later because layers are consumed by sales. The reconciliation invariants in the assembly-order SPEC section 10 must run in tests from the first post.
3. Existing organizations: new mapping key backfill can fail if an organization already has a custom account using code 5600 (the initializer rolls that organization back). Handle with a next-free-code rule or an unmapped state with a clear error.
4. Worker limits: a post touches many rows. The specs cap components at 100 per order and the output at one line in v1.
5. `main` moves fast (other agents edit it). Re-run the repository checks before each phase.
6. Merging to `main` deploys to production. Docs-only changes are safe. Each code phase needs its migration checked in the deploy log.
