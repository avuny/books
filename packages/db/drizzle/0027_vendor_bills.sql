CREATE TYPE "public"."vendor_bill_status" AS ENUM('DRAFT', 'POSTED', 'REVERSED');--> statement-breakpoint
ALTER TABLE "purchase_receipt_lines" ADD CONSTRAINT "ux_purchase_receipt_line_org_id" UNIQUE("org_id","id");
--> statement-breakpoint
CREATE TABLE "vendor_bill_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"vendor_bill_id" uuid NOT NULL,
	"line_no" integer NOT NULL,
	"purchase_receipt_id" uuid NOT NULL,
	"purchase_receipt_line_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"description" text,
	"base_unit_factor_snapshot" numeric(24, 12) NOT NULL,
	"billed_qty" numeric(18, 6) NOT NULL,
	"billed_base_qty" numeric(18, 6) NOT NULL,
	"net_amount" bigint DEFAULT 0 NOT NULL,
	"tax_rate_bps" integer DEFAULT 0 NOT NULL,
	"tax_amount" bigint DEFAULT 0 NOT NULL,
	"line_total_amount" bigint DEFAULT 0 NOT NULL,
	"matched_value" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_vendor_bill_line_no" UNIQUE("vendor_bill_id","line_no"),
	CONSTRAINT "ux_vendor_bill_line_receipt_line" UNIQUE("vendor_bill_id","purchase_receipt_line_id"),
	CONSTRAINT "ck_vendor_bill_line_qty" CHECK ("vendor_bill_lines"."billed_qty" > 0 and "vendor_bill_lines"."billed_base_qty" > 0),
	CONSTRAINT "ck_vendor_bill_line_amount" CHECK ("vendor_bill_lines"."net_amount" between 1 and 999999999999999 and "vendor_bill_lines"."tax_amount" between 0 and 999999999999999 and "vendor_bill_lines"."line_total_amount" = "vendor_bill_lines"."net_amount" + "vendor_bill_lines"."tax_amount" and "vendor_bill_lines"."matched_value" between 0 and 999999999999999),
	CONSTRAINT "ck_vendor_bill_line_tax_rate" CHECK ("vendor_bill_lines"."tax_rate_bps" between 0 and 10000),
	CONSTRAINT "ck_vendor_bill_line_text_len" CHECK ("vendor_bill_lines"."description" is null or char_length("vendor_bill_lines"."description") <= 500)
);
--> statement-breakpoint
CREATE TABLE "vendor_bills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"number" text NOT NULL,
	"party_id" uuid NOT NULL,
	"supplier_invoice_number" text,
	"invoice_date" date NOT NULL,
	"due_date" date NOT NULL,
	"payment_term_id" uuid,
	"payment_term_name_snapshot" text,
	"payment_term_method_snapshot" "payment_term_method",
	"payment_term_days_snapshot" integer,
	"currency" char(3) NOT NULL,
	"subtotal_amount" bigint DEFAULT 0 NOT NULL,
	"tax_amount" bigint DEFAULT 0 NOT NULL,
	"total_amount" bigint DEFAULT 0 NOT NULL,
	"received_value" bigint DEFAULT 0 NOT NULL,
	"notes" text,
	"status" "vendor_bill_status" DEFAULT 'DRAFT' NOT NULL,
	"journal_entry_id" uuid,
	"created_by" uuid,
	"posted_by" uuid,
	"posted_at" timestamp with time zone,
	"reversed_by" uuid,
	"reversed_at" timestamp with time zone,
	"reverse_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_vendor_bill_org_id" UNIQUE("org_id","id"),
	CONSTRAINT "ck_vendor_bill_number_fmt" CHECK ("vendor_bills"."number" ~ '^BILL-[0-9]{6,}$'),
	CONSTRAINT "ck_vendor_bill_text_len" CHECK (("vendor_bills"."supplier_invoice_number" is null or char_length("vendor_bills"."supplier_invoice_number") <= 100) and ("vendor_bills"."notes" is null or char_length("vendor_bills"."notes") <= 1000) and ("vendor_bills"."reverse_reason" is null or char_length("vendor_bills"."reverse_reason") <= 500)),
	CONSTRAINT "ck_vendor_bill_amount_max" CHECK ("vendor_bills"."subtotal_amount" between 0 and 999999999999999 and "vendor_bills"."tax_amount" between 0 and 999999999999999 and "vendor_bills"."total_amount" between 0 and 999999999999999 and "vendor_bills"."received_value" between 0 and 999999999999999),
	CONSTRAINT "ck_vendor_bill_total" CHECK ("vendor_bills"."total_amount" = "vendor_bills"."subtotal_amount" + "vendor_bills"."tax_amount"),
	CONSTRAINT "ck_vendor_bill_due_date" CHECK ("vendor_bills"."due_date" >= "vendor_bills"."invoice_date")
);
--> statement-breakpoint
ALTER TABLE "vendor_bill_lines" ADD CONSTRAINT "vendor_bill_lines_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_bill_lines" ADD CONSTRAINT "vendor_bill_lines_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_bill_lines" ADD CONSTRAINT "fk_vendor_bill_line_bill" FOREIGN KEY ("org_id","vendor_bill_id") REFERENCES "public"."vendor_bills"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_bill_lines" ADD CONSTRAINT "fk_vendor_bill_line_receipt" FOREIGN KEY ("org_id","purchase_receipt_id") REFERENCES "public"."purchase_receipts"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_bill_lines" ADD CONSTRAINT "fk_vendor_bill_line_receipt_line" FOREIGN KEY ("org_id","purchase_receipt_line_id") REFERENCES "public"."purchase_receipt_lines"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_bill_lines" ADD CONSTRAINT "fk_vendor_bill_line_item" FOREIGN KEY ("org_id","item_id") REFERENCES "public"."items"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_posted_by_users_id_fk" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_bills" ADD CONSTRAINT "vendor_bills_reversed_by_users_id_fk" FOREIGN KEY ("reversed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_bills" ADD CONSTRAINT "fk_vendor_bill_party" FOREIGN KEY ("org_id","party_id") REFERENCES "public"."parties"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_bills" ADD CONSTRAINT "fk_vendor_bill_payment_term" FOREIGN KEY ("org_id","payment_term_id") REFERENCES "public"."payment_terms"("org_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_bills" ADD CONSTRAINT "fk_vendor_bill_journal" FOREIGN KEY ("org_id","journal_entry_id") REFERENCES "public"."journal_entries"("org_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_vendor_bill_line_receipt_line" ON "vendor_bill_lines" USING btree ("org_id","purchase_receipt_line_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_vendor_bill_org_number" ON "vendor_bills" USING btree ("org_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_vendor_bill_supplier_invoice" ON "vendor_bills" USING btree ("org_id","party_id",lower("supplier_invoice_number")) WHERE "vendor_bills"."supplier_invoice_number" is not null and "vendor_bills"."status" <> 'REVERSED';--> statement-breakpoint
CREATE INDEX "ix_vendor_bill_party" ON "vendor_bills" USING btree ("org_id","party_id");--> statement-breakpoint
CREATE INDEX "ix_vendor_bill_status_due" ON "vendor_bills" USING btree ("org_id","status","due_date");