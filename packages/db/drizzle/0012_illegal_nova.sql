CREATE TYPE "public"."batch_status" AS ENUM('available', 'quarantined', 'blocked', 'recalled');--> statement-breakpoint
CREATE TYPE "public"."stock_movement_type" AS ENUM('opening', 'purchase', 'purchase_return', 'sale', 'sale_return', 'transfer', 'adjustment', 'assembly_consume', 'assembly_produce');--> statement-breakpoint
CREATE TABLE "batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"batch_number" text NOT NULL,
	"manufactured_on" date,
	"expires_on" date,
	"status" "batch_status" DEFAULT 'available' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_batch_org_item_id" UNIQUE("org_id","item_id","id"),
	CONSTRAINT "ck_batch_number_len" CHECK (char_length("batches"."batch_number") BETWEEN 1 AND 100),
	CONSTRAINT "ck_batch_number_trimmed" CHECK ("batches"."batch_number" = btrim("batches"."batch_number")),
	CONSTRAINT "ck_batch_dates" CHECK ("batches"."manufactured_on" is null or "batches"."expires_on" is null or "batches"."expires_on" >= "batches"."manufactured_on"),
	CONSTRAINT "ck_batch_notes_len" CHECK ("batches"."notes" is null or char_length("batches"."notes") <= 1000)
);
--> statement-breakpoint
CREATE TABLE "stock_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"batch_id" uuid,
	"quantity" numeric(18, 6) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_movement_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"movement_id" uuid NOT NULL,
	"line_no" smallint NOT NULL,
	"item_id" uuid NOT NULL,
	"batch_id" uuid,
	"from_location_id" uuid NOT NULL,
	"to_location_id" uuid NOT NULL,
	"quantity" numeric(18, 6) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_stock_movement_line_org_id" UNIQUE("org_id","id"),
	CONSTRAINT "ux_stock_movement_line_no" UNIQUE("movement_id","line_no"),
	CONSTRAINT "ck_stock_movement_line_quantity" CHECK ("stock_movement_lines"."quantity" > 0),
	CONSTRAINT "ck_stock_movement_line_sides" CHECK ("stock_movement_lines"."from_location_id" <> "stock_movement_lines"."to_location_id"),
	CONSTRAINT "ck_stock_movement_line_no" CHECK ("stock_movement_lines"."line_no" >= 1)
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"type" "stock_movement_type" NOT NULL,
	"posted_at" timestamp with time zone NOT NULL,
	"source_type" text,
	"source_id" uuid,
	"source_ref" text,
	"note" text,
	"reversal_of_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_stock_movement_org_id" UNIQUE("org_id","id"),
	CONSTRAINT "ck_stock_movement_source" CHECK ("stock_movements"."source_id" is null or "stock_movements"."source_type" is not null),
	CONSTRAINT "ck_stock_movement_text_len" CHECK (("stock_movements"."source_type" is null or char_length("stock_movements"."source_type") <= 40)
                and ("stock_movements"."source_ref" is null or char_length("stock_movements"."source_ref") <= 64)
                and ("stock_movements"."note" is null or char_length("stock_movements"."note") <= 500))
);
--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "batches_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "fk_batch_item" FOREIGN KEY ("org_id","item_id") REFERENCES "public"."items"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_balances" ADD CONSTRAINT "fk_stock_balance_location" FOREIGN KEY ("org_id","warehouse_id","location_id") REFERENCES "public"."warehouse_locations"("org_id","warehouse_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_balances" ADD CONSTRAINT "fk_stock_balance_warehouse" FOREIGN KEY ("org_id","warehouse_id") REFERENCES "public"."warehouses"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_balances" ADD CONSTRAINT "fk_stock_balance_batch" FOREIGN KEY ("org_id","item_id","batch_id") REFERENCES "public"."batches"("org_id","item_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_balances" ADD CONSTRAINT "fk_stock_balance_item" FOREIGN KEY ("org_id","item_id") REFERENCES "public"."items"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movement_lines" ADD CONSTRAINT "stock_movement_lines_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movement_lines" ADD CONSTRAINT "fk_stock_movement_line_movement" FOREIGN KEY ("org_id","movement_id") REFERENCES "public"."stock_movements"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movement_lines" ADD CONSTRAINT "fk_stock_movement_line_item" FOREIGN KEY ("org_id","item_id") REFERENCES "public"."items"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movement_lines" ADD CONSTRAINT "fk_stock_movement_line_batch" FOREIGN KEY ("org_id","item_id","batch_id") REFERENCES "public"."batches"("org_id","item_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movement_lines" ADD CONSTRAINT "fk_stock_movement_line_from_location" FOREIGN KEY ("org_id","from_location_id") REFERENCES "public"."warehouse_locations"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movement_lines" ADD CONSTRAINT "fk_stock_movement_line_to_location" FOREIGN KEY ("org_id","to_location_id") REFERENCES "public"."warehouse_locations"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "fk_stock_movement_reversal_of" FOREIGN KEY ("org_id","reversal_of_id") REFERENCES "public"."stock_movements"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ux_batch_org_item_number" ON "batches" USING btree ("org_id","item_id",lower("batch_number"));--> statement-breakpoint
CREATE INDEX "ix_batch_org_item_status_expiry" ON "batches" USING btree ("org_id","item_id","status","expires_on");--> statement-breakpoint
CREATE INDEX "ix_batch_org_expiry" ON "batches" USING btree ("org_id","expires_on") WHERE "batches"."expires_on" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "ux_stock_balance_no_batch" ON "stock_balances" USING btree ("org_id","location_id","item_id") WHERE "stock_balances"."batch_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "ux_stock_balance_batch" ON "stock_balances" USING btree ("org_id","location_id","item_id","batch_id") WHERE "stock_balances"."batch_id" is not null;--> statement-breakpoint
CREATE INDEX "ix_stock_balance_item" ON "stock_balances" USING btree ("org_id","item_id");--> statement-breakpoint
CREATE INDEX "ix_stock_balance_batch" ON "stock_balances" USING btree ("org_id","batch_id") WHERE "stock_balances"."batch_id" is not null;--> statement-breakpoint
CREATE INDEX "ix_stock_balance_warehouse_item" ON "stock_balances" USING btree ("org_id","warehouse_id","item_id");--> statement-breakpoint
CREATE INDEX "ix_stock_movement_line_item" ON "stock_movement_lines" USING btree ("org_id","item_id");--> statement-breakpoint
CREATE INDEX "ix_stock_movement_line_batch" ON "stock_movement_lines" USING btree ("org_id","batch_id") WHERE "stock_movement_lines"."batch_id" is not null;--> statement-breakpoint
CREATE INDEX "ix_stock_movement_line_from" ON "stock_movement_lines" USING btree ("org_id","from_location_id","item_id");--> statement-breakpoint
CREATE INDEX "ix_stock_movement_line_to" ON "stock_movement_lines" USING btree ("org_id","to_location_id","item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_stock_movement_org_source" ON "stock_movements" USING btree ("org_id","source_type","source_id") WHERE "stock_movements"."source_id" is not null and "stock_movements"."reversal_of_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "ux_stock_movement_org_reversal" ON "stock_movements" USING btree ("org_id","reversal_of_id") WHERE "stock_movements"."reversal_of_id" is not null;--> statement-breakpoint
CREATE INDEX "ix_stock_movement_org_posted" ON "stock_movements" USING btree ("org_id","posted_at");