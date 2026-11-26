CREATE TYPE "public"."inventory_reservation_status" AS ENUM('ACTIVE', 'CLOSED');--> statement-breakpoint
CREATE TABLE "inventory_item_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"batch_id" uuid NOT NULL,
	"on_hand_qty" numeric(18, 6) DEFAULT '0' NOT NULL,
	"reserved_qty" numeric(18, 6) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_inventory_item_batch_org_parent_batch" UNIQUE("org_id","inventory_item_id","batch_id"),
	CONSTRAINT "ux_inventory_item_batch_org_id_parent_item" UNIQUE("org_id","id","inventory_item_id","item_id"),
	CONSTRAINT "ck_inventory_item_batch_reserved_non_negative" CHECK ("inventory_item_batches"."reserved_qty" >= 0)
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"on_hand_qty" numeric(18, 6) DEFAULT '0' NOT NULL,
	"reserved_qty" numeric(18, 6) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_inventory_item_org_item_location" UNIQUE("org_id","item_id","location_id"),
	CONSTRAINT "ux_inventory_item_org_id_item" UNIQUE("org_id","id","item_id"),
	CONSTRAINT "ck_inventory_item_reserved_non_negative" CHECK ("inventory_items"."reserved_qty" >= 0)
);
--> statement-breakpoint
CREATE TABLE "inventory_reservation_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"reservation_id" uuid NOT NULL,
	"source_line_id" uuid,
	"item_id" uuid NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"inventory_item_batch_id" uuid,
	"reserved_qty" numeric(18, 6) NOT NULL,
	"consumed_qty" numeric(18, 6) DEFAULT '0' NOT NULL,
	"released_qty" numeric(18, 6) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_inventory_reservation_allocation_org_id" UNIQUE("org_id","id"),
	CONSTRAINT "ck_inventory_reservation_allocation_reserved_positive" CHECK ("inventory_reservation_allocations"."reserved_qty" > 0),
	CONSTRAINT "ck_inventory_reservation_allocation_consumed_non_negative" CHECK ("inventory_reservation_allocations"."consumed_qty" >= 0),
	CONSTRAINT "ck_inventory_reservation_allocation_released_non_negative" CHECK ("inventory_reservation_allocations"."released_qty" >= 0),
	CONSTRAINT "ck_inventory_reservation_allocation_not_over_processed" CHECK ("inventory_reservation_allocations"."consumed_qty" + "inventory_reservation_allocations"."released_qty" <= "inventory_reservation_allocations"."reserved_qty")
);
--> statement-breakpoint
CREATE TABLE "inventory_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"source_type" text NOT NULL,
	"source_id" uuid NOT NULL,
	"source_ref" text,
	"status" "inventory_reservation_status" DEFAULT 'ACTIVE' NOT NULL,
	"closed_at" timestamp with time zone,
	"note" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_inventory_reservation_org_id" UNIQUE("org_id","id"),
	CONSTRAINT "ck_inventory_reservation_source_type_len" CHECK (char_length("inventory_reservations"."source_type") >= 1
                and char_length("inventory_reservations"."source_type") <= 64
                and "inventory_reservations"."source_type" = btrim("inventory_reservations"."source_type")),
	CONSTRAINT "ck_inventory_reservation_source_ref_len" CHECK ("inventory_reservations"."source_ref" is null
                or char_length("inventory_reservations"."source_ref") <= 100),
	CONSTRAINT "ck_inventory_reservation_note_len" CHECK ("inventory_reservations"."note" is null
                or char_length("inventory_reservations"."note") <= 1000),
	CONSTRAINT "ck_inventory_reservation_closed_at" CHECK (("inventory_reservations"."status" = 'ACTIVE' and "inventory_reservations"."closed_at" is null)
                or ("inventory_reservations"."status" = 'CLOSED' and "inventory_reservations"."closed_at" is not null))
);
--> statement-breakpoint
ALTER TABLE IF EXISTS "stock_balances" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE IF EXISTS "stock_balances" CASCADE;--> statement-breakpoint
ALTER TABLE "batches" DROP CONSTRAINT IF EXISTS "ck_batch_cost_non_negative";--> statement-breakpoint
ALTER TABLE "batches" DROP CONSTRAINT IF EXISTS "ck_batch_quantity_non_negative";--> statement-breakpoint
ALTER TABLE "batches" DROP CONSTRAINT IF EXISTS "ck_batch_shelf_life_unit_and_value";--> statement-breakpoint
ALTER TABLE "batches" DROP CONSTRAINT IF EXISTS "ck_batch_shelf_life_positive_value";--> statement-breakpoint
ALTER TABLE "inventory_item_batches" ADD CONSTRAINT "inventory_item_batches_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_item_batches" ADD CONSTRAINT "fk_inventory_item_batch_inventory_item" FOREIGN KEY ("org_id","inventory_item_id","item_id") REFERENCES "public"."inventory_items"("org_id","id","item_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_item_batches" ADD CONSTRAINT "fk_inventory_item_batch_batch" FOREIGN KEY ("org_id","item_id","batch_id") REFERENCES "public"."batches"("org_id","item_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "fk_inventory_item_item" FOREIGN KEY ("org_id","item_id") REFERENCES "public"."items"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "fk_inventory_item_location" FOREIGN KEY ("org_id","warehouse_id","location_id") REFERENCES "public"."warehouse_locations"("org_id","warehouse_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "fk_inventory_item_warehouse" FOREIGN KEY ("org_id","warehouse_id") REFERENCES "public"."warehouses"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_reservation_allocations" ADD CONSTRAINT "inventory_reservation_allocations_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_reservation_allocations" ADD CONSTRAINT "fk_inventory_reservation_allocation_reservation" FOREIGN KEY ("org_id","reservation_id") REFERENCES "public"."inventory_reservations"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_reservation_allocations" ADD CONSTRAINT "fk_inventory_reservation_allocation_inventory_item" FOREIGN KEY ("org_id","inventory_item_id","item_id") REFERENCES "public"."inventory_items"("org_id","id","item_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_reservation_allocations" ADD CONSTRAINT "fk_inventory_reservation_allocation_inventory_batch" FOREIGN KEY ("org_id","inventory_item_batch_id","inventory_item_id","item_id") REFERENCES "public"."inventory_item_batches"("org_id","id","inventory_item_id","item_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_inventory_item_batch_org_batch" ON "inventory_item_batches" USING btree ("org_id","batch_id");--> statement-breakpoint
CREATE INDEX "ix_inventory_item_batch_inventory_item" ON "inventory_item_batches" USING btree ("org_id","inventory_item_id");--> statement-breakpoint
CREATE INDEX "ix_inventory_item_batch_org_item" ON "inventory_item_batches" USING btree ("org_id","item_id");--> statement-breakpoint
CREATE INDEX "ix_inventory_item_org_location" ON "inventory_items" USING btree ("org_id","location_id");--> statement-breakpoint
CREATE INDEX "ix_inventory_item_org_warehouse_item" ON "inventory_items" USING btree ("org_id","warehouse_id","item_id");--> statement-breakpoint
CREATE INDEX "ix_inventory_item_org_item" ON "inventory_items" USING btree ("org_id","item_id");--> statement-breakpoint
CREATE INDEX "ix_inventory_reservation_allocation_reservation" ON "inventory_reservation_allocations" USING btree ("org_id","reservation_id");--> statement-breakpoint
CREATE INDEX "ix_inventory_reservation_allocation_source_line" ON "inventory_reservation_allocations" USING btree ("org_id","source_line_id") WHERE "inventory_reservation_allocations"."source_line_id" is not null;--> statement-breakpoint
CREATE INDEX "ix_inventory_reservation_allocation_inventory_item" ON "inventory_reservation_allocations" USING btree ("org_id","inventory_item_id");--> statement-breakpoint
CREATE INDEX "ix_inventory_reservation_allocation_batch" ON "inventory_reservation_allocations" USING btree ("org_id","inventory_item_batch_id") WHERE "inventory_reservation_allocations"."inventory_item_batch_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "ux_inventory_reservation_org_source" ON "inventory_reservations" USING btree ("org_id","source_type","source_id");--> statement-breakpoint
CREATE INDEX "ix_inventory_reservation_org_status" ON "inventory_reservations" USING btree ("org_id","status");--> statement-breakpoint
ALTER TABLE "batches" DROP COLUMN IF EXISTS "cost";--> statement-breakpoint
ALTER TABLE "batches" DROP COLUMN IF EXISTS "quantity";--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "ck_batch_shelf_life_unit_and_value" CHECK (("batches"."shelf_life_value" is null and "batches"."shelf_life_unit" is null)
                or ("batches"."shelf_life_value" is not null and "batches"."shelf_life_unit" is not null));--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "ck_batch_shelf_life_positive_value" CHECK ("batches"."shelf_life_value" is null or "batches"."shelf_life_value" > 0);