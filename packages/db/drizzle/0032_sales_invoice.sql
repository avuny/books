CREATE TYPE "public"."sales_invoice_status" AS ENUM('DRAFT', 'POSTED', 'REVERSED');--> statement-breakpoint
CREATE TABLE "sales_invoice_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"sales_invoice_id" uuid NOT NULL,
	"line_no" integer NOT NULL,
	"sales_order_line_id" uuid NOT NULL,
	"sales_delivery_id" uuid NOT NULL,
	"sales_delivery_line_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"description" text,
	"base_unit_factor_snapshot" numeric(24, 12) NOT NULL,
	"quantity" numeric(18, 6) NOT NULL,
	"base_quantity" numeric(18, 6) NOT NULL,
	"unit_price" bigint DEFAULT 0 NOT NULL,
	"discount_amount" bigint DEFAULT 0 NOT NULL,
	"net_amount" bigint DEFAULT 0 NOT NULL,
	"tax_rate_bps" integer DEFAULT 0 NOT NULL,
	"tax_amount" bigint DEFAULT 0 NOT NULL,
	"line_total_amount" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_sales_invoice_line_no" UNIQUE("sales_invoice_id","line_no"),
	CONSTRAINT "ux_sales_invoice_line_delivery_line" UNIQUE("sales_invoice_id","sales_delivery_line_id"),
	CONSTRAINT "ck_sales_invoice_line_qty" CHECK ("sales_invoice_lines"."quantity" > 0 and "sales_invoice_lines"."base_quantity" > 0),
	CONSTRAINT "ck_sales_invoice_line_amount" CHECK ("sales_invoice_lines"."unit_price" between 0 and 999999999999999 and "sales_invoice_lines"."discount_amount" between 0 and 999999999999999 and "sales_invoice_lines"."net_amount" between 0 and 999999999999999 and "sales_invoice_lines"."tax_amount" between 0 and 999999999999999 and "sales_invoice_lines"."line_total_amount" = "sales_invoice_lines"."net_amount" + "sales_invoice_lines"."tax_amount"),
	CONSTRAINT "ck_sales_invoice_line_tax_rate" CHECK ("sales_invoice_lines"."tax_rate_bps" between 0 and 10000),
	CONSTRAINT "ck_sales_invoice_line_text_len" CHECK ("sales_invoice_lines"."description" is null or char_length("sales_invoice_lines"."description") <= 500)
);
--> statement-breakpoint
CREATE TABLE "sales_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"number" text NOT NULL,
	"sales_order_id" uuid NOT NULL,
	"party_id" uuid NOT NULL,
	"customer_name_snapshot" text,
	"invoice_date" date NOT NULL,
	"due_date" date NOT NULL,
	"payment_term_id" uuid,
	"payment_term_name_snapshot" text,
	"payment_term_method_snapshot" "payment_term_method",
	"payment_term_days_snapshot" integer,
	"currency" char(3) NOT NULL,
	"subtotal_amount" bigint DEFAULT 0 NOT NULL,
	"discount_amount" bigint DEFAULT 0 NOT NULL,
	"tax_amount" bigint DEFAULT 0 NOT NULL,
	"total_amount" bigint DEFAULT 0 NOT NULL,
	"notes" text,
	"status" "sales_invoice_status" DEFAULT 'DRAFT' NOT NULL,
	"journal_entry_id" uuid,
	"created_by" uuid,
	"posted_by" uuid,
	"posted_at" timestamp with time zone,
	"reversed_by" uuid,
	"reversed_at" timestamp with time zone,
	"reverse_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_sales_invoice_org_id" UNIQUE("org_id","id"),
	CONSTRAINT "ck_sales_invoice_number_fmt" CHECK ("sales_invoices"."number" ~ '^INV-[0-9]{6,}$'),
	CONSTRAINT "ck_sales_invoice_text_len" CHECK (("sales_invoices"."notes" is null or char_length("sales_invoices"."notes") <= 1000) and ("sales_invoices"."reverse_reason" is null or char_length("sales_invoices"."reverse_reason") <= 500)),
	CONSTRAINT "ck_sales_invoice_amount_max" CHECK ("sales_invoices"."subtotal_amount" between 0 and 999999999999999 and "sales_invoices"."discount_amount" between 0 and 999999999999999 and "sales_invoices"."tax_amount" between 0 and 999999999999999 and "sales_invoices"."total_amount" between 0 and 999999999999999),
	CONSTRAINT "ck_sales_invoice_total" CHECK ("sales_invoices"."total_amount" = "sales_invoices"."subtotal_amount" + "sales_invoices"."tax_amount"),
	CONSTRAINT "ck_sales_invoice_due_date" CHECK ("sales_invoices"."due_date" >= "sales_invoices"."invoice_date")
);
--> statement-breakpoint
ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "sales_invoice_lines_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "sales_invoice_lines_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "fk_sales_invoice_line_invoice" FOREIGN KEY ("org_id","sales_invoice_id") REFERENCES "public"."sales_invoices"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "fk_sales_invoice_line_order_line" FOREIGN KEY ("org_id","sales_order_line_id") REFERENCES "public"."sales_order_lines"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "fk_sales_invoice_line_delivery" FOREIGN KEY ("org_id","sales_delivery_id") REFERENCES "public"."sales_deliveries"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "fk_sales_invoice_line_delivery_line" FOREIGN KEY ("org_id","sales_delivery_line_id") REFERENCES "public"."sales_delivery_lines"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoice_lines" ADD CONSTRAINT "fk_sales_invoice_line_item" FOREIGN KEY ("org_id","item_id") REFERENCES "public"."items"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_posted_by_users_id_fk" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_reversed_by_users_id_fk" FOREIGN KEY ("reversed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD CONSTRAINT "fk_sales_invoice_order" FOREIGN KEY ("org_id","sales_order_id") REFERENCES "public"."sales_orders"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD CONSTRAINT "fk_sales_invoice_party" FOREIGN KEY ("org_id","party_id") REFERENCES "public"."parties"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD CONSTRAINT "fk_sales_invoice_payment_term" FOREIGN KEY ("org_id","payment_term_id") REFERENCES "public"."payment_terms"("org_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_invoices" ADD CONSTRAINT "fk_sales_invoice_journal" FOREIGN KEY ("org_id","journal_entry_id") REFERENCES "public"."journal_entries"("org_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_sales_invoice_line_delivery_line" ON "sales_invoice_lines" USING btree ("org_id","sales_delivery_line_id");--> statement-breakpoint
CREATE INDEX "ix_sales_invoice_line_order_line" ON "sales_invoice_lines" USING btree ("org_id","sales_order_line_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_sales_invoice_org_number" ON "sales_invoices" USING btree ("org_id","number");--> statement-breakpoint
CREATE INDEX "ix_sales_invoice_party" ON "sales_invoices" USING btree ("org_id","party_id","invoice_date");--> statement-breakpoint
CREATE INDEX "ix_sales_invoice_order" ON "sales_invoices" USING btree ("org_id","sales_order_id");--> statement-breakpoint
CREATE INDEX "ix_sales_invoice_status_due" ON "sales_invoices" USING btree ("org_id","status","due_date");