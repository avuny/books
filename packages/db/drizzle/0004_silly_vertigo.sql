CREATE TYPE "public"."permission_action" AS ENUM('*', 'read', 'update', 'delete', 'deactivate', 'create', 'assign');--> statement-breakpoint
CREATE TYPE "public"."permission_resource" AS ENUM('*', 'organization', 'organization_user', 'organization_invitation', 'role');--> statement-breakpoint
ALTER TABLE "role_permissions" DROP CONSTRAINT "ck_role_permission_resource";--> statement-breakpoint
ALTER TABLE "role_permissions" DROP CONSTRAINT "ck_role_permission_action";--> statement-breakpoint
ALTER TABLE "role_permissions" ALTER COLUMN "resource" SET DATA TYPE permission_resource USING resource::permission_resource;--> statement-breakpoint
ALTER TABLE "role_permissions" ALTER COLUMN "action" SET DATA TYPE permission_action USING action::permission_action;