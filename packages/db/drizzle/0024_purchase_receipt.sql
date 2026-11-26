CREATE TYPE "public"."purchase_receipt_status" AS ENUM('DRAFT', 'POSTED', 'REVERSED');--> statement-breakpoint
CREATE TABLE "purchase_receipt_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"purchase_receipt_id" uuid NOT NULL,
	"line_no" integer NOT NULL,
	"purchase_order_line_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"base_unit_factor_snapshot" numeric(24, 12) NOT NULL,
	"received_qty" numeric(18, 6) NOT NULL,
	"accepted_qty" numeric(18, 6) NOT NULL,
	"rejected_qty" numeric(18, 6) DEFAULT '0' NOT NULL,
	"received_base_qty" numeric(18, 6) NOT NULL,
	"accepted_base_qty" numeric(18, 6) NOT NULL,
	"rejected_base_qty" numeric(18, 6) DEFAULT '0' NOT NULL,
	"is_direct" boolean DEFAULT false NOT NULL,
	"batch_id" uuid,
	"unit_cost_snapshot" bigint DEFAULT 0 NOT NULL,
	"receipt_value" bigint DEFAULT 0 NOT NULL,
	"rejection_reason" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_purchase_receipt_line_no" UNIQUE("purchase_receipt_id","line_no"),
	CONSTRAINT "ux_purchase_receipt_line_order_line" UNIQUE("purchase_receipt_id","purchase_order_line_id"),
	CONSTRAINT "ck_purchase_receipt_line_qty" CHECK ("purchase_receipt_lines"."received_qty" > 0 and "purchase_receipt_lines"."accepted_qty" >= 0 and "purchase_receipt_lines"."rejected_qty" >= 0 and "purchase_receipt_lines"."received_qty" = "purchase_receipt_lines"."accepted_qty" + "purchase_receipt_lines"."rejected_qty" and "purchase_receipt_lines"."received_base_qty" > 0 and "purchase_receipt_lines"."accepted_base_qty" >= 0 and "purchase_receipt_lines"."rejected_base_qty" >= 0 and "purchase_receipt_lines"."received_base_qty" = "purchase_receipt_lines"."accepted_base_qty" + "purchase_receipt_lines"."rejected_base_qty"),
	CONSTRAINT "ck_purchase_receipt_line_rejection_reason" CHECK ("purchase_receipt_lines"."rejected_qty" = 0 or ("purchase_receipt_lines"."rejection_reason" is not null and char_length(btrim("purchase_receipt_lines"."rejection_reason")) > 0)),
	CONSTRAINT "ck_purchase_receipt_line_text_len" CHECK (("purchase_receipt_lines"."notes" is null or char_length("purchase_receipt_lines"."notes") <= 500) and ("purchase_receipt_lines"."rejection_reason" is null or char_length("purchase_receipt_lines"."rejection_reason") <= 500))
);
--> statement-breakpoint
CREATE TABLE "purchase_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"number" text NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"party_id" uuid NOT NULL,
	"receipt_date" date NOT NULL,
	"supplier_delivery_reference" text,
	"notes" text,
	"status" "purchase_receipt_status" DEFAULT 'DRAFT' NOT NULL,
	"currency" char(3) NOT NULL,
	"total_value" bigint DEFAULT 0 NOT NULL,
	"stock_movement_id" uuid,
	"journal_entry_id" uuid,
	"created_by" uuid,
	"posted_by" uuid,
	"posted_at" timestamp with time zone,
	"reversed_by" uuid,
	"reversed_at" timestamp with time zone,
	"reverse_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_purchase_receipt_org_id" UNIQUE("org_id","id"),
	CONSTRAINT "ck_purchase_receipt_number_fmt" CHECK ("purchase_receipts"."number" ~ '^PR-[0-9]{6,}$'),
	CONSTRAINT "ck_purchase_receipt_text_len" CHECK (("purchase_receipts"."supplier_delivery_reference" is null or char_length("purchase_receipts"."supplier_delivery_reference") <= 100) and ("purchase_receipts"."notes" is null or char_length("purchase_receipts"."notes") <= 1000) and ("purchase_receipts"."reverse_reason" is null or char_length("purchase_receipts"."reverse_reason") <= 500))
);
--> statement-breakpoint
ALTER TABLE "purchase_receipt_lines" ADD CONSTRAINT "purchase_receipt_lines_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_receipt_lines" ADD CONSTRAINT "purchase_receipt_lines_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_receipt_lines" ADD CONSTRAINT "fk_purchase_receipt_line_receipt" FOREIGN KEY ("org_id","purchase_receipt_id") REFERENCES "public"."purchase_receipts"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_receipt_lines" ADD CONSTRAINT "fk_purchase_receipt_line_order_line" FOREIGN KEY ("org_id","purchase_order_line_id") REFERENCES "public"."purchase_order_lines"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_receipt_lines" ADD CONSTRAINT "fk_purchase_receipt_line_item" FOREIGN KEY ("org_id","item_id") REFERENCES "public"."items"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_receipt_lines" ADD CONSTRAINT "fk_purchase_receipt_line_warehouse" FOREIGN KEY ("org_id","warehouse_id") REFERENCES "public"."warehouses"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_receipt_lines" ADD CONSTRAINT "fk_purchase_receipt_line_location" FOREIGN KEY ("org_id","warehouse_id","location_id") REFERENCES "public"."warehouse_locations"("org_id","warehouse_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_receipt_lines" ADD CONSTRAINT "fk_purchase_receipt_line_batch" FOREIGN KEY ("org_id","item_id","batch_id") REFERENCES "public"."batches"("org_id","item_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_posted_by_users_id_fk" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_reversed_by_users_id_fk" FOREIGN KEY ("reversed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "fk_purchase_receipt_order" FOREIGN KEY ("org_id","purchase_order_id") REFERENCES "public"."purchase_orders"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "fk_purchase_receipt_party" FOREIGN KEY ("org_id","party_id") REFERENCES "public"."parties"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "fk_purchase_receipt_movement" FOREIGN KEY ("org_id","stock_movement_id") REFERENCES "public"."stock_movements"("org_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "fk_purchase_receipt_journal" FOREIGN KEY ("org_id","journal_entry_id") REFERENCES "public"."journal_entries"("org_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_purchase_receipt_line_order_line" ON "purchase_receipt_lines" USING btree ("org_id","purchase_order_line_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_purchase_receipt_org_number" ON "purchase_receipts" USING btree ("org_id","number");--> statement-breakpoint
CREATE INDEX "ix_purchase_receipt_order" ON "purchase_receipts" USING btree ("org_id","purchase_order_id");--> statement-breakpoint
CREATE INDEX "ix_purchase_receipt_status" ON "purchase_receipts" USING btree ("org_id","status");