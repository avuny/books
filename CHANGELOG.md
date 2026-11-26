# Changelog

## [Unreleased]
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
