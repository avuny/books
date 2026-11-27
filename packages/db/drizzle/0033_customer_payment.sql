CREATE TYPE "public"."customer_payment_method" AS ENUM('cash', 'bank');--> statement-breakpoint
CREATE TYPE "public"."customer_payment_status" AS ENUM('DRAFT', 'POSTED', 'REVERSED');--> statement-breakpoint
CREATE TABLE "customer_payment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"customer_payment_id" uuid NOT NULL,
	"sales_invoice_id" uuid NOT NULL,
	"allocated_amount" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_customer_payment_alloc_invoice" UNIQUE("customer_payment_id","sales_invoice_id"),
	CONSTRAINT "ck_customer_payment_alloc_amount" CHECK ("customer_payment_allocations"."allocated_amount" between 1 and 999999999999999)
);
--> statement-breakpoint
CREATE TABLE "customer_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"number" text NOT NULL,
	"party_id" uuid NOT NULL,
	"payment_date" date NOT NULL,
	"method" "customer_payment_method" NOT NULL,
	"reference_number" text,
	"currency" char(3) NOT NULL,
	"amount" bigint DEFAULT 0 NOT NULL,
	"notes" text,
	"status" "customer_payment_status" DEFAULT 'DRAFT' NOT NULL,
	"journal_entry_id" uuid,
	"created_by" uuid,
	"posted_by" uuid,
	"posted_at" timestamp with time zone,
	"reversed_by" uuid,
	"reversed_at" timestamp with time zone,
	"reverse_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_customer_payment_org_id" UNIQUE("org_id","id"),
	CONSTRAINT "ck_customer_payment_number_fmt" CHECK ("customer_payments"."number" ~ '^CP-[0-9]{6,}$'),
	CONSTRAINT "ck_customer_payment_text_len" CHECK (("customer_payments"."reference_number" is null or char_length("customer_payments"."reference_number") <= 100) and ("customer_payments"."notes" is null or char_length("customer_payments"."notes") <= 1000) and ("customer_payments"."reverse_reason" is null or char_length("customer_payments"."reverse_reason") <= 500)),
	CONSTRAINT "ck_customer_payment_amount_max" CHECK ("customer_payments"."amount" between 1 and 999999999999999)
);
--> statement-breakpoint
ALTER TABLE "customer_payment_allocations" ADD CONSTRAINT "customer_payment_allocations_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_payment_allocations" ADD CONSTRAINT "fk_customer_payment_alloc_payment" FOREIGN KEY ("org_id","customer_payment_id") REFERENCES "public"."customer_payments"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_payment_allocations" ADD CONSTRAINT "fk_customer_payment_alloc_invoice" FOREIGN KEY ("org_id","sales_invoice_id") REFERENCES "public"."sales_invoices"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_payments" ADD CONSTRAINT "customer_payments_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_payments" ADD CONSTRAINT "customer_payments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_payments" ADD CONSTRAINT "customer_payments_posted_by_users_id_fk" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_payments" ADD CONSTRAINT "customer_payments_reversed_by_users_id_fk" FOREIGN KEY ("reversed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_payments" ADD CONSTRAINT "fk_customer_payment_party" FOREIGN KEY ("org_id","party_id") REFERENCES "public"."parties"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_payments" ADD CONSTRAINT "fk_customer_payment_journal" FOREIGN KEY ("org_id","journal_entry_id") REFERENCES "public"."journal_entries"("org_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_customer_payment_alloc_invoice" ON "customer_payment_allocations" USING btree ("org_id","sales_invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_customer_payment_org_number" ON "customer_payments" USING btree ("org_id","number");--> statement-breakpoint
CREATE INDEX "ix_customer_payment_party" ON "customer_payments" USING btree ("org_id","party_id");--> statement-breakpoint
CREATE INDEX "ix_customer_payment_status" ON "customer_payments" USING btree ("org_id","status");