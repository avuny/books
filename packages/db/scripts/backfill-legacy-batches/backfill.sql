-- Batches always on: every inventory-tracked item becomes batch-tracked. Stock an item already holds goes
-- into one batch per item, number LEGACY, status available, no expiry. Quantities, movements and cost
-- layers are re-pointed at that batch; no quantity or value changes.
-- Safe to re-run: items already in the log table are skipped. Undo with rollback.sql.
-- Statements are separated by the marker below (run.ts executes them in one transaction).
CREATE TABLE IF NOT EXISTS batch_backfill_log (
  org_id uuid NOT NULL,
  item_id uuid NOT NULL,
  batch_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, item_id)
);
--> statement-breakpoint
INSERT INTO batch_backfill_log (org_id, item_id, batch_id)
SELECT i.org_id, i.id,
  CASE WHEN EXISTS (SELECT 1 FROM inventory_items ii WHERE ii.org_id = i.org_id AND ii.item_id = i.id)
       THEN gen_random_uuid() END
FROM items i
WHERE i.is_inventory_tracked AND NOT i.is_batch_tracked
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO batches (id, org_id, item_id, batch_number, status, notes)
SELECT l.batch_id, l.org_id, l.item_id, 'LEGACY', 'available', 'Stock held before batches were always on'
FROM batch_backfill_log l
WHERE l.batch_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM batches b WHERE b.id = l.batch_id);
--> statement-breakpoint
INSERT INTO inventory_item_batches (org_id, inventory_item_id, item_id, batch_id, on_hand_qty, reserved_qty, on_order_qty)
SELECT ii.org_id, ii.id, ii.item_id, l.batch_id, ii.on_hand_qty, ii.reserved_qty, ii.on_order_qty
FROM batch_backfill_log l
JOIN inventory_items ii ON ii.org_id = l.org_id AND ii.item_id = l.item_id
WHERE l.batch_id IS NOT NULL
ON CONFLICT (org_id, inventory_item_id, batch_id) DO NOTHING;
--> statement-breakpoint
UPDATE stock_movement_lines s SET batch_id = l.batch_id
FROM batch_backfill_log l
WHERE l.batch_id IS NOT NULL AND s.org_id = l.org_id AND s.item_id = l.item_id AND s.batch_id IS NULL;
--> statement-breakpoint
UPDATE inventory_cost_layers c SET inventory_item_batch_id = b.id
FROM batch_backfill_log l
JOIN inventory_item_batches b ON b.org_id = l.org_id AND b.item_id = l.item_id AND b.batch_id = l.batch_id
WHERE l.batch_id IS NOT NULL AND c.org_id = l.org_id AND c.inventory_item_id = b.inventory_item_id
  AND c.inventory_item_batch_id IS NULL;
--> statement-breakpoint
UPDATE inventory_reservation_allocations a SET inventory_item_batch_id = b.id
FROM batch_backfill_log l
JOIN inventory_item_batches b ON b.org_id = l.org_id AND b.item_id = l.item_id AND b.batch_id = l.batch_id
WHERE l.batch_id IS NOT NULL AND a.org_id = l.org_id AND a.inventory_item_id = b.inventory_item_id
  AND a.inventory_item_batch_id IS NULL;
--> statement-breakpoint
UPDATE items i SET is_batch_tracked = true
FROM batch_backfill_log l
WHERE i.org_id = l.org_id AND i.id = l.item_id AND NOT i.is_batch_tracked;
