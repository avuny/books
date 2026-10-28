CREATE TYPE "public"."sidebar_heading_type" AS ENUM('users', 'purchases', 'sales', 'inventory');--> statement-breakpoint
CREATE TYPE "public"."sidebar_option_name" AS ENUM('user', 'role', 'item', 'unit', 'unitCollection', 'invoice', 'customer', 'supplier', 'purchaseOrder', 'salesOrder', 'warehouse', 'organization', 'organizationUser', 'report', 'receipt');--> statement-breakpoint
CREATE TABLE "sidebar_headings" (
	"id" text PRIMARY KEY NOT NULL,
	"name" "sidebar_heading_type" NOT NULL,
	"icon" text NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL,
	CONSTRAINT "sidebar_headings_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "sidebar_options" (
	"id" text PRIMARY KEY NOT NULL,
	"name" "sidebar_option_name" NOT NULL,
	"icon" text,
	"path" text NOT NULL,
	"sidebarHeadingId" text NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp (3) DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) NOT NULL,
	CONSTRAINT "sidebar_options_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "sidebar_options" ADD CONSTRAINT "sidebar_options_sidebarHeadingId_sidebar_headings_id_fk" FOREIGN KEY ("sidebarHeadingId") REFERENCES "public"."sidebar_headings"("id") ON DELETE cascade ON UPDATE no action;