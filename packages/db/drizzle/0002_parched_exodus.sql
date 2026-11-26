CREATE TYPE "public"."permission_effect" AS ENUM('allow', 'deny');--> statement-breakpoint
CREATE TABLE "organization_user_roles" (
	"org_id" uuid NOT NULL,
	"org_user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"assigned_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_user_roles_org_user_id_role_id_pk" PRIMARY KEY("org_user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role_id" uuid NOT NULL,
	"effect" "permission_effect" DEFAULT 'allow' NOT NULL,
	"resource" text NOT NULL,
	"action" text NOT NULL,
	"resource_id" text DEFAULT '*' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_role_permission" UNIQUE("role_id","effect","resource","action","resource_id"),
	CONSTRAINT "ck_role_permission_resource" CHECK ("role_permissions"."resource" ~ '^([a-z][a-z0-9_]*|\*)$'),
	CONSTRAINT "ck_role_permission_action" CHECK ("role_permissions"."action" ~ '^([a-z][a-z0-9_]*|\*)$')
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_role_name_len" CHECK (char_length("roles"."name") BETWEEN 2 AND 60)
);
--> statement-breakpoint
ALTER TABLE "organization_user_roles" ADD CONSTRAINT "organization_user_roles_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_user_roles" ADD CONSTRAINT "organization_user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_user_roles" ADD CONSTRAINT "organization_user_roles_assigned_by_user_id_users_id_fk" FOREIGN KEY ("assigned_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_user_roles" ADD CONSTRAINT "fk_org_user_roles_member" FOREIGN KEY ("org_id","org_user_id") REFERENCES "public"."organization_users"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_org_user_roles_role" ON "organization_user_roles" USING btree ("role_id");--> statement-breakpoint
CREATE INDEX "ix_role_permission_role" ON "role_permissions" USING btree ("role_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_role_org_name" ON "roles" USING btree ("org_id","name") WHERE "roles"."org_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "ux_role_system_name" ON "roles" USING btree ("name") WHERE "roles"."org_id" IS NULL;