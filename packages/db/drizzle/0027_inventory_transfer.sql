CREATE TYPE "public"."inventory_transfer_event_kind" AS ENUM('RECEIPT', 'RETURN', 'LOSS');--> statement-breakpoint
CREATE TYPE "public"."inventory_transfer_event_status" AS ENUM('POSTED', 'REVERSED');--> statement-breakpoint
CREATE TYPE "public"."inventory_transfer_status" AS ENUM('DRAFT', 'IN_TRANSIT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "inventory_transfer_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"line_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"batch_id" uuid,
	"dispatched_base_qty" numeric(18, 6) NOT NULL,
	"received_base_qty" numeric(18, 6) DEFAULT '0' NOT NULL,
	"lost_base_qty" numeric(18, 6) DEFAULT '0' NOT NULL,
	"returned_base_qty" numeric(18, 6) DEFAULT '0' NOT NULL,
	"dispatch_movement_line_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_inventory_transfer_allocation_org_id" UNIQUE("org_id","id"),
	CONSTRAINT "ux_inventory_transfer_allocation_movement_line" UNIQUE("org_id","dispatch_movement_line_id"),
	CONSTRAINT "ck_inventory_transfer_allocation_dispatched_positive" CHECK ("inventory_transfer_allocations"."dispatched_base_qty" > 0),
	CONSTRAINT "ck_inventory_transfer_allocation_counters" CHECK ("inventory_transfer_allocations"."received_base_qty" >= 0 and "inventory_transfer_allocations"."lost_base_qty" >= 0 and "inventory_transfer_allocations"."returned_base_qty" >= 0 and "inventory_transfer_allocations"."received_base_qty" + "inventory_transfer_allocations"."lost_base_qty" + "inventory_transfer_allocations"."returned_base_qty" <= "inventory_transfer_allocations"."dispatched_base_qty")
);
--> statement-breakpoint
CREATE TABLE "inventory_transfer_event_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"allocation_id" uuid NOT NULL,
	"destination_location_id" uuid,
	"base_quantity" numeric(18, 6) NOT NULL,
	"stock_movement_line_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_inventory_transfer_event_line_allocation" UNIQUE("event_id","allocation_id"),
	CONSTRAINT "ck_inventory_transfer_event_line_qty_positive" CHECK ("inventory_transfer_event_lines"."base_quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "inventory_transfer_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"transfer_id" uuid NOT NULL,
	"event_no" integer NOT NULL,
	"kind" "inventory_transfer_event_kind" NOT NULL,
	"status" "inventory_transfer_event_status" DEFAULT 'POSTED' NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"note" text,
	"stock_movement_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_inventory_transfer_event_org_id" UNIQUE("org_id","id"),
	CONSTRAINT "ux_inventory_transfer_event_no" UNIQUE("transfer_id","event_no"),
	CONSTRAINT "ck_inventory_transfer_event_text_len" CHECK ("inventory_transfer_events"."note" is null or char_length("inventory_transfer_events"."note") <= 500)
);
--> statement-breakpoint
CREATE TABLE "inventory_transfer_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"transfer_id" uuid NOT NULL,
	"line_no" integer NOT NULL,
	"item_id" uuid NOT NULL,
	"source_location_id" uuid NOT NULL,
	"destination_location_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"base_unit_id" uuid NOT NULL,
	"requested_qty" numeric(18, 6) NOT NULL,
	"requested_base_qty" numeric(18, 6) NOT NULL,
	"dispatched_base_qty" numeric(18, 6) DEFAULT '0' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_inventory_transfer_line_org_id" UNIQUE("org_id","id"),
	CONSTRAINT "ux_inventory_transfer_line_no" UNIQUE("transfer_id","line_no"),
	CONSTRAINT "ux_inventory_transfer_line_dimensions" UNIQUE("transfer_id","item_id","source_location_id","destination_location_id"),
	CONSTRAINT "ck_inventory_transfer_line_requested_positive" CHECK ("inventory_transfer_lines"."requested_base_qty" > 0),
	CONSTRAINT "ck_inventory_transfer_line_dispatched_bounds" CHECK ("inventory_transfer_lines"."dispatched_base_qty" >= 0),
	CONSTRAINT "ck_inventory_transfer_line_locations_differ" CHECK ("inventory_transfer_lines"."source_location_id" <> "inventory_transfer_lines"."destination_location_id"),
	CONSTRAINT "ck_inventory_transfer_line_text_len" CHECK ("inventory_transfer_lines"."notes" is null or char_length("inventory_transfer_lines"."notes") <= 500)
);
--> statement-breakpoint
CREATE TABLE "inventory_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"number" text NOT NULL,
	"reference_number" text,
	"date" date NOT NULL,
	"source_warehouse_id" uuid NOT NULL,
	"destination_warehouse_id" uuid NOT NULL,
	"description" text,
	"status" "inventory_transfer_status" DEFAULT 'DRAFT' NOT NULL,
	"dispatched_at" timestamp with time zone,
	"dispatched_by" uuid,
	"dispatch_stock_movement_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_inventory_transfer_org_id" UNIQUE("org_id","id"),
	CONSTRAINT "ux_inventory_transfer_org_number" UNIQUE("org_id","number"),
	CONSTRAINT "ck_inventory_transfer_number_fmt" CHECK ("inventory_transfers"."number" ~ '^TRF-[0-9]{6,}$'),
	CONSTRAINT "ck_inventory_transfer_text_len" CHECK (("inventory_transfers"."reference_number" is null or char_length("inventory_transfers"."reference_number") <= 64) and ("inventory_transfers"."description" is null or char_length("inventory_transfers"."description") <= 500))
);
--> statement-breakpoint
ALTER TABLE "inventory_transfer_allocations" ADD CONSTRAINT "inventory_transfer_allocations_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transfer_allocations" ADD CONSTRAINT "fk_inventory_transfer_allocation_line" FOREIGN KEY ("org_id","line_id") REFERENCES "public"."inventory_transfer_lines"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transfer_allocations" ADD CONSTRAINT "fk_inventory_transfer_allocation_item" FOREIGN KEY ("org_id","item_id") REFERENCES "public"."items"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transfer_allocations" ADD CONSTRAINT "fk_inventory_transfer_allocation_batch" FOREIGN KEY ("org_id","item_id","batch_id") REFERENCES "public"."batches"("org_id","item_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transfer_allocations" ADD CONSTRAINT "fk_inventory_transfer_allocation_movement_line" FOREIGN KEY ("org_id","dispatch_movement_line_id") REFERENCES "public"."stock_movement_lines"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transfer_event_lines" ADD CONSTRAINT "inventory_transfer_event_lines_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transfer_event_lines" ADD CONSTRAINT "fk_inventory_transfer_event_line_event" FOREIGN KEY ("org_id","event_id") REFERENCES "public"."inventory_transfer_events"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transfer_event_lines" ADD CONSTRAINT "fk_inventory_transfer_event_line_allocation" FOREIGN KEY ("org_id","allocation_id") REFERENCES "public"."inventory_transfer_allocations"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transfer_event_lines" ADD CONSTRAINT "fk_inventory_transfer_event_line_location" FOREIGN KEY ("org_id","destination_location_id") REFERENCES "public"."warehouse_locations"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transfer_event_lines" ADD CONSTRAINT "fk_inventory_transfer_event_line_movement_line" FOREIGN KEY ("org_id","stock_movement_line_id") REFERENCES "public"."stock_movement_lines"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transfer_events" ADD CONSTRAINT "inventory_transfer_events_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transfer_events" ADD CONSTRAINT "inventory_transfer_events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transfer_events" ADD CONSTRAINT "fk_inventory_transfer_event_transfer" FOREIGN KEY ("org_id","transfer_id") REFERENCES "public"."inventory_transfers"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transfer_events" ADD CONSTRAINT "fk_inventory_transfer_event_movement" FOREIGN KEY ("org_id","stock_movement_id") REFERENCES "public"."stock_movements"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transfer_lines" ADD CONSTRAINT "inventory_transfer_lines_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transfer_lines" ADD CONSTRAINT "inventory_transfer_lines_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transfer_lines" ADD CONSTRAINT "inventory_transfer_lines_base_unit_id_units_id_fk" FOREIGN KEY ("base_unit_id") REFERENCES "public"."units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transfer_lines" ADD CONSTRAINT "fk_inventory_transfer_line_transfer" FOREIGN KEY ("org_id","transfer_id") REFERENCES "public"."inventory_transfers"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transfer_lines" ADD CONSTRAINT "fk_inventory_transfer_line_item" FOREIGN KEY ("org_id","item_id") REFERENCES "public"."items"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transfer_lines" ADD CONSTRAINT "fk_inventory_transfer_line_source_location" FOREIGN KEY ("org_id","source_location_id") REFERENCES "public"."warehouse_locations"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transfer_lines" ADD CONSTRAINT "fk_inventory_transfer_line_destination_location" FOREIGN KEY ("org_id","destination_location_id") REFERENCES "public"."warehouse_locations"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_dispatched_by_users_id_fk" FOREIGN KEY ("dispatched_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "fk_inventory_transfer_source_warehouse" FOREIGN KEY ("org_id","source_warehouse_id") REFERENCES "public"."warehouses"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "fk_inventory_transfer_destination_warehouse" FOREIGN KEY ("org_id","destination_warehouse_id") REFERENCES "public"."warehouses"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transfers" ADD CONSTRAINT "fk_inventory_transfer_dispatch_movement" FOREIGN KEY ("org_id","dispatch_stock_movement_id") REFERENCES "public"."stock_movements"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_inventory_transfer_allocation_line" ON "inventory_transfer_allocations" USING btree ("org_id","line_id");--> statement-breakpoint
CREATE INDEX "ix_inventory_transfer_allocation_batch" ON "inventory_transfer_allocations" USING btree ("org_id","batch_id");--> statement-breakpoint
CREATE INDEX "ix_inventory_transfer_event_line_allocation" ON "inventory_transfer_event_lines" USING btree ("org_id","allocation_id");--> statement-breakpoint
CREATE INDEX "ix_inventory_transfer_event_transfer" ON "inventory_transfer_events" USING btree ("org_id","transfer_id");--> statement-breakpoint
CREATE INDEX "ix_inventory_transfer_line_item" ON "inventory_transfer_lines" USING btree ("org_id","item_id");--> statement-breakpoint
CREATE INDEX "ix_inventory_transfer_line_source_location" ON "inventory_transfer_lines" USING btree ("org_id","source_location_id");--> statement-breakpoint
CREATE INDEX "ix_inventory_transfer_line_destination_location" ON "inventory_transfer_lines" USING btree ("org_id","destination_location_id");--> statement-breakpoint
CREATE INDEX "ix_inventory_transfer_source_warehouse" ON "inventory_transfers" USING btree ("org_id","source_warehouse_id");--> statement-breakpoint
CREATE INDEX "ix_inventory_transfer_destination_warehouse" ON "inventory_transfers" USING btree ("org_id","destination_warehouse_id");--> statement-breakpoint
CREATE INDEX "ix_inventory_transfer_status" ON "inventory_transfers" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "ix_inventory_transfer_date" ON "inventory_transfers" USING btree ("org_id","date");