CREATE TYPE "public"."party_role" AS ENUM('CUSTOMER', 'VENDOR');--> statement-breakpoint
CREATE TYPE "public"."party_salutation" AS ENUM('MR', 'MS', 'MRS', 'DR', 'PROF', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."party_type" AS ENUM('PERSON', 'ORGANIZATION');--> statement-breakpoint
CREATE TABLE "parties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"party_type" "party_type" NOT NULL,
	"salutation" "party_salutation",
	"display_name" text NOT NULL,
	"legal_name" text,
	"tax_number" text,
	"website" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_party_org_id" UNIQUE("org_id","id"),
	CONSTRAINT "ck_party_display_name_len" CHECK (char_length("parties"."display_name") BETWEEN 1 AND 150),
	CONSTRAINT "ck_party_legal_name_len" CHECK (char_length("parties"."legal_name") BETWEEN 1 AND 200),
	CONSTRAINT "ck_party_tax_number_len" CHECK (char_length("parties"."tax_number") BETWEEN 1 AND 50),
	CONSTRAINT "ck_party_website_len" CHECK (char_length("parties"."website") BETWEEN 1 AND 255),
	CONSTRAINT "ck_party_notes_len" CHECK (char_length("parties"."notes") BETWEEN 1 AND 2000),
	CONSTRAINT "ck_party_salutation_person_only" CHECK ("parties"."salutation" IS NULL OR "parties"."party_type" = 'PERSON')
);
--> statement-breakpoint
CREATE TABLE "party_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"party_id" uuid NOT NULL,
	"label" text,
	"address_line1" text NOT NULL,
	"address_line2" text,
	"city" text,
	"state" text,
	"postal_code" text,
	"country_code" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_party_address_label_len" CHECK (char_length("party_addresses"."label") BETWEEN 1 AND 50),
	CONSTRAINT "ck_party_address_line1_len" CHECK (char_length("party_addresses"."address_line1") BETWEEN 1 AND 200),
	CONSTRAINT "ck_party_address_line2_len" CHECK (char_length("party_addresses"."address_line2") BETWEEN 1 AND 200),
	CONSTRAINT "ck_party_address_city_len" CHECK (char_length("party_addresses"."city") BETWEEN 1 AND 100),
	CONSTRAINT "ck_party_address_state_len" CHECK (char_length("party_addresses"."state") BETWEEN 1 AND 100),
	CONSTRAINT "ck_party_address_postal_code_len" CHECK (char_length("party_addresses"."postal_code") BETWEEN 1 AND 20),
	CONSTRAINT "ck_party_address_country_code" CHECK ("party_addresses"."country_code" IS NULL OR "party_addresses"."country_code" ~ '^[A-Z]{2}$')
);
--> statement-breakpoint
CREATE TABLE "party_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"party_id" uuid NOT NULL,
	"email" text NOT NULL,
	"label" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_party_email_len" CHECK (char_length("party_emails"."email") BETWEEN 1 AND 254),
	CONSTRAINT "ck_party_email_label_len" CHECK (char_length("party_emails"."label") BETWEEN 1 AND 50)
);
--> statement-breakpoint
CREATE TABLE "party_phones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"party_id" uuid NOT NULL,
	"phone" text NOT NULL,
	"label" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_party_phone_len" CHECK (char_length("party_phones"."phone") BETWEEN 1 AND 32),
	CONSTRAINT "ck_party_phone_label_len" CHECK (char_length("party_phones"."label") BETWEEN 1 AND 50)
);
--> statement-breakpoint
CREATE TABLE "party_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"party_id" uuid NOT NULL,
	"role" "party_role" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_party_role_party_role" UNIQUE("org_id","party_id","role")
);
--> statement-breakpoint
ALTER TABLE "parties" ADD CONSTRAINT "parties_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_addresses" ADD CONSTRAINT "party_addresses_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_addresses" ADD CONSTRAINT "fk_party_address_party" FOREIGN KEY ("org_id","party_id") REFERENCES "public"."parties"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_emails" ADD CONSTRAINT "party_emails_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_emails" ADD CONSTRAINT "fk_party_email_party" FOREIGN KEY ("org_id","party_id") REFERENCES "public"."parties"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_phones" ADD CONSTRAINT "party_phones_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_phones" ADD CONSTRAINT "fk_party_phone_party" FOREIGN KEY ("org_id","party_id") REFERENCES "public"."parties"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_roles" ADD CONSTRAINT "party_roles_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party_roles" ADD CONSTRAINT "fk_party_role_party" FOREIGN KEY ("org_id","party_id") REFERENCES "public"."parties"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_party_org_display_name" ON "parties" USING btree ("org_id",lower("display_name"),"id");--> statement-breakpoint
CREATE INDEX "ix_party_address_party" ON "party_addresses" USING btree ("org_id","party_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_party_address_primary" ON "party_addresses" USING btree ("org_id","party_id") WHERE "party_addresses"."is_primary" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "ux_party_email_party_email" ON "party_emails" USING btree ("org_id","party_id",lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "ux_party_email_primary" ON "party_emails" USING btree ("org_id","party_id") WHERE "party_emails"."is_primary" = true;--> statement-breakpoint
CREATE INDEX "ix_party_phone_party" ON "party_phones" USING btree ("org_id","party_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_party_phone_primary" ON "party_phones" USING btree ("org_id","party_id") WHERE "party_phones"."is_primary" = true;--> statement-breakpoint
CREATE INDEX "ix_party_role_org_role_active" ON "party_roles" USING btree ("org_id","role","is_active","party_id");