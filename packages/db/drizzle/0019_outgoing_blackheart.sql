ALTER TABLE "inventory_adjustment_lines" DROP CONSTRAINT "fk_inventory_adjustment_line_batch";
--> statement-breakpoint
ALTER TABLE "inventory_adjustment_lines" ADD CONSTRAINT "fk_inventory_adjustment_line_batch" FOREIGN KEY ("org_id","item_id","batch_id") REFERENCES "public"."batches"("org_id","item_id","id") ON DELETE restrict ON UPDATE no action;