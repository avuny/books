CREATE TYPE "public"."sales_delivery_status" AS ENUM('DRAFT', 'POSTED', 'REVERSED');--> statement-breakpoint
CREATE TABLE "sales_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"number" text NOT NULL,
	"sales_order_id" uuid NOT NULL,
	"party_id" uuid NOT NULL,
	"delivery_date" date NOT NULL,
	"carrier" text,
	"tracking_number" text,
	"notes" text,
	"status" "sales_delivery_status" DEFAULT 'DRAFT' NOT NULL,
	"currency" char(3) NOT NULL,
	"total_cost" bigint DEFAULT 0 NOT NULL,
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
	CONSTRAINT "ux_sales_delivery_org_id" UNIQUE("org_id","id"),
	CONSTRAINT "ck_sales_delivery_number_fmt" CHECK ("sales_deliveries"."number" ~ '^DN-[0-9]{6,}$'),
	CONSTRAINT "ck_sales_delivery_text_len" CHECK (("sales_deliveries"."carrier" is null or char_length("sales_deliveries"."carrier") <= 100) and ("sales_deliveries"."tracking_number" is null or char_length("sales_deliveries"."tracking_number") <= 100) and ("sales_deliveries"."notes" is null or char_length("sales_deliveries"."notes") <= 1000) and ("sales_deliveries"."reverse_reason" is null or char_length("sales_deliveries"."reverse_reason") <= 500))
);
--> statement-breakpoint
CREATE TABLE "sales_delivery_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"sales_delivery_id" uuid NOT NULL,
	"line_no" integer NOT NULL,
	"sales_order_line_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"description_snapshot" text,
	"warehouse_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"base_unit_factor_snapshot" numeric(24, 12) NOT NULL,
	"quantity" numeric(18, 6) NOT NULL,
	"base_quantity" numeric(18, 6) NOT NULL,
	"cost_amount" bigint DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_sales_delivery_line_org_id" UNIQUE("org_id","id"),
	CONSTRAINT "ux_sales_delivery_line_no" UNIQUE("sales_delivery_id","line_no"),
	CONSTRAINT "ux_sales_delivery_line_order_line" UNIQUE("sales_delivery_id","sales_order_line_id"),
	CONSTRAINT "ck_sales_delivery_line_no_positive" CHECK ("sales_delivery_lines"."line_no" >= 1),
	CONSTRAINT "ck_sales_delivery_line_qty" CHECK ("sales_delivery_lines"."quantity" > 0 and "sales_delivery_lines"."base_quantity" > 0),
	CONSTRAINT "ck_sales_delivery_line_text_len" CHECK (("sales_delivery_lines"."notes" is null or char_length("sales_delivery_lines"."notes") <= 500))
);
--> statement-breakpoint
ALTER TABLE "sales_deliveries" ADD CONSTRAINT "sales_deliveries_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_deliveries" ADD CONSTRAINT "sales_deliveries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_deliveries" ADD CONSTRAINT "sales_deliveries_posted_by_users_id_fk" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_deliveries" ADD CONSTRAINT "sales_deliveries_reversed_by_users_id_fk" FOREIGN KEY ("reversed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_deliveries" ADD CONSTRAINT "fk_sales_delivery_order" FOREIGN KEY ("org_id","sales_order_id") REFERENCES "public"."sales_orders"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_deliveries" ADD CONSTRAINT "fk_sales_delivery_party" FOREIGN KEY ("org_id","party_id") REFERENCES "public"."parties"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_deliveries" ADD CONSTRAINT "fk_sales_delivery_movement" FOREIGN KEY ("org_id","stock_movement_id") REFERENCES "public"."stock_movements"("org_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_deliveries" ADD CONSTRAINT "fk_sales_delivery_journal" FOREIGN KEY ("org_id","journal_entry_id") REFERENCES "public"."journal_entries"("org_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_delivery_lines" ADD CONSTRAINT "sales_delivery_lines_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_delivery_lines" ADD CONSTRAINT "sales_delivery_lines_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_delivery_lines" ADD CONSTRAINT "fk_sales_delivery_line_delivery" FOREIGN KEY ("org_id","sales_delivery_id") REFERENCES "public"."sales_deliveries"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_delivery_lines" ADD CONSTRAINT "fk_sales_delivery_line_order_line" FOREIGN KEY ("org_id","sales_order_line_id") REFERENCES "public"."sales_order_lines"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_delivery_lines" ADD CONSTRAINT "fk_sales_delivery_line_item" FOREIGN KEY ("org_id","item_id") REFERENCES "public"."items"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_delivery_lines" ADD CONSTRAINT "fk_sales_delivery_line_warehouse" FOREIGN KEY ("org_id","warehouse_id") REFERENCES "public"."warehouses"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_delivery_lines" ADD CONSTRAINT "fk_sales_delivery_line_location" FOREIGN KEY ("org_id","warehouse_id","location_id") REFERENCES "public"."warehouse_locations"("org_id","warehouse_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ux_sales_delivery_org_number" ON "sales_deliveries" USING btree ("org_id","number");--> statement-breakpoint
CREATE INDEX "ix_sales_delivery_order" ON "sales_deliveries" USING btree ("org_id","sales_order_id");--> statement-breakpoint
CREATE INDEX "ix_sales_delivery_party" ON "sales_deliveries" USING btree ("org_id","party_id","delivery_date");--> statement-breakpoint
CREATE INDEX "ix_sales_delivery_status" ON "sales_deliveries" USING btree ("org_id","status","delivery_date");--> statement-breakpoint
CREATE INDEX "ix_sales_delivery_line_order_line" ON "sales_delivery_lines" USING btree ("org_id","sales_order_line_id");