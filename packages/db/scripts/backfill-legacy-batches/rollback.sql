-- Undo backfill.sql for every item in batch_backfill_log. Only valid while nothing has posted against the
-- LEGACY batches in a way that needs them (new movements on them are re-pointed to no batch too, which is
-- only correct if batch tracking is switched back off, as this does). Run it before the new code ships, or
-- take a database snapshot first.
UPDATE items i SET is_batch_tracked = false
FROM batch_backfill_log l WHERE i.org_id = l.org_id AND i.id = l.item_id;
--> statement-breakpoint
UPDATE inventory_reservation_allocations a SET inventory_item_batch_id = NULL
FROM inventory_item_batches b JOIN batch_backfill_log l ON l.batch_id = b.batch_id
WHERE a.inventory_item_batch_id = b.id;
--> statement-breakpoint
UPDATE inventory_cost_layers c SET inventory_item_batch_id = NULL
FROM inventory_item_batches b JOIN batch_backfill_log l ON l.batch_id = b.batch_id
WHERE c.inventory_item_batch_id = b.id;
--> statement-breakpoint
UPDATE stock_movement_lines s SET batch_id = NULL
FROM batch_backfill_log l WHERE l.batch_id IS NOT NULL AND s.batch_id = l.batch_id;
--> statement-breakpoint
DELETE FROM inventory_item_batches b USING batch_backfill_log l WHERE l.batch_id IS NOT NULL AND b.batch_id = l.batch_id;
--> statement-breakpoint
DELETE FROM batches b USING batch_backfill_log l WHERE l.batch_id IS NOT NULL AND b.id = l.batch_id;
--> statement-breakpoint
DROP TABLE batch_backfill_log;
