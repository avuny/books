# Feature registry

One row per module. Update in the same commit that changes status. Statuses: proposed, planned, in-progress, done, deprecated.

| Module | Status | Spec | Progress | Tests | Notes |
|---|---|---|---|---|---|
| auth, otp | done | n/a | n/a | unit; e2e auth | audit B6 invite link host |
| organization | done | n/a | n/a | int, e2e | audit B1 orphan org, B10 defaults |
| organization-invitation, organization-user | done | n/a | n/a | unit | no int/e2e |
| role | done | n/a | n/a | unit | audit B7, B12 |
| party (customer, vendor) | in-progress | [SPEC](../modules/party/SPEC.md) | [PROGRESS](../modules/party/PROGRESS.md) | int | phase 7 of 9 |
| unit, unit-collection, item-category | done | n/a | n/a | unit | no int/e2e |
| item | done | n/a | n/a | unit | audit B2, B8 |
| warehouse, warehouse-location | done | n/a | n/a | unit | audit B9 |
| inventory-adjustment, stock-movement, inventory-costing, batch | done | n/a | n/a | unit | audit B3, B4 |
| accounting | in-progress | n/a | n/a | unit | server only, no web page (B5) |
| activity-log, audit | done | n/a | n/a | unit | no viewer in web |
| SaaS: plan, subscription, payment, billing, feature-gate | planned | [overview](../modules/SAAS-OVERVIEW.md) | [plan](../modules/IMPLEMENTATION-PLAN.md) | none | see SAAS-SPEC-FIXES-PLAN |
| purchase-order | in-progress | [SPEC](../modules/purchase-order/SPEC.md) | [PROGRESS](../modules/purchase-order/PROGRESS.md) | [TEST-PLAN](../modules/purchase-order/TEST-PLAN.md) | server, contracts, list, details, create form done; edit, shipments UI, int run, e2e open; D1 |
| purchase-receipt | planned | [SPEC](../modules/purchase-receipt/SPEC.md) | [PROGRESS](../modules/purchase-receipt/PROGRESS.md) | [TEST-PLAN](../modules/purchase-receipt/TEST-PLAN.md) | stage 1 |
| vendor-bill-payment | in-progress | [SPEC](../modules/vendor-bill-payment/SPEC.md) | [PROGRESS](../modules/vendor-bill-payment/PROGRESS.md) | [TEST-PLAN](../modules/vendor-bill-payment/TEST-PLAN.md) | stage 1 |
| sales-order | server + web (e2e pending) | [SPEC](../modules/sales-order/SPEC.md) | [PROGRESS](../modules/sales-order/PROGRESS.md) | [TEST-PLAN](../modules/sales-order/TEST-PLAN.md) | stage 2 |
| sales-delivery | server + web panel (e2e pending) | [SPEC](../modules/sales-delivery/SPEC.md) | [PROGRESS](../modules/sales-delivery/PROGRESS.md) | [TEST-PLAN](../modules/sales-delivery/TEST-PLAN.md) | stage 2 |
| sales-invoice-payment | in progress (M5 customer payment) | [SPEC](../modules/sales-invoice-payment/SPEC.md) | [PROGRESS](../modules/sales-invoice-payment/PROGRESS.md) | [TEST-PLAN](../modules/sales-invoice-payment/TEST-PLAN.md) | stage 2 |
