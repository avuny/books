CREATE TYPE "public"."inventory_adjustment_direction" AS ENUM('INCREASE', 'DECREASE', 'BOTH');--> statement-breakpoint
CREATE TYPE "public"."inventory_adjustment_status" AS ENUM('DRAFT', 'CONFIRMED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "inventory_adjustment_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"adjustment_id" uuid NOT NULL,
	"line_no" integer NOT NULL,
	"item_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"batch_id" uuid,
	"counted_quantity" numeric(18, 6) NOT NULL,
	"base_unit_id" uuid NOT NULL,
	"system_quantity_base" numeric(18, 6) NOT NULL,
	"counted_quantity_base" numeric(18, 6) NOT NULL,
	"quantity_delta_base" numeric(18, 6) NOT NULL,
	"snapshot_token" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_inventory_adjustment_line_no" UNIQUE("adjustment_id","line_no"),
	CONSTRAINT "ck_inventory_adjustment_line_notes_len" CHECK ("inventory_adjustment_lines"."notes" is null or char_length("inventory_adjustment_lines"."notes") <= 500)
);
--> statement-breakpoint
CREATE TABLE "inventory_adjustment_reasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"direction" "inventory_adjustment_direction" NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_inventory_adjustment_reason_code_len" CHECK (char_length("inventory_adjustment_reasons"."code") BETWEEN 1 AND 50),
	CONSTRAINT "ck_inventory_adjustment_reason_name_len" CHECK (char_length("inventory_adjustment_reasons"."name") BETWEEN 1 AND 100)
);
--> statement-breakpoint
CREATE TABLE "inventory_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"number" text NOT NULL,
	"reference_number" text,
	"date" date NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"reason_id" uuid NOT NULL,
	"description" text,
	"status" "inventory_adjustment_status" DEFAULT 'DRAFT' NOT NULL,
	"created_by" uuid,
	"confirmed_by" uuid,
	"confirmed_at" timestamp with time zone,
	"stock_movement_id" uuid,
	"journal_entry_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_inventory_adjustment_org_id" UNIQUE("org_id","id"),
	CONSTRAINT "ck_inventory_adjustment_number_fmt" CHECK ("inventory_adjustments"."number" ~ '^ADJ-[0-9]{6,}$'),
	CONSTRAINT "ck_inventory_adjustment_text_len" CHECK (("inventory_adjustments"."reference_number" is null or char_length("inventory_adjustments"."reference_number") <= 64) and ("inventory_adjustments"."description" is null or char_length("inventory_adjustments"."description") <= 500))
);
--> statement-breakpoint
ALTER TABLE "inventory_adjustment_lines" ADD CONSTRAINT "inventory_adjustment_lines_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_adjustment_lines" ADD CONSTRAINT "inventory_adjustment_lines_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_adjustment_lines" ADD CONSTRAINT "inventory_adjustment_lines_base_unit_id_units_id_fk" FOREIGN KEY ("base_unit_id") REFERENCES "public"."units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_adjustment_lines" ADD CONSTRAINT "fk_inventory_adjustment_line_adjustment" FOREIGN KEY ("org_id","adjustment_id") REFERENCES "public"."inventory_adjustments"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_adjustment_lines" ADD CONSTRAINT "fk_inventory_adjustment_line_item" FOREIGN KEY ("org_id","item_id") REFERENCES "public"."items"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_adjustment_lines" ADD CONSTRAINT "fk_inventory_adjustment_line_location" FOREIGN KEY ("org_id","location_id") REFERENCES "public"."warehouse_locations"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_adjustment_lines" ADD CONSTRAINT "fk_inventory_adjustment_line_batch" FOREIGN KEY ("org_id","batch_id") REFERENCES "public"."batches"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_adjustment_reasons" ADD CONSTRAINT "inventory_adjustment_reasons_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_reason_id_inventory_adjustment_reasons_id_fk" FOREIGN KEY ("reason_id") REFERENCES "public"."inventory_adjustment_reasons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "fk_inventory_adjustment_warehouse" FOREIGN KEY ("org_id","warehouse_id") REFERENCES "public"."warehouses"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "fk_inventory_adjustment_movement" FOREIGN KEY ("org_id","stock_movement_id") REFERENCES "public"."stock_movements"("org_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "fk_inventory_adjustment_journal" FOREIGN KEY ("org_id","journal_entry_id") REFERENCES "public"."journal_entries"("org_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_inventory_adjustment_line_item" ON "inventory_adjustment_lines" USING btree ("org_id","item_id");--> statement-breakpoint
CREATE INDEX "ix_inventory_adjustment_line_location" ON "inventory_adjustment_lines" USING btree ("org_id","location_id");--> statement-breakpoint
CREATE INDEX "ix_inventory_adjustment_line_batch" ON "inventory_adjustment_lines" USING btree ("org_id","batch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_inventory_adjustment_reason_system_code" ON "inventory_adjustment_reasons" USING btree ("code") WHERE "inventory_adjustment_reasons"."org_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "ux_inventory_adjustment_reason_org_code" ON "inventory_adjustment_reasons" USING btree ("org_id","code") WHERE "inventory_adjustment_reasons"."org_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "ux_inventory_adjustment_org_number" ON "inventory_adjustments" USING btree ("org_id","number");--> statement-breakpoint
CREATE INDEX "ix_inventory_adjustment_warehouse" ON "inventory_adjustments" USING btree ("org_id","warehouse_id");--> statement-breakpoint
CREATE INDEX "ix_inventory_adjustment_status" ON "inventory_adjustments" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "ix_inventory_adjustment_date" ON "inventory_adjustments" USING btree ("org_id","date");