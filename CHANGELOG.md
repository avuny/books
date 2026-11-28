# Changelog

## [Unreleased]

## [0.6.2] - 2026-11-28
### Fixed
- Receive and pay asks for the supplier invoice number (required to post the bill). In 0.6.1 the button posted the receipt, failed on the bill and undid everything.

## [0.6.1] - 2026-11-28
### Fixed
- Quick purchase receipt ("Receive and pay") now runs step by step from the web app with undo on failure. The single server endpoint hit the Cloudflare Workers database call limit in production and could leave a half-done receipt.
- Known limit: the undo runs in the browser. If the tab closes mid-way, or a request gets no answer, the client does not undo automatically and asks the user to check the receipt, bill and payment before retrying.

## [0.6.0] - 2026-11-28
### Added
- Sales order, sales delivery (stock out with FIFO COGS), sales invoice and customer payment modules, with posting journals, reversals, en/ar UI and permissions
- AR aging, customer statement and AR reconciliation reports
- Sales credit notes (amount based, pro rata tax) that settle invoices and show on statements
- POS style sales receipt: invoice, post and collect a posted delivery in one step
- Quick purchase receipt: receive, bill and pay a purchase order in one step
- Migrations 0030 to 0034 (sales order, delivery, invoice, customer payment, credit note)
- Batches always on: stock issues are split across batches automatically (earliest expiry first for expiry-tracked items, oldest first otherwise), negative stock is blocked for batch items, batch tracking follows inventory tracking
- Receipt lines take an expiry date, so expiry-tracked items can be received

## [0.3.0] - 2026-11-26
### Added
- Purchase receipt module: receive goods against purchase orders into stock (inventory, FIFO cost layers, Dr Inventory / Cr GRNI journal), post and reverse
- Item default cost and selling price; purchase order lines prefill the unit price from the cost price
- Purchase order line discount as percent or amount; location picker searches as you type

### Fixed
- Expiry tracking needs only inventory tracking
- Stock balances endpoint error and in-transit quantity on item stock
- Deploys now run database migrations and the seed automatically and stop if the production database secret is missing

## [0.2.0] - 2026-11-26
### Added
- Purchase order module: purchase orders with per-line discount and tax rates, supplier shipments (create, post, reverse), payment terms, English and Arabic UI
- SaaS monetization specs: plan, subscription, payment, billing, feature-gate modules, phased implementation plan

## [0.1.0] - 2026-11-26
### Added
- Multi-tenant inventory, accounting and business management platform
- Unit and unit-collection modules with org-specific units
