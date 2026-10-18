CREATE TYPE "public"."platform_role" AS ENUM('user', 'support', 'admin');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."audit_outcome" AS ENUM('success', 'failure');--> statement-breakpoint
CREATE TYPE "public"."otp_purpose" AS ENUM('SIGN_UP', 'ADD_IDENTIFIER', 'UPDATE_IDENTIFIER', 'FORGET_PASSWORD');--> statement-breakpoint
CREATE TYPE "public"."session_platform" AS ENUM('web', 'mobile');--> statement-breakpoint
CREATE TYPE "public"."session_revoked_reason" AS ENUM('sign_out', 'sign_out_all', 'password_changed', 'password_reset', 'admin', 'suspended', 'reuse_detected');--> statement-breakpoint
CREATE TYPE "public"."identifier_type" AS ENUM('email', 'phone', 'username');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"platform_role" "platform_role" DEFAULT 'user' NOT NULL,
	"avatar_key" text,
	"suspended_at" timestamp with time zone,
	"suspended_reason" text,
	"last_sign_in_at" timestamp with time zone,
	"last_active_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_name_chk" CHECK (char_length("users"."name") between 1 and 100 and "users"."name" = btrim("users"."name")),
	CONSTRAINT "users_suspension_chk" CHECK (("users"."status" = 'suspended' and "users"."suspended_at" is not null and "users"."suspended_reason" is not null) or ("users"."status" = 'active' and "users"."suspended_at" is null and "users"."suspended_reason" is null))
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"event_type" text NOT NULL,
	"outcome" "audit_outcome" NOT NULL,
	"actor_user_id" uuid,
	"subject_user_id" uuid,
	"session_id" uuid,
	"identifier_hmac" text,
	"ip_address" "inet",
	"user_agent" text,
	"request_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "audit_events_event_type_format_chk" CHECK ("audit_events"."event_type" ~ '^[a-z_]+[.][a-z_]+$')
);
--> statement-breakpoint
CREATE TABLE "otps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purpose" "otp_purpose" NOT NULL,
	"identifier" text NOT NULL,
	"user_id" uuid,
	"otp_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"verified_at" timestamp with time zone,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "otps_identifier_normalized_chk" CHECK ("otps"."identifier" = btrim(lower("otps"."identifier"))),
	CONSTRAINT "otps_identifier_length_chk" CHECK (char_length("otps"."identifier") between 3 and 254),
	CONSTRAINT "otps_identifier_deliverable_chk" CHECK ("otps"."purpose" = 'FORGET_PASSWORD' or "otps"."identifier" ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' or "otps"."identifier" ~ '^[+][1-9][0-9]{6,14}$'),
	CONSTRAINT "otps_user_binding_chk" CHECK (("otps"."purpose" in ('ADD_IDENTIFIER', 'UPDATE_IDENTIFIER')) = ("otps"."user_id" is not null)),
	CONSTRAINT "otps_attempts_non_negative_chk" CHECK ("otps"."attempts" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"refresh_token_hash" text NOT NULL,
	"previous_refresh_token_hash" text,
	"platform" "session_platform" NOT NULL,
	"ip_address" "inet",
	"user_agent" text,
	"device_name" text,
	"expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_reason" "session_revoked_reason",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_revoked_pair_chk" CHECK (("sessions"."revoked_at" is null) = ("sessions"."revoked_reason" is null)),
	CONSTRAINT "sessions_previous_hash_differs_chk" CHECK ("sessions"."previous_refresh_token_hash" is distinct from "sessions"."refresh_token_hash")
);
--> statement-breakpoint
CREATE TABLE "user_identifiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "identifier_type" NOT NULL,
	"value" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_identifiers_value_normalized_chk" CHECK ("user_identifiers"."value" = btrim(lower("user_identifiers"."value"))),
	CONSTRAINT "user_identifiers_value_length_chk" CHECK (char_length("user_identifiers"."value") between 3 and 254),
	CONSTRAINT "user_identifiers_type_value_chk" CHECK (("user_identifiers"."type" = 'email' and "user_identifiers"."value" ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$') or ("user_identifiers"."type" = 'phone' and "user_identifiers"."value" ~ '^[+][1-9][0-9]{6,14}$') or ("user_identifiers"."type" = 'username' and "user_identifiers"."value" !~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$' and "user_identifiers"."value" !~ '^[+][1-9][0-9]{6,14}$' and "user_identifiers"."value" !~ '[[:space:]]')),
	CONSTRAINT "user_identifiers_verified_chk" CHECK ("user_identifiers"."type" = 'username' or "user_identifiers"."verified_at" is not null)
);
--> statement-breakpoint
ALTER TABLE "otps" ADD CONSTRAINT "otps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_identifiers" ADD CONSTRAINT "user_identifiers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "users_status_idx" ON "users" USING btree ("status");--> statement-breakpoint
CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_events_subject_user_id_occurred_at_idx" ON "audit_events" USING btree ("subject_user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_events_event_type_occurred_at_idx" ON "audit_events" USING btree ("event_type","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_events_occurred_at_idx" ON "audit_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "audit_events_ip_address_occurred_at_idx" ON "audit_events" USING btree ("ip_address","occurred_at") WHERE "audit_events"."ip_address" is not null;--> statement-breakpoint
CREATE INDEX "audit_events_identifier_hmac_occurred_at_idx" ON "audit_events" USING btree ("identifier_hmac","occurred_at") WHERE "audit_events"."identifier_hmac" is not null;--> statement-breakpoint
CREATE INDEX "otps_identifier_purpose_created_at_idx" ON "otps" USING btree ("identifier","purpose","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "otps_one_pending_per_identifier_purpose_uidx" ON "otps" USING btree ("identifier","purpose") WHERE "otps"."verified_at" is null and "otps"."consumed_at" is null;--> statement-breakpoint
CREATE INDEX "otps_user_id_idx" ON "otps" USING btree ("user_id") WHERE "otps"."user_id" is not null;--> statement-breakpoint
CREATE INDEX "otps_expires_at_idx" ON "otps" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_refresh_token_hash_uidx" ON "sessions" USING btree ("refresh_token_hash");--> statement-breakpoint
CREATE INDEX "sessions_previous_refresh_token_hash_idx" ON "sessions" USING btree ("previous_refresh_token_hash") WHERE "sessions"."previous_refresh_token_hash" is not null;--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_identifiers_type_value_uidx" ON "user_identifiers" USING btree ("type","value");--> statement-breakpoint
CREATE UNIQUE INDEX "user_identifiers_one_primary_per_user_uidx" ON "user_identifiers" USING btree ("user_id") WHERE "user_identifiers"."is_primary" = true;--> statement-breakpoint
CREATE INDEX "user_identifiers_user_id_idx" ON "user_identifiers" USING btree ("user_id");