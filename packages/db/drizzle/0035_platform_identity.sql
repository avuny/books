CREATE TYPE "public"."platform_admin_status" AS ENUM('invited', 'active', 'disabled');--> statement-breakpoint
CREATE TABLE "platform_admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"status" "platform_admin_status" DEFAULT 'invited' NOT NULL,
	"totp_secret_enc" text,
	"totp_enabled_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_admins_email_normalized_chk" CHECK (("platform_admins"."email" = lower(btrim("platform_admins"."email")) AND "platform_admins"."email" <> '')),
	CONSTRAINT "platform_admins_name_chk" CHECK (char_length("platform_admins"."name") between 1 and 100 and "platform_admins"."name" = btrim("platform_admins"."name")),
	CONSTRAINT "platform_admins_failed_attempts_chk" CHECK ("platform_admins"."failed_attempts" >= 0),
	CONSTRAINT "platform_admins_totp_pair_chk" CHECK (("platform_admins"."totp_enabled_at" is null) = ("platform_admins"."totp_secret_enc" is null)),
	CONSTRAINT "platform_admins_status_totp_chk" CHECK (("platform_admins"."status" = 'invited') = ("platform_admins"."totp_enabled_at" is null))
);
--> statement-breakpoint
CREATE TABLE "platform_admin_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"ip_address" "inet",
	"user_agent" text,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_admin_sessions_expiry_chk" CHECK ("platform_admin_sessions"."expires_at" > "platform_admin_sessions"."created_at")
);
--> statement-breakpoint
CREATE TABLE "platform_admin_roles" (
	"admin_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"granted_by" uuid,
	CONSTRAINT "platform_admin_roles_admin_id_role_id_pk" PRIMARY KEY("admin_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "platform_role_permissions" (
	"role_id" uuid NOT NULL,
	"permission_key" text NOT NULL,
	CONSTRAINT "platform_role_permissions_role_id_permission_key_pk" PRIMARY KEY("role_id","permission_key"),
	CONSTRAINT "platform_role_permissions_key_format_chk" CHECK ("platform_role_permissions"."permission_key" ~ '^[a-z][a-z0-9_]*:[a-z][a-z0-9-]*$')
);
--> statement-breakpoint
CREATE TABLE "platform_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_builtin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_roles_key_format_chk" CHECK ("platform_roles"."key" ~ '^[a-z][a-z0-9_]*$'),
	CONSTRAINT "platform_roles_name_chk" CHECK (char_length("platform_roles"."name") between 1 and 100 and "platform_roles"."name" = btrim("platform_roles"."name"))
);
--> statement-breakpoint
CREATE TABLE "platform_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"role_ids" uuid[] NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"invited_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_invites_email_normalized_chk" CHECK (("platform_invites"."email" = lower(btrim("platform_invites"."email")) AND "platform_invites"."email" <> '')),
	CONSTRAINT "platform_invites_expiry_chk" CHECK ("platform_invites"."expires_at" > "platform_invites"."created_at"),
	CONSTRAINT "platform_invites_role_ids_chk" CHECK (cardinality("platform_invites"."role_ids") >= 1),
	CONSTRAINT "platform_invites_terminal_chk" CHECK (not ("platform_invites"."accepted_at" is not null and "platform_invites"."revoked_at" is not null))
);
--> statement-breakpoint
CREATE TABLE "platform_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"admin_id" uuid,
	"action" text NOT NULL,
	"resource" text NOT NULL,
	"resource_id" text,
	"before" jsonb,
	"after" jsonb,
	"ip_address" "inet",
	CONSTRAINT "platform_audit_events_action_format_chk" CHECK ("platform_audit_events"."action" ~ '^[a-z][a-z0-9_.]*$'),
	CONSTRAINT "platform_audit_events_resource_format_chk" CHECK ("platform_audit_events"."resource" ~ '^[a-z][a-z0-9-]*$')
);
--> statement-breakpoint
ALTER TABLE "platform_admins" ADD CONSTRAINT "platform_admins_created_by_platform_admins_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."platform_admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_admin_sessions" ADD CONSTRAINT "platform_admin_sessions_admin_id_platform_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."platform_admins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_admin_roles" ADD CONSTRAINT "platform_admin_roles_admin_id_platform_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."platform_admins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_admin_roles" ADD CONSTRAINT "platform_admin_roles_role_id_platform_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."platform_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_admin_roles" ADD CONSTRAINT "platform_admin_roles_granted_by_platform_admins_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."platform_admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_role_permissions" ADD CONSTRAINT "platform_role_permissions_role_id_platform_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."platform_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_invites" ADD CONSTRAINT "platform_invites_invited_by_platform_admins_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."platform_admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "platform_admins_email_uidx" ON "platform_admins" USING btree ("email");--> statement-breakpoint
CREATE INDEX "platform_admins_status_idx" ON "platform_admins" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_admin_sessions_token_hash_uidx" ON "platform_admin_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "platform_admin_sessions_admin_id_idx" ON "platform_admin_sessions" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "platform_admin_sessions_expires_at_idx" ON "platform_admin_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_roles_key_uidx" ON "platform_roles" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_invites_token_hash_uidx" ON "platform_invites" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "platform_invites_email_idx" ON "platform_invites" USING btree ("email");--> statement-breakpoint
CREATE INDEX "platform_audit_events_admin_id_occurred_at_idx" ON "platform_audit_events" USING btree ("admin_id","occurred_at");--> statement-breakpoint
CREATE INDEX "platform_audit_events_resource_occurred_at_idx" ON "platform_audit_events" USING btree ("resource","resource_id","occurred_at");--> statement-breakpoint
CREATE INDEX "platform_audit_events_occurred_at_idx" ON "platform_audit_events" USING btree ("occurred_at");--> statement-breakpoint
-- PA-R6 / PLATFORM-ADMIN-SPEC 3.1: platform_audit_events is append-only, enforced in the
-- database (custom SQL on top of the generated migration): UPDATE and DELETE always raise.
CREATE OR REPLACE FUNCTION platform_audit_events_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'platform_audit_events is append-only: % is not allowed', TG_OP;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER platform_audit_events_append_only_update
  BEFORE UPDATE ON "platform_audit_events"
  FOR EACH ROW EXECUTE FUNCTION platform_audit_events_append_only();
--> statement-breakpoint
CREATE TRIGGER platform_audit_events_append_only_delete
  BEFORE DELETE ON "platform_audit_events"
  FOR EACH ROW EXECUTE FUNCTION platform_audit_events_append_only();
