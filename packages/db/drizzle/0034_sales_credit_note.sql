CREATE TYPE "public"."sales_credit_note_status" AS ENUM('DRAFT', 'POSTED', 'REVERSED');--> statement-breakpoint
CREATE TABLE "sales_credit_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"number" text NOT NULL,
	"sales_invoice_id" uuid NOT NULL,
	"party_id" uuid NOT NULL,
	"customer_name_snapshot" text,
	"credit_date" date NOT NULL,
	"reason" text NOT NULL,
	"notes" text,
	"currency" char(3) NOT NULL,
	"net_amount" bigint DEFAULT 0 NOT NULL,
	"tax_amount" bigint DEFAULT 0 NOT NULL,
	"total_amount" bigint DEFAULT 0 NOT NULL,
	"status" "sales_credit_note_status" DEFAULT 'DRAFT' NOT NULL,
	"journal_entry_id" uuid,
	"created_by" uuid,
	"posted_by" uuid,
	"posted_at" timestamp with time zone,
	"reversed_by" uuid,
	"reversed_at" timestamp with time zone,
	"reverse_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_sales_credit_note_org_id" UNIQUE("org_id","id"),
	CONSTRAINT "ck_sales_credit_note_number_fmt" CHECK ("sales_credit_notes"."number" ~ '^CN-[0-9]{6,}$'),
	CONSTRAINT "ck_sales_credit_note_text_len" CHECK (char_length("sales_credit_notes"."reason") <= 500 and ("sales_credit_notes"."notes" is null or char_length("sales_credit_notes"."notes") <= 1000) and ("sales_credit_notes"."reverse_reason" is null or char_length("sales_credit_notes"."reverse_reason") <= 500)),
	CONSTRAINT "ck_sales_credit_note_amount_max" CHECK ("sales_credit_notes"."total_amount" between 1 and 999999999999999),
	CONSTRAINT "ck_sales_credit_note_total" CHECK ("sales_credit_notes"."total_amount" = "sales_credit_notes"."net_amount" + "sales_credit_notes"."tax_amount" and "sales_credit_notes"."net_amount" >= 0 and "sales_credit_notes"."tax_amount" >= 0)
);
--> statement-breakpoint
ALTER TABLE "sales_credit_notes" ADD CONSTRAINT "sales_credit_notes_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_credit_notes" ADD CONSTRAINT "sales_credit_notes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_credit_notes" ADD CONSTRAINT "sales_credit_notes_posted_by_users_id_fk" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_credit_notes" ADD CONSTRAINT "sales_credit_notes_reversed_by_users_id_fk" FOREIGN KEY ("reversed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_credit_notes" ADD CONSTRAINT "fk_sales_credit_note_invoice" FOREIGN KEY ("org_id","sales_invoice_id") REFERENCES "public"."sales_invoices"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_credit_notes" ADD CONSTRAINT "fk_sales_credit_note_party" FOREIGN KEY ("org_id","party_id") REFERENCES "public"."parties"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_credit_notes" ADD CONSTRAINT "fk_sales_credit_note_journal" FOREIGN KEY ("org_id","journal_entry_id") REFERENCES "public"."journal_entries"("org_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ux_sales_credit_note_org_number" ON "sales_credit_notes" USING btree ("org_id","number");--> statement-breakpoint
CREATE INDEX "ix_sales_credit_note_invoice" ON "sales_credit_notes" USING btree ("org_id","sales_invoice_id");--> statement-breakpoint
CREATE INDEX "ix_sales_credit_note_party" ON "sales_credit_notes" USING btree ("org_id","party_id");--> statement-breakpoint
CREATE INDEX "ix_sales_credit_note_status" ON "sales_credit_notes" USING btree ("org_id","status");