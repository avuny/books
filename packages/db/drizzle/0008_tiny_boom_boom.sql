ALTER TABLE "organization_activity_logs" ALTER COLUMN "action" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "organization_activity_logs" ALTER COLUMN "resource" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."activity_log_action";--> statement-breakpoint
DROP TYPE "public"."activity_log_resource";