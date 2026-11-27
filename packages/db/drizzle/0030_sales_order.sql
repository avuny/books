CREATE TYPE "public"."sales_order_status" AS ENUM('DRAFT', 'CONFIRMED', 'CLOSED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "sales_order_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"sales_order_id" uuid NOT NULL,
	"line_no" integer NOT NULL,
	"item_id" uuid NOT NULL,
	"description_snapshot" text,
	"warehouse_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"base_unit_factor_snapshot" numeric(24, 12) NOT NULL,
	"ordered_qty" numeric(18, 6) NOT NULL,
	"ordered_base_qty" numeric(18, 6) NOT NULL,
	"reserved_base_qty" numeric(18, 6) DEFAULT '0' NOT NULL,
	"delivered_base_qty" numeric(18, 6) DEFAULT '0' NOT NULL,
	"invoiced_base_qty" numeric(18, 6) DEFAULT '0' NOT NULL,
	"cancelled_base_qty" numeric(18, 6) DEFAULT '0' NOT NULL,
	"unit_price" bigint NOT NULL,
	"discount_amount" bigint DEFAULT 0 NOT NULL,
	"discount_rate_bps" integer DEFAULT 0 NOT NULL,
	"tax_rate_bps" integer DEFAULT 0 NOT NULL,
	"line_net_amount" bigint NOT NULL,
	"tax_amount" bigint DEFAULT 0 NOT NULL,
	"line_total_amount" bigint DEFAULT 0 NOT NULL,
	"requested_delivery_date" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_sales_order_line_org_id" UNIQUE("org_id","id"),
	CONSTRAINT "ux_sales_order_line_no" UNIQUE("sales_order_id","line_no"),
	CONSTRAINT "ck_sales_order_line_ordered_positive" CHECK ("sales_order_lines"."ordered_qty" > 0 and "sales_order_lines"."ordered_base_qty" > 0),
	CONSTRAINT "ck_sales_order_line_counters_non_negative" CHECK ("sales_order_lines"."reserved_base_qty" >= 0 and "sales_order_lines"."delivered_base_qty" >= 0 and "sales_order_lines"."invoiced_base_qty" >= 0 and "sales_order_lines"."cancelled_base_qty" >= 0),
	CONSTRAINT "ck_sales_order_line_delivered_within_ordered" CHECK ("sales_order_lines"."delivered_base_qty" + "sales_order_lines"."cancelled_base_qty" <= "sales_order_lines"."ordered_base_qty"),
	CONSTRAINT "ck_sales_order_line_reserved_within_ordered" CHECK ("sales_order_lines"."reserved_base_qty" + "sales_order_lines"."cancelled_base_qty" <= "sales_order_lines"."ordered_base_qty"),
	CONSTRAINT "ck_sales_order_line_amount_max" CHECK ("sales_order_lines"."unit_price" between 0 and 999999999999999 and "sales_order_lines"."discount_amount" between 0 and 999999999999999 and "sales_order_lines"."line_net_amount" between 0 and 999999999999999),
	CONSTRAINT "ck_sales_order_line_rate_bps" CHECK ("sales_order_lines"."discount_rate_bps" between 0 and 10000 and "sales_order_lines"."tax_rate_bps" between 0 and 10000),
	CONSTRAINT "ck_sales_order_line_tax_amount" CHECK ("sales_order_lines"."tax_amount" between 0 and 999999999999999 and "sales_order_lines"."line_total_amount" between 0 and 999999999999999),
	CONSTRAINT "ck_sales_order_line_text_len" CHECK (("sales_order_lines"."notes" is null or char_length("sales_order_lines"."notes") <= 500) and ("sales_order_lines"."description_snapshot" is null or char_length("sales_order_lines"."description_snapshot") <= 500))
);
--> statement-breakpoint
CREATE TABLE "sales_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"number" text NOT NULL,
	"party_id" uuid NOT NULL,
	"order_date" date NOT NULL,
	"requested_delivery_date" date,
	"payment_term_id" uuid,
	"payment_term_name_snapshot" text,
	"payment_term_method_snapshot" "payment_term_method",
	"payment_term_days_snapshot" integer,
	"currency" char(3) NOT NULL,
	"warehouse_id" uuid,
	"customer_reference" text,
	"notes" text,
	"status" "sales_order_status" DEFAULT 'DRAFT' NOT NULL,
	"subtotal_amount" bigint DEFAULT 0 NOT NULL,
	"discount_amount" bigint DEFAULT 0 NOT NULL,
	"tax_amount" bigint DEFAULT 0 NOT NULL,
	"total_amount" bigint DEFAULT 0 NOT NULL,
	"close_reason" text,
	"created_by" uuid,
	"confirmed_by" uuid,
	"confirmed_at" timestamp with time zone,
	"closed_by" uuid,
	"closed_at" timestamp with time zone,
	"cancelled_by" uuid,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_sales_order_org_id" UNIQUE("org_id","id"),
	CONSTRAINT "ck_sales_order_number_fmt" CHECK ("sales_orders"."number" ~ '^SO-[0-9]{6,}$'),
	CONSTRAINT "ck_sales_order_currency_fmt" CHECK ("sales_orders"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "ck_sales_order_text_len" CHECK (("sales_orders"."customer_reference" is null or char_length("sales_orders"."customer_reference") <= 64) and ("sales_orders"."notes" is null or char_length("sales_orders"."notes") <= 1000) and ("sales_orders"."close_reason" is null or char_length("sales_orders"."close_reason") <= 500)),
	CONSTRAINT "ck_sales_order_amount_max" CHECK ("sales_orders"."subtotal_amount" between 0 and 999999999999999 and "sales_orders"."discount_amount" between 0 and 999999999999999 and "sales_orders"."tax_amount" between 0 and 999999999999999 and "sales_orders"."total_amount" between 0 and 999999999999999)
);
--> statement-breakpoint
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "sales_order_lines_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "fk_sales_order_line_order" FOREIGN KEY ("org_id","sales_order_id") REFERENCES "public"."sales_orders"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "fk_sales_order_line_item" FOREIGN KEY ("org_id","item_id") REFERENCES "public"."items"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "fk_sales_order_line_warehouse" FOREIGN KEY ("org_id","warehouse_id") REFERENCES "public"."warehouses"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_order_lines" ADD CONSTRAINT "fk_sales_order_line_location" FOREIGN KEY ("org_id","warehouse_id","location_id") REFERENCES "public"."warehouse_locations"("org_id","warehouse_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "sales_orders_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "fk_sales_order_party" FOREIGN KEY ("org_id","party_id") REFERENCES "public"."parties"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "fk_sales_order_warehouse" FOREIGN KEY ("org_id","warehouse_id") REFERENCES "public"."warehouses"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_orders" ADD CONSTRAINT "fk_sales_order_payment_term" FOREIGN KEY ("org_id","payment_term_id") REFERENCES "public"."payment_terms"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_sales_order_line_item" ON "sales_order_lines" USING btree ("org_id","item_id");--> statement-breakpoint
CREATE INDEX "ix_sales_order_line_location" ON "sales_order_lines" USING btree ("org_id","location_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_sales_order_org_number" ON "sales_orders" USING btree ("org_id","number");--> statement-breakpoint
CREATE INDEX "ix_sales_order_party" ON "sales_orders" USING btree ("org_id","party_id");--> statement-breakpoint
CREATE INDEX "ix_sales_order_status" ON "sales_orders" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "ix_sales_order_date" ON "sales_orders" USING btree ("org_id","order_date");--> statement-breakpoint
CREATE INDEX "ix_sales_order_requested" ON "sales_orders" USING btree ("org_id","requested_delivery_date");