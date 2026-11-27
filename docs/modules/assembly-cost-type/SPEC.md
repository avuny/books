# Assembly Cost Type: Implementation Specification

| | |
|---|---|
| Version | 1.0 · 2026-11-27 |
| Status | proposed |
| Owner | Product owner |
| Depends on | role (permissions), activity-log, organization init (default rows) |

Docs only. Overview and questions: [`../assembly/README.md`](../assembly/README.md). Companions: [`PROGRESS.md`](./PROGRESS.md), [`TEST-PLAN.md`](./TEST-PLAN.md). Users: [`../bill-of-materials/SPEC.md`](../bill-of-materials/SPEC.md), [`../assembly-order/SPEC.md`](../assembly-order/SPEC.md).

Legend: **[CURRENT]**, **[PROPOSED]**, **[OPEN]** as in the other specs.

## 0. Reading order for agents
`AGENTS.md` files, this file, then section 13. Small module: one phase.

## 1. Goals and non-goals
Goal: a small catalog of non-stock cost kinds (labor, machine time, overhead, outside service) so BOM and order cost lines have a name and can be reported by kind.

Non-goals: no GL account per type in v1 (all additional cost uses the one absorbed account, Q4), no rates history, no employees or machines.

## 2. Domain model
One table, `assembly_cost_types`. Cost types are reference data used by `bom_cost_lines` and `assembly_order_cost_lines`. They carry no balance and post nothing.

## 3. Lifecycle
`is_active` true or false. Delete only when no BOM line or order line references the type, else `ASSEMBLY_COST_TYPE_IN_USE` and the user deactivates. Inactive types stay on old documents and cannot be chosen on new lines.

## 4. Business rules
- R1. `name` required, max 80, unique per organization (case-insensitive).
- R2. `kind` is one of `LABOR`, `MACHINE`, `OVERHEAD`, `SERVICE`, `OTHER`. Used for reports only. It does not choose an account.
- R3. `default_rate_minor` optional bigint >= 0 and `unit_label` optional text (for example "hour"). They only prefill a line's rate. The line amount is what counts.
- R4. Changing `kind` is allowed. Reports group by the current kind (history is by type id).
- R5. Default rows per organization, seeded at organization init and by a backfill for existing organizations: Labor (LABOR, "hour"), Overhead (OVERHEAD). Users can rename or deactivate them (Q12). The backfill must skip a name that already exists.
- R6. Org id on every row, composite unique and FK pattern as other masters.

## 5. Database design
```text
assembly_cost_types
- name                 text, unique (org_id, lower(name))
- kind                 enum assembly_cost_kind
- default_rate_minor   nullable bigint >= 0
- unit_label           nullable text, max 20
- is_active            boolean default true
- notes                nullable text, max 300
```
Enum `assembly_cost_kind`: `LABOR`, `MACHINE`, `OVERHEAD`, `SERVICE`, `OTHER`. Index `(org_id, is_active)`.

## 6. Contracts and API
`packages/contracts/src/assembly-cost-type/`. Endpoints: `POST /assembly-cost-types`, `GET /assembly-cost-types` (filters: active, kind, search), `GET /:id`, `PATCH /:id`, `DELETE /:id`, `POST /:id/activate`, `POST /:id/deactivate`. Errors: `ASSEMBLY_COST_TYPE_NOT_FOUND`, `ASSEMBLY_COST_TYPE_NAME_TAKEN`, `ASSEMBLY_COST_TYPE_IN_USE`. Locale keys en and ar.

## 7. UI
A simple settings style list with an add and edit dialog under the inventory sidebar group, plus an inline "create cost type" shortcut inside the cost line picker of the BOM and order forms (permission aware). Empty state explains what cost types are.

## 8. Permissions
Resource `assembly_cost_type` (CRUD, activate and deactivate through update), sidebar group `inventory`, path `/assembly-cost-types`, en "Assembly cost types", ar "أنواع تكلفة التجميع". Audit events `assembly_cost_type.created`, `.updated`, `.deleted`.

## 9. Accounting and inventory effects
None. Amounts on documents reach the journal only through the assembly order post (assembly order SPEC section 9.5).

## 10. Reporting
Additional cost by type and kind per period (from order cost lines of POSTED orders).

## 11. Acceptance criteria
1. AC1. CRUD follows R1 to R4 with tenant isolation.
2. AC2. Delete is blocked when referenced, deactivate works, inactive types cannot be used on new lines.
3. AC3. Default rows exist for new organizations and after the backfill, no duplicates on rerun.
4. AC4. Permission matrix and locale parity.

## 12. Implementation tasks
See PROGRESS.md. Phase 2 of the overall plan (README section 8).

## 13. Repository checks before implementation
1. Find how organization init seeds defaults for other modules (for example `warehouse.defaults.ts`) and reuse the pattern, including idempotent backfill.
2. Confirm the registry accepts a resource with the sidebar group `inventory` and that the sidebar seed must be run after deploy.
3. Check an existing small master (for example units or categories) as the code template.

## 14. Decisions to preserve
- No account per cost type in v1.
- Kind is for reporting only.
- Seed Labor and Overhead, editable (Q12).
