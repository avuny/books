ALTER TABLE "role_permissions" ALTER COLUMN "resource" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "role_permissions" ALTER COLUMN "action" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "sidebar_headings" ALTER COLUMN "name" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "sidebar_options" ALTER COLUMN "name" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."permission_action";--> statement-breakpoint
DROP TYPE "public"."permission_resource";--> statement-breakpoint
DROP TYPE "public"."sidebar_heading_type";--> statement-breakpoint
DROP TYPE "public"."sidebar_option_name";