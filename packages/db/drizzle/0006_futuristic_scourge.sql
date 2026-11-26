CREATE TYPE "public"."activity_log_action" AS ENUM('organization.created', 'organization.updated', 'organization.deleted', 'organization.ownership_transferred', 'organization_user.joined', 'organization_user.username_changed', 'organization_user.deactivated', 'organization_user.reactivated', 'organization_user.roles_changed', 'organization_invitation.created', 'organization_invitation.resent', 'organization_invitation.revoked', 'organization_invitation.accepted', 'organization_invitation.declined', 'role.created', 'role.updated', 'role.deleted');--> statement-breakpoint
CREATE TYPE "public"."activity_log_resource" AS ENUM('organization', 'organization_user', 'organization_invitation', 'role');--> statement-breakpoint
ALTER TYPE "public"."permission_resource" ADD VALUE 'activity_log';--> statement-breakpoint
CREATE TABLE "organization_activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"actor_id" uuid,
	"action" "activity_log_action" NOT NULL,
	"resource" "activity_log_resource" NOT NULL,
	"resource_id" uuid NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"request_id" varchar(64),
	"ip_address" varchar(45),
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "organization_invitations" DROP CONSTRAINT "ck_org_invitation_not_owner";--> statement-breakpoint
ALTER TABLE "organization_invitations" DROP CONSTRAINT "ck_org_invitation_target";--> statement-breakpoint
ALTER TABLE "organization_invitations" DROP CONSTRAINT "ck_org_invitation_channel";--> statement-breakpoint
ALTER TABLE "organization_invitations" DROP CONSTRAINT "ck_org_invitation_email_lower";--> statement-breakpoint
ALTER TABLE "organization_invitations" DROP CONSTRAINT "ck_org_invitation_phone_format";--> statement-breakpoint
ALTER TABLE "organization_invitations" DROP CONSTRAINT "ck_org_invitation_username_format";--> statement-breakpoint
DROP INDEX "ux_org_invitation_pending_email";--> statement-breakpoint
DROP INDEX "ux_org_invitation_pending_phone";--> statement-breakpoint
DROP INDEX "ix_org_invitation_email_pending";--> statement-breakpoint
DROP INDEX "ix_org_invitation_phone_pending";--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD COLUMN "identifier" text;--> statement-breakpoint
UPDATE "organization_invitations" SET "identifier" = COALESCE("email", "phone", "username", '');--> statement-breakpoint
ALTER TABLE "organization_invitations" ALTER COLUMN "identifier" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD COLUMN "role_id" uuid;--> statement-breakpoint
ALTER TABLE "organization_activity_logs" ADD CONSTRAINT "organization_activity_logs_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_activity_logs" ADD CONSTRAINT "organization_activity_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "org_activity_logs_org_created_idx" ON "organization_activity_logs" USING btree ("org_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "org_activity_logs_entity_idx" ON "organization_activity_logs" USING btree ("org_id","resource","resource_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "org_activity_logs_actor_idx" ON "organization_activity_logs" USING btree ("org_id","actor_id","created_at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD CONSTRAINT "organization_invitations_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ux_org_invitation_pending_identifier" ON "organization_invitations" USING btree ("org_id","identifier") WHERE "organization_invitations"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "ix_org_invitation_identifier_pending" ON "organization_invitations" USING btree ("identifier") WHERE "organization_invitations"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "ix_org_invitation_role" ON "organization_invitations" USING btree ("role_id");--> statement-breakpoint
ALTER TABLE "organization_invitations" DROP COLUMN "type";--> statement-breakpoint
ALTER TABLE "organization_invitations" DROP COLUMN "channel";--> statement-breakpoint
ALTER TABLE "organization_invitations" DROP COLUMN "email";--> statement-breakpoint
ALTER TABLE "organization_invitations" DROP COLUMN "phone";--> statement-breakpoint
ALTER TABLE "organization_invitations" DROP COLUMN "username";--> statement-breakpoint
ALTER TABLE "organization_invitations" ADD CONSTRAINT "ck_org_invitation_identifier_not_empty" CHECK (char_length("organization_invitations"."identifier") > 0);--> statement-breakpoint
DROP TYPE "public"."invitation_channel";