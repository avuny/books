CREATE TYPE "public"."invitation_channel" AS ENUM('email', 'whatsapp');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'declined', 'revoked', 'expired');--> statement-breakpoint
CREATE TYPE "public"."org_member_type" AS ENUM('owner', 'managed', 'portal');--> statement-breakpoint
CREATE TYPE "public"."org_status" AS ENUM('active', 'suspended', 'closed');--> statement-breakpoint
CREATE TABLE "cities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"country_code" char(2) NOT NULL,
	"state_id" uuid NOT NULL,
	"name" text NOT NULL,
	"native" text,
	"latitude" double precision,
	"longitude" double precision,
	"wiki_data_id" text
);
--> statement-breakpoint
CREATE TABLE "countries" (
	"code" char(2) PRIMARY KEY NOT NULL,
	"iso3" char(3),
	"numeric_code" char(3),
	"name" text NOT NULL,
	"native" text,
	"translations" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"capital" text,
	"tld" text,
	"phone_code" text,
	"currency_code" char(3),
	"region" text,
	"subregion" text,
	"latitude" double precision,
	"longitude" double precision,
	"emoji" text,
	"wiki_data_id" text,
	CONSTRAINT "ck_country_code" CHECK ("countries"."code" ~ '^[A-Z]{2}$')
);
--> statement-breakpoint
CREATE TABLE "country_timezones" (
	"country_code" char(2) NOT NULL,
	"timezone_name" text NOT NULL,
	CONSTRAINT "country_timezones_country_code_timezone_name_pk" PRIMARY KEY("country_code","timezone_name")
);
--> statement-breakpoint
CREATE TABLE "currencies" (
	"code" char(3) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"symbol" text,
	CONSTRAINT "ck_currency_code" CHECK ("currencies"."code" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
CREATE TABLE "states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"country_code" char(2) NOT NULL,
	"name" text NOT NULL,
	"native" text,
	"translations" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"code" text,
	"fips_code" text,
	"type" text,
	"latitude" double precision,
	"longitude" double precision,
	"wiki_data_id" text,
	CONSTRAINT "uq_state_country_id" UNIQUE("country_code","id")
);
--> statement-breakpoint
CREATE TABLE "timezones" (
	"name" text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"type" "org_member_type" NOT NULL,
	"channel" "invitation_channel" NOT NULL,
	"email" text,
	"phone" text,
	"invitee_user_id" uuid,
	"username" text,
	"token_hash" text NOT NULL,
	"status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"invited_by" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"responded_at" timestamp with time zone,
	"accepted_org_user_id" uuid,
	"send_count" integer DEFAULT 1 NOT NULL,
	"last_sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_org_invitation_not_owner" CHECK ("organization_invitations"."type" <> 'owner'),
	CONSTRAINT "ck_org_invitation_target" CHECK (num_nonnulls("organization_invitations"."email", "organization_invitations"."phone", "organization_invitations"."invitee_user_id") >= 1),
	CONSTRAINT "ck_org_invitation_channel" CHECK (("organization_invitations"."channel" = 'email' and "organization_invitations"."email" is not null)
        or ("organization_invitations"."channel" = 'whatsapp' and "organization_invitations"."phone" is not null)),
	CONSTRAINT "ck_org_invitation_email_lower" CHECK ("organization_invitations"."email" is null or "organization_invitations"."email" = lower("organization_invitations"."email")),
	CONSTRAINT "ck_org_invitation_phone_format" CHECK ("organization_invitations"."phone" is null or "organization_invitations"."phone" ~ '^\+[1-9][0-9]{7,14}$'),
	CONSTRAINT "ck_org_invitation_username_format" CHECK ("organization_invitations"."username" is null or "organization_invitations"."username" ~ '^[a-z0-9][a-z0-9._-]{2,30}$'),
	CONSTRAINT "ck_org_invitation_accepted_link" CHECK (("organization_invitations"."status" = 'accepted') = ("organization_invitations"."accepted_org_user_id" is not null)),
	CONSTRAINT "ck_org_invitation_expiry" CHECK ("organization_invitations"."expires_at" > "organization_invitations"."created_at")
);
--> statement-breakpoint
CREATE TABLE "organization_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "org_member_type" NOT NULL,
	"username" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_accessed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_org_users_org_id" UNIQUE("org_id","id"),
	CONSTRAINT "ck_org_user_username_format" CHECK ("organization_users"."username" ~ '^[a-z0-9][a-z0-9._-]{2,30}$')
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"status" "org_status" DEFAULT 'active' NOT NULL,
	"country_code" char(2),
	"state_id" uuid,
	"default_currency" char(3) NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "ck_org_code_format" CHECK ("organizations"."code" ~ '^[a-z0-9][a-z0-9-]{1,29}[a-z0-9]$'),
	CONSTRAINT "ck_org_code_no_double_hyphen" CHECK (position('--' in "organizations"."code") = 0),
	CONSTRAINT "ck_org_state_needs_country" CHECK ("organizations"."state_id" is null or "organizations"."country_code" is not null)
);
--> statement-breakpoint
ALTER TABLE "otps" DROP CONSTRAINT "otps_identifier_normalized_chk";--> statement-breakpoint
ALTER TABLE "user_identifiers" DROP CONSTRAINT "user_identifiers_value_normalized_chk";--> statement-breakpoint
ALTER TABLE "cities" ADD CONSTRAINT "fk_city_state" FOREIGN KEY ("country_code","state_id") REFERENCES "public"."states"("country_code","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "countries" ADD CONSTRAINT "countries_currency_code_currencies_code_fk" FOREIGN KEY ("currency_code") REFERENCES "public"."currencies"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "country_timezones" ADD CONSTRAINT "country_timezones_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "country_timezones" ADD CONSTRAINT "country_timezones_timezone_name_timezones_name_fk" FOREIGN KEY ("timezone_name") REFERENCES "public"."timezones"("name") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "states" ADD CONSTRAINT "states_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_invitee_user_id_users_id_fk" FOREIGN KEY ("invitee_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD CONSTRAINT "fk_org_invitation_inviter" FOREIGN KEY ("org_id","invited_by") REFERENCES "public"."organization_users"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD CONSTRAINT "fk_org_invitation_accepted_member" FOREIGN KEY ("org_id","accepted_org_user_id") REFERENCES "public"."organization_users"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_users" ADD CONSTRAINT "organization_users_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_users" ADD CONSTRAINT "organization_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_country_code_countries_code_fk" FOREIGN KEY ("country_code") REFERENCES "public"."countries"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_default_currency_currencies_code_fk" FOREIGN KEY ("default_currency") REFERENCES "public"."currencies"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_timezone_timezones_name_fk" FOREIGN KEY ("timezone") REFERENCES "public"."timezones"("name") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "fk_org_state" FOREIGN KEY ("country_code","state_id") REFERENCES "public"."states"("country_code","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ux_city_state_name" ON "cities" USING btree ("state_id","name");--> statement-breakpoint
CREATE INDEX "ix_city_country" ON "cities" USING btree ("country_code");--> statement-breakpoint
CREATE INDEX "ix_country_tz_zone" ON "country_timezones" USING btree ("timezone_name");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_state_country_name" ON "states" USING btree ("country_code","name");--> statement-breakpoint
CREATE INDEX "ix_state_country" ON "states" USING btree ("country_code");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_org_invitation_token" ON "organization_invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_org_invitation_pending_email" ON "organization_invitations" USING btree ("org_id","email") WHERE "organization_invitations"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "ux_org_invitation_pending_phone" ON "organization_invitations" USING btree ("org_id","phone") WHERE "organization_invitations"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "ux_org_invitation_pending_user" ON "organization_invitations" USING btree ("org_id","invitee_user_id") WHERE "organization_invitations"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "ix_org_invitation_email_pending" ON "organization_invitations" USING btree ("email") WHERE "organization_invitations"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "ix_org_invitation_phone_pending" ON "organization_invitations" USING btree ("phone") WHERE "organization_invitations"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "ix_org_invitation_user_pending" ON "organization_invitations" USING btree ("invitee_user_id") WHERE "organization_invitations"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "ix_org_invitation_org_status" ON "organization_invitations" USING btree ("org_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_org_user_member" ON "organization_users" USING btree ("org_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_org_user_username" ON "organization_users" USING btree ("org_id","username");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_org_one_owner" ON "organization_users" USING btree ("org_id") WHERE "organization_users"."type" = 'owner';--> statement-breakpoint
CREATE INDEX "ix_org_user_user_recent" ON "organization_users" USING btree ("user_id","last_accessed_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "ux_org_code" ON "organizations" USING btree ("code");--> statement-breakpoint
ALTER TABLE "otps" ADD CONSTRAINT "otps_identifier_normalized_chk" CHECK (("otps"."identifier" = lower(btrim("otps"."identifier")) AND "otps"."identifier" <> ''));--> statement-breakpoint
ALTER TABLE "user_identifiers" ADD CONSTRAINT "user_identifiers_value_normalized_chk" CHECK (("user_identifiers"."value" = lower(btrim("user_identifiers"."value")) AND "user_identifiers"."value" <> ''));