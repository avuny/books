CREATE TYPE "public"."vendor_payment_method" AS ENUM('cash', 'bank');--> statement-breakpoint
CREATE TYPE "public"."vendor_payment_status" AS ENUM('DRAFT', 'POSTED', 'REVERSED');--> statement-breakpoint
CREATE TABLE "vendor_payment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"vendor_payment_id" uuid NOT NULL,
	"vendor_bill_id" uuid NOT NULL,
	"allocated_amount" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_vendor_payment_alloc_bill" UNIQUE("vendor_payment_id","vendor_bill_id"),
	CONSTRAINT "ck_vendor_payment_alloc_amount" CHECK ("vendor_payment_allocations"."allocated_amount" between 1 and 999999999999999)
);
--> statement-breakpoint
CREATE TABLE "vendor_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"number" text NOT NULL,
	"party_id" uuid NOT NULL,
	"payment_date" date NOT NULL,
	"method" "vendor_payment_method" NOT NULL,
	"reference_number" text,
	"currency" char(3) NOT NULL,
	"amount" bigint DEFAULT 0 NOT NULL,
	"notes" text,
	"status" "vendor_payment_status" DEFAULT 'DRAFT' NOT NULL,
	"journal_entry_id" uuid,
	"created_by" uuid,
	"posted_by" uuid,
	"posted_at" timestamp with time zone,
	"reversed_by" uuid,
	"reversed_at" timestamp with time zone,
	"reverse_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_vendor_payment_org_id" UNIQUE("org_id","id"),
	CONSTRAINT "ck_vendor_payment_number_fmt" CHECK ("vendor_payments"."number" ~ '^VP-[0-9]{6,}$'),
	CONSTRAINT "ck_vendor_payment_text_len" CHECK (("vendor_payments"."reference_number" is null or char_length("vendor_payments"."reference_number") <= 100) and ("vendor_payments"."notes" is null or char_length("vendor_payments"."notes") <= 1000) and ("vendor_payments"."reverse_reason" is null or char_length("vendor_payments"."reverse_reason") <= 500)),
	CONSTRAINT "ck_vendor_payment_amount_max" CHECK ("vendor_payments"."amount" between 1 and 999999999999999)
);
--> statement-breakpoint
ALTER TABLE "vendor_payment_allocations" ADD CONSTRAINT "vendor_payment_allocations_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_payment_allocations" ADD CONSTRAINT "fk_vendor_payment_alloc_payment" FOREIGN KEY ("org_id","vendor_payment_id") REFERENCES "public"."vendor_payments"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_payment_allocations" ADD CONSTRAINT "fk_vendor_payment_alloc_bill" FOREIGN KEY ("org_id","vendor_bill_id") REFERENCES "public"."vendor_bills"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_payments" ADD CONSTRAINT "vendor_payments_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_payments" ADD CONSTRAINT "vendor_payments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_payments" ADD CONSTRAINT "vendor_payments_posted_by_users_id_fk" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_payments" ADD CONSTRAINT "vendor_payments_reversed_by_users_id_fk" FOREIGN KEY ("reversed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_payments" ADD CONSTRAINT "fk_vendor_payment_party" FOREIGN KEY ("org_id","party_id") REFERENCES "public"."parties"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_payments" ADD CONSTRAINT "fk_vendor_payment_journal" FOREIGN KEY ("org_id","journal_entry_id") REFERENCES "public"."journal_entries"("org_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_vendor_payment_alloc_bill" ON "vendor_payment_allocations" USING btree ("org_id","vendor_bill_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_vendor_payment_org_number" ON "vendor_payments" USING btree ("org_id","number");--> statement-breakpoint
CREATE INDEX "ix_vendor_payment_party" ON "vendor_payments" USING btree ("org_id","party_id");--> statement-breakpoint
CREATE INDEX "ix_vendor_payment_status" ON "vendor_payments" USING btree ("org_id","status");