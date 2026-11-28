CREATE TYPE "public"."inventory_cost_allocation_kind" AS ENUM('ISSUE', 'CONVERSION');--> statement-breakpoint
CREATE TYPE "public"."inventory_cost_entry_kind" AS ENUM('RECEIPT', 'ISSUE', 'REVERSAL_IN', 'REVERSAL_OUT', 'REVALUATION', 'CONVERSION');--> statement-breakpoint
CREATE TYPE "public"."inventory_cost_source" AS ENUM('DOCUMENT', 'USER', 'INHERITED', 'CONFIRMED_PROPOSAL', 'METHOD', 'CONVERSION');--> statement-breakpoint
CREATE TABLE "inventory_cost_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"pool_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"movement_line_id" uuid,
	"kind" "inventory_cost_entry_kind" NOT NULL,
	"qty_delta" numeric(18, 6) NOT NULL,
	"value_delta" bigint NOT NULL,
	"qty_after" numeric(18, 6) NOT NULL,
	"value_after" bigint NOT NULL,
	"unit_cost" numeric(30, 10) NOT NULL,
	"seq" bigint NOT NULL,
	"cost_source" "inventory_cost_source" NOT NULL,
	"is_zero_cost" boolean DEFAULT false NOT NULL,
	"zero_cost_reason" text,
	"proposed_value_minor" bigint,
	"source_entry_id" uuid,
	"reverses_entry_id" uuid,
	"currency" char(3) NOT NULL,
	"effective_at" timestamp with time zone NOT NULL,
	"is_backdated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	CONSTRAINT "ux_inventory_cost_entry_org_id" UNIQUE("org_id","id"),
	CONSTRAINT "ux_inventory_cost_entry_org_pool_seq" UNIQUE("org_id","pool_id","seq"),
	CONSTRAINT "ck_inventory_cost_entry_seq_positive" CHECK ("inventory_cost_entries"."seq" > 0),
	CONSTRAINT "ck_inventory_cost_entry_qty_after_non_negative" CHECK ("inventory_cost_entries"."qty_after" >= 0),
	CONSTRAINT "ck_inventory_cost_entry_value_after_non_negative" CHECK ("inventory_cost_entries"."value_after" >= 0),
	CONSTRAINT "ck_inventory_cost_entry_empty_has_no_value" CHECK ("inventory_cost_entries"."qty_after" > 0 or "inventory_cost_entries"."value_after" = 0),
	CONSTRAINT "ck_inventory_cost_entry_movement_line_required" CHECK ("inventory_cost_entries"."movement_line_id" is not null or "inventory_cost_entries"."kind" in ('CONVERSION', 'REVALUATION')),
	CONSTRAINT "ck_inventory_cost_entry_zero_reason" CHECK (("inventory_cost_entries"."zero_cost_reason" is null or "inventory_cost_entries"."zero_cost_reason" in ('SAMPLE', 'PROMOTION', 'FREE_ISSUE', 'OTHER')) and ("inventory_cost_entries"."is_zero_cost" = false or "inventory_cost_entries"."cost_source" = 'INHERITED' or "inventory_cost_entries"."zero_cost_reason" is not null))
);
--> statement-breakpoint
CREATE TABLE "inventory_cost_pools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"scope_warehouse_id" uuid,
	"currency" char(3) NOT NULL,
	"on_hand_qty" numeric(18, 6) DEFAULT '0' NOT NULL,
	"total_value" bigint DEFAULT 0 NOT NULL,
	"avg_unit_cost" numeric(30, 10) DEFAULT '0' NOT NULL,
	"last_unit_cost" numeric(30, 10) DEFAULT '0' NOT NULL,
	"seq" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_inventory_cost_pool_org_id" UNIQUE("org_id","id"),
	CONSTRAINT "ck_inventory_cost_pool_qty_non_negative" CHECK ("inventory_cost_pools"."on_hand_qty" >= 0),
	CONSTRAINT "ck_inventory_cost_pool_value_non_negative" CHECK ("inventory_cost_pools"."total_value" >= 0),
	CONSTRAINT "ck_inventory_cost_pool_empty_has_no_value" CHECK ("inventory_cost_pools"."on_hand_qty" > 0 or "inventory_cost_pools"."total_value" = 0),
	CONSTRAINT "ck_inventory_cost_pool_seq_non_negative" CHECK ("inventory_cost_pools"."seq" >= 0)
);
--> statement-breakpoint
ALTER TABLE "inventory_cost_allocations" ALTER COLUMN "outgoing_movement_line_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_cost_allocations" ADD COLUMN "kind" "inventory_cost_allocation_kind" DEFAULT 'ISSUE' NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_cost_allocations" ADD COLUMN "conversion_entry_id" uuid;--> statement-breakpoint
ALTER TABLE "inventory_cost_layers" ADD COLUMN "cost_source" "inventory_cost_source";--> statement-breakpoint
ALTER TABLE "inventory_cost_layers" ADD COLUMN "is_zero_cost" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_cost_layers" ADD COLUMN "needs_review" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_adjustment_lines" ADD COLUMN "cost_value_minor" bigint;--> statement-breakpoint
ALTER TABLE "inventory_adjustment_lines" ADD COLUMN "unit_cost" numeric(30, 10);--> statement-breakpoint
ALTER TABLE "inventory_adjustment_lines" ADD COLUMN "cost_source" "inventory_cost_source";--> statement-breakpoint
ALTER TABLE "inventory_adjustment_lines" ADD COLUMN "is_zero_cost" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory_adjustment_lines" ADD COLUMN "zero_cost_reason" text;--> statement-breakpoint
ALTER TABLE "inventory_adjustment_lines" ADD COLUMN "proposed_unit_cost" numeric(30, 10);--> statement-breakpoint
ALTER TABLE "inventory_cost_entries" ADD CONSTRAINT "inventory_cost_entries_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_cost_entries" ADD CONSTRAINT "inventory_cost_entries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_cost_entries" ADD CONSTRAINT "fk_inventory_cost_entry_pool" FOREIGN KEY ("org_id","pool_id") REFERENCES "public"."inventory_cost_pools"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_cost_entries" ADD CONSTRAINT "fk_inventory_cost_entry_item" FOREIGN KEY ("org_id","item_id") REFERENCES "public"."items"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_cost_entries" ADD CONSTRAINT "fk_inventory_cost_entry_movement_line" FOREIGN KEY ("org_id","movement_line_id") REFERENCES "public"."stock_movement_lines"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_cost_entries" ADD CONSTRAINT "fk_inventory_cost_entry_source_entry" FOREIGN KEY ("org_id","source_entry_id") REFERENCES "public"."inventory_cost_entries"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_cost_entries" ADD CONSTRAINT "fk_inventory_cost_entry_reverses_entry" FOREIGN KEY ("org_id","reverses_entry_id") REFERENCES "public"."inventory_cost_entries"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_cost_pools" ADD CONSTRAINT "inventory_cost_pools_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_cost_pools" ADD CONSTRAINT "fk_inventory_cost_pool_item" FOREIGN KEY ("org_id","item_id") REFERENCES "public"."items"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_cost_pools" ADD CONSTRAINT "fk_inventory_cost_pool_warehouse" FOREIGN KEY ("org_id","scope_warehouse_id") REFERENCES "public"."warehouses"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ux_inventory_cost_entry_org_movement_line" ON "inventory_cost_entries" USING btree ("org_id","movement_line_id") WHERE "inventory_cost_entries"."movement_line_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "ux_inventory_cost_entry_org_reverses" ON "inventory_cost_entries" USING btree ("org_id","reverses_entry_id") WHERE "inventory_cost_entries"."reverses_entry_id" is not null;--> statement-breakpoint
CREATE INDEX "ix_inventory_cost_entry_org_item_seq" ON "inventory_cost_entries" USING btree ("org_id","item_id","seq");--> statement-breakpoint
CREATE INDEX "ix_inventory_cost_entry_org_source_entry" ON "inventory_cost_entries" USING btree ("org_id","source_entry_id") WHERE "inventory_cost_entries"."source_entry_id" is not null;--> statement-breakpoint
CREATE INDEX "ix_inventory_cost_entry_org_effective" ON "inventory_cost_entries" USING btree ("org_id","effective_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_inventory_cost_pool_org_item_global" ON "inventory_cost_pools" USING btree ("org_id","item_id") WHERE "inventory_cost_pools"."scope_warehouse_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "ux_inventory_cost_pool_org_item_warehouse" ON "inventory_cost_pools" USING btree ("org_id","item_id","scope_warehouse_id") WHERE "inventory_cost_pools"."scope_warehouse_id" is not null;--> statement-breakpoint
ALTER TABLE "inventory_cost_allocations" ADD CONSTRAINT "fk_inventory_cost_allocation_conversion_entry" FOREIGN KEY ("org_id","conversion_entry_id") REFERENCES "public"."inventory_cost_entries"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_cost_allocations" ADD CONSTRAINT "ck_inventory_cost_allocation_kind_link" CHECK (("inventory_cost_allocations"."kind" = 'ISSUE' and "inventory_cost_allocations"."outgoing_movement_line_id" is not null and "inventory_cost_allocations"."conversion_entry_id" is null) or ("inventory_cost_allocations"."kind" = 'CONVERSION' and "inventory_cost_allocations"."outgoing_movement_line_id" is null and "inventory_cost_allocations"."conversion_entry_id" is not null));--> statement-breakpoint
ALTER TABLE "inventory_adjustment_lines" ADD CONSTRAINT "ck_inventory_adjustment_line_cost_non_negative" CHECK ("inventory_adjustment_lines"."cost_value_minor" is null or "inventory_adjustment_lines"."cost_value_minor" >= 0);