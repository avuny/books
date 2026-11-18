CREATE TABLE "inventory_cost_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"outgoing_movement_line_id" uuid NOT NULL,
	"cost_layer_id" uuid NOT NULL,
	"allocated_qty" numeric(18, 6) NOT NULL,
	"allocated_value" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_inventory_cost_allocation_org_id" UNIQUE("org_id","id"),
	CONSTRAINT "ck_inventory_cost_allocation_qty_positive" CHECK ("inventory_cost_allocations"."allocated_qty" > 0),
	CONSTRAINT "ck_inventory_cost_allocation_value_non_negative" CHECK ("inventory_cost_allocations"."allocated_value" >= 0)
);
--> statement-breakpoint
CREATE TABLE "inventory_cost_layers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"inventory_item_batch_id" uuid,
	"source_movement_line_id" uuid NOT NULL,
	"origin_cost_layer_id" uuid,
	"received_qty" numeric(18, 6) NOT NULL,
	"remaining_qty" numeric(18, 6) NOT NULL,
	"received_value" bigint NOT NULL,
	"remaining_value" bigint NOT NULL,
	"currency" char(3) NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_inventory_cost_layer_org_id" UNIQUE("org_id","id"),
	CONSTRAINT "ck_inventory_cost_layer_received_qty_positive" CHECK ("inventory_cost_layers"."received_qty" > 0),
	CONSTRAINT "ck_inventory_cost_layer_remaining_qty_bounds" CHECK ("inventory_cost_layers"."remaining_qty" >= 0 and "inventory_cost_layers"."remaining_qty" <= "inventory_cost_layers"."received_qty"),
	CONSTRAINT "ck_inventory_cost_layer_received_value_non_negative" CHECK ("inventory_cost_layers"."received_value" >= 0),
	CONSTRAINT "ck_inventory_cost_layer_remaining_value_bounds" CHECK ("inventory_cost_layers"."remaining_value" >= 0 and "inventory_cost_layers"."remaining_value" <= "inventory_cost_layers"."received_value")
);
--> statement-breakpoint
ALTER TABLE "inventory_cost_allocations" ADD CONSTRAINT "inventory_cost_allocations_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_cost_allocations" ADD CONSTRAINT "fk_inventory_cost_allocation_outgoing_movement_line" FOREIGN KEY ("org_id","outgoing_movement_line_id") REFERENCES "public"."stock_movement_lines"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_cost_allocations" ADD CONSTRAINT "fk_inventory_cost_allocation_cost_layer" FOREIGN KEY ("org_id","cost_layer_id") REFERENCES "public"."inventory_cost_layers"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_cost_layers" ADD CONSTRAINT "inventory_cost_layers_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_cost_layers" ADD CONSTRAINT "fk_inventory_cost_layer_inventory_item" FOREIGN KEY ("org_id","inventory_item_id","item_id") REFERENCES "public"."inventory_items"("org_id","id","item_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_cost_layers" ADD CONSTRAINT "fk_inventory_cost_layer_inventory_item_batch" FOREIGN KEY ("org_id","inventory_item_batch_id","inventory_item_id","item_id") REFERENCES "public"."inventory_item_batches"("org_id","id","inventory_item_id","item_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_cost_layers" ADD CONSTRAINT "fk_inventory_cost_layer_source_movement_line" FOREIGN KEY ("org_id","source_movement_line_id") REFERENCES "public"."stock_movement_lines"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_cost_layers" ADD CONSTRAINT "fk_inventory_cost_layer_origin_cost_layer" FOREIGN KEY ("org_id","origin_cost_layer_id") REFERENCES "public"."inventory_cost_layers"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ux_inventory_cost_allocation_org_line_layer" ON "inventory_cost_allocations" USING btree ("org_id","outgoing_movement_line_id","cost_layer_id");--> statement-breakpoint
CREATE INDEX "ix_inventory_cost_allocation_org_cost_layer" ON "inventory_cost_allocations" USING btree ("org_id","cost_layer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_inventory_cost_layer_org_base_batch_source" ON "inventory_cost_layers" USING btree ("org_id","source_movement_line_id","inventory_item_id","inventory_item_batch_id") WHERE "inventory_cost_layers"."origin_cost_layer_id" is null and "inventory_cost_layers"."inventory_item_batch_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "ux_inventory_cost_layer_org_base_item_source" ON "inventory_cost_layers" USING btree ("org_id","source_movement_line_id","inventory_item_id") WHERE "inventory_cost_layers"."origin_cost_layer_id" is null and "inventory_cost_layers"."inventory_item_batch_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "ux_inventory_cost_layer_org_derived_source" ON "inventory_cost_layers" USING btree ("org_id","source_movement_line_id","inventory_item_id","origin_cost_layer_id") WHERE "inventory_cost_layers"."origin_cost_layer_id" is not null;--> statement-breakpoint
CREATE INDEX "ix_inventory_cost_layer_org_item_fifo" ON "inventory_cost_layers" USING btree ("org_id","inventory_item_id","received_at","id") WHERE "inventory_cost_layers"."remaining_qty" > 0;--> statement-breakpoint
CREATE INDEX "ix_inventory_cost_layer_org_batch_fifo" ON "inventory_cost_layers" USING btree ("org_id","inventory_item_batch_id","received_at","id") WHERE "inventory_cost_layers"."inventory_item_batch_id" is not null and "inventory_cost_layers"."remaining_qty" > 0;--> statement-breakpoint
CREATE INDEX "ix_inventory_cost_layer_org_source_movement_line" ON "inventory_cost_layers" USING btree ("org_id","source_movement_line_id");--> statement-breakpoint
CREATE INDEX "ix_inventory_cost_layer_org_origin_cost_layer" ON "inventory_cost_layers" USING btree ("org_id","origin_cost_layer_id") WHERE "inventory_cost_layers"."origin_cost_layer_id" is not null;