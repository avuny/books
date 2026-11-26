CREATE TYPE "public"."payment_term_method" AS ENUM('DUE_ON_RECEIPT', 'NET_DAYS', 'END_OF_MONTH', 'END_OF_NEXT_MONTH', 'DAYS_AFTER_END_OF_MONTH');--> statement-breakpoint
CREATE TYPE "public"."purchase_order_status" AS ENUM('DRAFT', 'CONFIRMED', 'PARTIALLY_SHIPPED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."purchase_shipment_status" AS ENUM('DRAFT', 'POSTED', 'VOIDED');--> statement-breakpoint
CREATE TABLE "payment_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"method" "payment_term_method" NOT NULL,
	"days" integer DEFAULT 0 NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_payment_term_org_id" UNIQUE("org_id","id"),
	CONSTRAINT "ux_payment_term_org_code" UNIQUE("org_id","code"),
	CONSTRAINT "ck_payment_term_name_len" CHECK (char_length("payment_terms"."name") BETWEEN 1 AND 80),
	CONSTRAINT "ck_payment_term_code_len" CHECK (char_length("payment_terms"."code") BETWEEN 1 AND 40),
	CONSTRAINT "ck_payment_term_days_range" CHECK ("payment_terms"."days" >= 0 and "payment_terms"."days" <= 3650),
	CONSTRAINT "ck_payment_term_days_by_method" CHECK ("payment_terms"."method" in ('NET_DAYS', 'DAYS_AFTER_END_OF_MONTH') or "payment_terms"."days" = 0)
);
--> statement-breakpoint
CREATE TABLE "purchase_order_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"line_no" integer NOT NULL,
	"item_id" uuid NOT NULL,
	"description_snapshot" text,
	"warehouse_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"base_unit_factor_snapshot" numeric(24, 12) NOT NULL,
	"ordered_qty" numeric(18, 6) NOT NULL,
	"ordered_base_qty" numeric(18, 6) NOT NULL,
	"shipped_base_qty" numeric(18, 6) DEFAULT '0' NOT NULL,
	"received_base_qty" numeric(18, 6) DEFAULT '0' NOT NULL,
	"accepted_base_qty" numeric(18, 6) DEFAULT '0' NOT NULL,
	"rejected_base_qty" numeric(18, 6) DEFAULT '0' NOT NULL,
	"invoiced_base_qty" numeric(18, 6) DEFAULT '0' NOT NULL,
	"cancelled_base_qty" numeric(18, 6) DEFAULT '0' NOT NULL,
	"unit_price" bigint NOT NULL,
	"discount_amount" bigint DEFAULT 0 NOT NULL,
	"line_net_amount" bigint NOT NULL,
	"expected_delivery_date" date,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_purchase_order_line_org_id" UNIQUE("org_id","id"),
	CONSTRAINT "ux_purchase_order_line_no" UNIQUE("purchase_order_id","line_no"),
	CONSTRAINT "ck_purchase_order_line_ordered_positive" CHECK ("purchase_order_lines"."ordered_qty" > 0 and "purchase_order_lines"."ordered_base_qty" > 0),
	CONSTRAINT "ck_purchase_order_line_counters_non_negative" CHECK ("purchase_order_lines"."shipped_base_qty" >= 0 and "purchase_order_lines"."received_base_qty" >= 0 and "purchase_order_lines"."accepted_base_qty" >= 0 and "purchase_order_lines"."rejected_base_qty" >= 0 and "purchase_order_lines"."invoiced_base_qty" >= 0 and "purchase_order_lines"."cancelled_base_qty" >= 0),
	CONSTRAINT "ck_purchase_order_line_shipped_within_ordered" CHECK ("purchase_order_lines"."shipped_base_qty" + "purchase_order_lines"."cancelled_base_qty" <= "purchase_order_lines"."ordered_base_qty"),
	CONSTRAINT "ck_purchase_order_line_received_within_shipped" CHECK ("purchase_order_lines"."received_base_qty" <= "purchase_order_lines"."shipped_base_qty"),
	CONSTRAINT "ck_purchase_order_line_amount_max" CHECK ("purchase_order_lines"."unit_price" between 0 and 999999999999999 and "purchase_order_lines"."discount_amount" between 0 and 999999999999999 and "purchase_order_lines"."line_net_amount" between 0 and 999999999999999),
	CONSTRAINT "ck_purchase_order_line_text_len" CHECK (("purchase_order_lines"."notes" is null or char_length("purchase_order_lines"."notes") <= 500) and ("purchase_order_lines"."description_snapshot" is null or char_length("purchase_order_lines"."description_snapshot") <= 500))
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"number" text NOT NULL,
	"party_id" uuid NOT NULL,
	"order_date" date NOT NULL,
	"expected_delivery_date" date,
	"payment_term_id" uuid,
	"payment_term_name_snapshot" text,
	"payment_term_method_snapshot" "payment_term_method",
	"payment_term_days_snapshot" integer,
	"currency" char(3) NOT NULL,
	"warehouse_id" uuid,
	"supplier_reference" text,
	"notes" text,
	"status" "purchase_order_status" DEFAULT 'DRAFT' NOT NULL,
	"subtotal_amount" bigint DEFAULT 0 NOT NULL,
	"discount_amount" bigint DEFAULT 0 NOT NULL,
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
	CONSTRAINT "ux_purchase_order_org_id" UNIQUE("org_id","id"),
	CONSTRAINT "ck_purchase_order_number_fmt" CHECK ("purchase_orders"."number" ~ '^PO-[0-9]{6,}$'),
	CONSTRAINT "ck_purchase_order_currency_fmt" CHECK ("purchase_orders"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "ck_purchase_order_text_len" CHECK (("purchase_orders"."supplier_reference" is null or char_length("purchase_orders"."supplier_reference") <= 64) and ("purchase_orders"."notes" is null or char_length("purchase_orders"."notes") <= 1000) and ("purchase_orders"."close_reason" is null or char_length("purchase_orders"."close_reason") <= 500)),
	CONSTRAINT "ck_purchase_order_amount_max" CHECK ("purchase_orders"."subtotal_amount" between 0 and 999999999999999 and "purchase_orders"."discount_amount" between 0 and 999999999999999 and "purchase_orders"."total_amount" between 0 and 999999999999999)
);
--> statement-breakpoint
CREATE TABLE "purchase_shipment_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"purchase_shipment_id" uuid NOT NULL,
	"line_no" integer NOT NULL,
	"purchase_order_line_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"base_unit_factor_snapshot" numeric(24, 12) NOT NULL,
	"shipped_qty" numeric(18, 6) NOT NULL,
	"shipped_base_qty" numeric(18, 6) NOT NULL,
	"supplier_batch_ref" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_purchase_shipment_line_no" UNIQUE("purchase_shipment_id","line_no"),
	CONSTRAINT "ux_purchase_shipment_line_order_line" UNIQUE("purchase_shipment_id","purchase_order_line_id"),
	CONSTRAINT "ck_purchase_shipment_line_qty_positive" CHECK ("purchase_shipment_lines"."shipped_qty" > 0 and "purchase_shipment_lines"."shipped_base_qty" > 0),
	CONSTRAINT "ck_purchase_shipment_line_text_len" CHECK (("purchase_shipment_lines"."notes" is null or char_length("purchase_shipment_lines"."notes") <= 500) and ("purchase_shipment_lines"."supplier_batch_ref" is null or char_length("purchase_shipment_lines"."supplier_batch_ref") <= 100))
);
--> statement-breakpoint
CREATE TABLE "purchase_shipments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"number" text NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"party_id" uuid NOT NULL,
	"shipment_date" date NOT NULL,
	"carrier" text,
	"tracking_number" text,
	"supplier_delivery_reference" text,
	"status" "purchase_shipment_status" DEFAULT 'DRAFT' NOT NULL,
	"created_by" uuid,
	"posted_by" uuid,
	"posted_at" timestamp with time zone,
	"voided_by" uuid,
	"voided_at" timestamp with time zone,
	"void_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_purchase_shipment_org_id" UNIQUE("org_id","id"),
	CONSTRAINT "ck_purchase_shipment_number_fmt" CHECK ("purchase_shipments"."number" ~ '^PS-[0-9]{6,}$'),
	CONSTRAINT "ck_purchase_shipment_text_len" CHECK (("purchase_shipments"."carrier" is null or char_length("purchase_shipments"."carrier") <= 100) and ("purchase_shipments"."tracking_number" is null or char_length("purchase_shipments"."tracking_number") <= 100) and ("purchase_shipments"."supplier_delivery_reference" is null or char_length("purchase_shipments"."supplier_delivery_reference") <= 100) and ("purchase_shipments"."void_reason" is null or char_length("purchase_shipments"."void_reason") <= 500))
);
--> statement-breakpoint
ALTER TABLE "inventory_items" ADD COLUMN "in_transit_qty" numeric(18, 6) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_terms" ADD CONSTRAINT "payment_terms_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_terms" ADD CONSTRAINT "payment_terms_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "fk_purchase_order_line_order" FOREIGN KEY ("org_id","purchase_order_id") REFERENCES "public"."purchase_orders"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "fk_purchase_order_line_item" FOREIGN KEY ("org_id","item_id") REFERENCES "public"."items"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "fk_purchase_order_line_warehouse" FOREIGN KEY ("org_id","warehouse_id") REFERENCES "public"."warehouses"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "fk_purchase_order_line_location" FOREIGN KEY ("org_id","warehouse_id","location_id") REFERENCES "public"."warehouse_locations"("org_id","warehouse_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_cancelled_by_users_id_fk" FOREIGN KEY ("cancelled_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "fk_purchase_order_party" FOREIGN KEY ("org_id","party_id") REFERENCES "public"."parties"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "fk_purchase_order_warehouse" FOREIGN KEY ("org_id","warehouse_id") REFERENCES "public"."warehouses"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "fk_purchase_order_payment_term" FOREIGN KEY ("org_id","payment_term_id") REFERENCES "public"."payment_terms"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_shipment_lines" ADD CONSTRAINT "purchase_shipment_lines_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_shipment_lines" ADD CONSTRAINT "purchase_shipment_lines_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_shipment_lines" ADD CONSTRAINT "fk_purchase_shipment_line_shipment" FOREIGN KEY ("org_id","purchase_shipment_id") REFERENCES "public"."purchase_shipments"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_shipment_lines" ADD CONSTRAINT "fk_purchase_shipment_line_order_line" FOREIGN KEY ("org_id","purchase_order_line_id") REFERENCES "public"."purchase_order_lines"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_shipment_lines" ADD CONSTRAINT "fk_purchase_shipment_line_item" FOREIGN KEY ("org_id","item_id") REFERENCES "public"."items"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_shipments" ADD CONSTRAINT "purchase_shipments_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_shipments" ADD CONSTRAINT "purchase_shipments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_shipments" ADD CONSTRAINT "purchase_shipments_posted_by_users_id_fk" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_shipments" ADD CONSTRAINT "purchase_shipments_voided_by_users_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_shipments" ADD CONSTRAINT "fk_purchase_shipment_order" FOREIGN KEY ("org_id","purchase_order_id") REFERENCES "public"."purchase_orders"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_shipments" ADD CONSTRAINT "fk_purchase_shipment_party" FOREIGN KEY ("org_id","party_id") REFERENCES "public"."parties"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_payment_term_org_active" ON "payment_terms" USING btree ("org_id","is_active","sort_order");--> statement-breakpoint
CREATE INDEX "ix_purchase_order_line_item" ON "purchase_order_lines" USING btree ("org_id","item_id");--> statement-breakpoint
CREATE INDEX "ix_purchase_order_line_location" ON "purchase_order_lines" USING btree ("org_id","location_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_purchase_order_org_number" ON "purchase_orders" USING btree ("org_id","number");--> statement-breakpoint
CREATE INDEX "ix_purchase_order_party" ON "purchase_orders" USING btree ("org_id","party_id");--> statement-breakpoint
CREATE INDEX "ix_purchase_order_status" ON "purchase_orders" USING btree ("org_id","status");--> statement-breakpoint
CREATE INDEX "ix_purchase_order_date" ON "purchase_orders" USING btree ("org_id","order_date");--> statement-breakpoint
CREATE INDEX "ix_purchase_order_expected" ON "purchase_orders" USING btree ("org_id","expected_delivery_date");--> statement-breakpoint
CREATE INDEX "ix_purchase_shipment_line_order_line" ON "purchase_shipment_lines" USING btree ("org_id","purchase_order_line_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_purchase_shipment_org_number" ON "purchase_shipments" USING btree ("org_id","number");--> statement-breakpoint
CREATE INDEX "ix_purchase_shipment_order" ON "purchase_shipments" USING btree ("org_id","purchase_order_id");--> statement-breakpoint
CREATE INDEX "ix_purchase_shipment_status" ON "purchase_shipments" USING btree ("org_id","status");--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "ck_inventory_item_in_transit_non_negative" CHECK ("inventory_items"."in_transit_qty" >= 0);