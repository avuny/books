# Inventory schema integration notes

- Merge the exports in `exports.fragment.txt` into the existing inventory `index.ts`; preserve all existing exports.
- Merge `relations.ts` into the domain's existing relations file if it already contains item or expiry-setting relationships.
- Ensure the root schema index exports the inventory domain.
- Verify required composite unique targets exist in `items`, `warehouses`, and `warehouse_locations`.
- Generate the migration with `drizzle-kit generate`; do not hand-write generated migration SQL.
- Backfill old `stock_balances` into `inventory_items` and `inventory_item_batches` before dropping the old table.
- Do not delete `batches.cost` until its current opening-stock meaning and replacement are resolved.
