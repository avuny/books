SELECT 'items converted' AS what, count(*)::text AS n FROM batch_backfill_log
UNION ALL SELECT 'legacy batches', count(*)::text FROM batch_backfill_log WHERE batch_id IS NOT NULL
UNION ALL SELECT 'batch stock rows', count(*)::text FROM inventory_item_batches b JOIN batch_backfill_log l ON l.batch_id = b.batch_id
UNION ALL SELECT 'movement lines still without batch (converted items)', count(*)::text FROM stock_movement_lines s JOIN batch_backfill_log l ON l.org_id = s.org_id AND l.item_id = s.item_id WHERE l.batch_id IS NOT NULL AND s.batch_id IS NULL
UNION ALL SELECT 'cost layers still without batch (converted items)', count(*)::text FROM inventory_cost_layers c JOIN batch_backfill_log l ON l.org_id = c.org_id AND l.item_id = c.item_id WHERE l.batch_id IS NOT NULL AND c.inventory_item_batch_id IS NULL
UNION ALL SELECT 'on-hand mismatches (parent vs batch rows, converted items)', count(*)::text FROM inventory_items ii JOIN batch_backfill_log l ON l.org_id = ii.org_id AND l.item_id = ii.item_id WHERE l.batch_id IS NOT NULL AND ii.on_hand_qty <> (SELECT coalesce(sum(b.on_hand_qty),0) FROM inventory_item_batches b WHERE b.inventory_item_id = ii.id)
UNION ALL SELECT 'inventory-tracked items still not batch-tracked', count(*)::text FROM items WHERE is_inventory_tracked AND NOT is_batch_tracked;
