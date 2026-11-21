ALTER TABLE "inventory_item_batches" ADD COLUMN "on_order_qty" numeric(18, 6) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD COLUMN "on_order_qty" numeric(18, 6) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_item_batches" ADD CONSTRAINT "ck_inventory_item_batch_on_order_non_negative" CHECK ("inventory_item_batches"."on_order_qty" >= 0);--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "ck_inventory_item_on_order_non_negative" CHECK ("inventory_items"."on_order_qty" >= 0);