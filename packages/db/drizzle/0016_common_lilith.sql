CREATE TYPE "public"."account_mapping_key" AS ENUM('CASH', 'BANK', 'ACCOUNTS_RECEIVABLE', 'ACCOUNTS_PAYABLE', 'INVENTORY_ASSET', 'INVENTORY_IN_TRANSIT', 'INPUT_TAX', 'OUTPUT_TAX', 'SALES_REVENUE', 'OTHER_REVENUE', 'SALES_RETURNS', 'SALES_DISCOUNTS', 'COST_OF_GOODS_SOLD', 'INVENTORY_WRITE_OFF', 'INVENTORY_SHRINKAGE', 'OPENING_BALANCE_EQUITY', 'GOODS_RECEIVED_NOT_INVOICED', 'CUSTOMER_ADVANCES', 'SUPPLIER_ADVANCES', 'OWNERS_CAPITAL', 'OWNERS_DRAWINGS', 'RETAINED_EARNINGS', 'FIXED_ASSETS', 'ACCUMULATED_DEPRECIATION', 'DEPRECIATION_EXPENSE', 'SALARIES', 'RENT', 'UTILITIES', 'DELIVERY_EXPENSE', 'MARKETING', 'MAINTENANCE', 'BANK_FEES', 'GENERAL_EXPENSES', 'PREPAID_EXPENSES', 'LONG_TERM_LOANS', 'INVENTORY_VALUATION_ADJUSTMENT', 'PURCHASE_PRICE_VARIANCE');--> statement-breakpoint
CREATE TYPE "public"."account_normal_balance" AS ENUM('DEBIT', 'CREDIT');--> statement-breakpoint
CREATE TYPE "public"."account_type" AS ENUM('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');--> statement-breakpoint
CREATE TYPE "public"."journal_entry_status" AS ENUM('DRAFT', 'POSTED', 'REVERSED');--> statement-breakpoint
CREATE TYPE "public"."accounting_period_status" AS ENUM('OPEN', 'CLOSED');--> statement-breakpoint
CREATE TABLE "account_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"mapping_key" "account_mapping_key" NOT NULL,
	"account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" "account_type" NOT NULL,
	"normal_balance" "account_normal_balance" NOT NULL,
	"parent_id" uuid,
	"system_key" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"allow_posting" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_account_org_id" UNIQUE("org_id","id"),
	CONSTRAINT "ck_account_code_len" CHECK (char_length("accounts"."code") BETWEEN 1 AND 20),
	CONSTRAINT "ck_account_code_fmt" CHECK ("accounts"."code" ~ '^[A-Za-z0-9][A-Za-z0-9._-]*$'),
	CONSTRAINT "ck_account_name_len" CHECK (char_length("accounts"."name") BETWEEN 1 AND 120),
	CONSTRAINT "ck_account_description_len" CHECK ("accounts"."description" is null or char_length("accounts"."description") <= 500),
	CONSTRAINT "ck_account_system_key_fmt" CHECK ("accounts"."system_key" is null or (char_length("accounts"."system_key") BETWEEN 1 AND 64 and "accounts"."system_key" ~ '^[A-Z][A-Z0-9_]*$')),
	CONSTRAINT "ck_account_parent_not_self" CHECK ("accounts"."parent_id" is null or "accounts"."parent_id" <> "accounts"."id")
);
--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"entry_seq" integer NOT NULL,
	"entry_number" text NOT NULL,
	"entry_date" date NOT NULL,
	"description" text,
	"status" "journal_entry_status" DEFAULT 'DRAFT' NOT NULL,
	"currency" char(3) NOT NULL,
	"source_type" text,
	"source_id" uuid,
	"source_ref" text,
	"reversal_of_id" uuid,
	"created_by" uuid,
	"posted_at" timestamp with time zone,
	"posted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_journal_entry_org_id" UNIQUE("org_id","id"),
	CONSTRAINT "ck_journal_entry_number_fmt" CHECK ("journal_entries"."entry_number" ~ '^JE-[0-9]{6,}$'),
	CONSTRAINT "ck_journal_entry_seq" CHECK ("journal_entries"."entry_seq" >= 1),
	CONSTRAINT "ck_journal_entry_currency" CHECK ("journal_entries"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "ck_journal_entry_source" CHECK ("journal_entries"."source_id" is null or "journal_entries"."source_type" is not null),
	CONSTRAINT "ck_journal_entry_not_self_reversal" CHECK ("journal_entries"."reversal_of_id" is null or "journal_entries"."reversal_of_id" <> "journal_entries"."id"),
	CONSTRAINT "ck_journal_entry_posted" CHECK (("journal_entries"."status" = 'DRAFT' and "journal_entries"."posted_at" is null and "journal_entries"."posted_by" is null) or ("journal_entries"."status" <> 'DRAFT' and "journal_entries"."posted_at" is not null)),
	CONSTRAINT "ck_journal_entry_text_len" CHECK (("journal_entries"."description" is null or char_length("journal_entries"."description") <= 500)
                and ("journal_entries"."source_type" is null or char_length("journal_entries"."source_type") <= 40)
                and ("journal_entries"."source_ref" is null or char_length("journal_entries"."source_ref") <= 64))
);
--> statement-breakpoint
CREATE TABLE "journal_entry_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"journal_entry_id" uuid NOT NULL,
	"line_no" smallint NOT NULL,
	"account_id" uuid NOT NULL,
	"description" text,
	"debit" bigint DEFAULT 0 NOT NULL,
	"credit" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_journal_entry_line_no" UNIQUE("journal_entry_id","line_no"),
	CONSTRAINT "ck_journal_entry_line_no" CHECK ("journal_entry_lines"."line_no" >= 1),
	CONSTRAINT "ck_journal_entry_line_amount_max" CHECK ("journal_entry_lines"."debit" >= 0 and "journal_entry_lines"."credit" >= 0 and "journal_entry_lines"."debit" <= 999999999999999 and "journal_entry_lines"."credit" <= 999999999999999),
	CONSTRAINT "ck_journal_entry_line_one_side" CHECK (("journal_entry_lines"."debit" > 0) <> ("journal_entry_lines"."credit" > 0)),
	CONSTRAINT "ck_journal_entry_line_text_len" CHECK ("journal_entry_lines"."description" is null or char_length("journal_entry_lines"."description") <= 255)
);
--> statement-breakpoint
CREATE TABLE "accounting_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" "accounting_period_status" DEFAULT 'OPEN' NOT NULL,
	"closed_at" timestamp with time zone,
	"closed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_accounting_period_org_id" UNIQUE("org_id","id"),
	CONSTRAINT "ck_accounting_period_name_len" CHECK (char_length("accounting_periods"."name") BETWEEN 1 AND 80),
	CONSTRAINT "ck_accounting_period_range" CHECK ("accounting_periods"."start_date" <= "accounting_periods"."end_date"),
	CONSTRAINT "ck_accounting_period_closed" CHECK (("accounting_periods"."status" = 'CLOSED' and "accounting_periods"."closed_at" is not null) or ("accounting_periods"."status" = 'OPEN' and "accounting_periods"."closed_at" is null and "accounting_periods"."closed_by" is null))
);
--> statement-breakpoint
ALTER TABLE "account_mappings" ADD CONSTRAINT "account_mappings_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_mappings" ADD CONSTRAINT "fk_account_mapping_account" FOREIGN KEY ("org_id","account_id") REFERENCES "public"."accounts"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "fk_account_parent" FOREIGN KEY ("org_id","parent_id") REFERENCES "public"."accounts"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "fk_journal_entry_reversal_of" FOREIGN KEY ("org_id","reversal_of_id") REFERENCES "public"."journal_entries"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "fk_journal_entry_line_entry" FOREIGN KEY ("org_id","journal_entry_id") REFERENCES "public"."journal_entries"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "fk_journal_entry_line_account" FOREIGN KEY ("org_id","account_id") REFERENCES "public"."accounts"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting_periods" ADD CONSTRAINT "accounting_periods_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ux_account_mapping_org_key" ON "account_mappings" USING btree ("org_id","mapping_key");--> statement-breakpoint
CREATE INDEX "ix_account_mapping_account" ON "account_mappings" USING btree ("org_id","account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_account_org_code" ON "accounts" USING btree ("org_id",lower("code"));--> statement-breakpoint
CREATE UNIQUE INDEX "ux_account_org_system_key" ON "accounts" USING btree ("org_id","system_key") WHERE "accounts"."system_key" is not null;--> statement-breakpoint
CREATE INDEX "ix_account_org_parent" ON "accounts" USING btree ("org_id","parent_id");--> statement-breakpoint
CREATE INDEX "ix_account_org_type" ON "accounts" USING btree ("org_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_journal_entry_org_seq" ON "journal_entries" USING btree ("org_id","entry_seq");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_journal_entry_org_number" ON "journal_entries" USING btree ("org_id","entry_number");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_journal_entry_org_source" ON "journal_entries" USING btree ("org_id","source_type","source_id") WHERE "journal_entries"."source_id" is not null and "journal_entries"."reversal_of_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "ux_journal_entry_org_reversal" ON "journal_entries" USING btree ("org_id","reversal_of_id") WHERE "journal_entries"."reversal_of_id" is not null;--> statement-breakpoint
CREATE INDEX "ix_journal_entry_org_status_date" ON "journal_entries" USING btree ("org_id","status","entry_date");--> statement-breakpoint
CREATE INDEX "ix_journal_entry_org_date" ON "journal_entries" USING btree ("org_id","entry_date");--> statement-breakpoint
CREATE INDEX "ix_journal_entry_line_entry" ON "journal_entry_lines" USING btree ("org_id","journal_entry_id");--> statement-breakpoint
CREATE INDEX "ix_journal_entry_line_account" ON "journal_entry_lines" USING btree ("org_id","account_id");--> statement-breakpoint
CREATE INDEX "ix_accounting_period_org_dates" ON "accounting_periods" USING btree ("org_id","start_date","end_date");