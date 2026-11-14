CREATE TYPE "public"."shelf_life_unit" AS ENUM('DAY', 'MONTH', 'YEAR');--> statement-breakpoint
CREATE TYPE "public"."warehouse_location_system_role" AS ENUM('supplier', 'customer', 'adjustment', 'production', 'transit');--> statement-breakpoint
CREATE TABLE "item_expiry_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"default_shelf_life_value" integer,
	"default_shelf_life_unit" "shelf_life_unit",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_item_expiry_settings_item" UNIQUE("item_id"),
	CONSTRAINT "ck_item_expiry_settings_unit_and_value" CHECK (("item_expiry_settings"."default_shelf_life_value" IS NULL AND "item_expiry_settings"."default_shelf_life_unit" IS NULL) OR ("item_expiry_settings"."default_shelf_life_value" IS NOT NULL AND "item_expiry_settings"."default_shelf_life_unit" IS NOT NULL)),
	CONSTRAINT "ck_item_expiry_settings_positive_value" CHECK ("item_expiry_settings"."default_shelf_life_value" IS NULL OR "item_expiry_settings"."default_shelf_life_value" > 0)
);
--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "is_expiry_tracked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "warehouse_locations" ADD COLUMN "system_role" "warehouse_location_system_role";--> statement-breakpoint
ALTER TABLE "batches" ADD COLUMN "shelf_life_value" integer;--> statement-breakpoint
ALTER TABLE "batches" ADD COLUMN "shelf_life_unit" "shelf_life_unit";--> statement-breakpoint
ALTER TABLE "item_expiry_settings" ADD CONSTRAINT "item_expiry_settings_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_expiry_settings" ADD CONSTRAINT "fk_item_expiry_settings_item" FOREIGN KEY ("org_id","item_id") REFERENCES "public"."items"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ux_warehouse_location_org_system_role" ON "warehouse_locations" USING btree ("org_id","system_role") WHERE "warehouse_locations"."system_role" is not null;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "ck_item_expiry_requires_batch_and_tracking" CHECK (NOT "items"."is_expiry_tracked" OR ("items"."is_inventory_tracked" AND "items"."is_batch_tracked"));--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "ck_batch_shelf_life_unit_and_value" CHECK (("batches"."shelf_life_value" IS NULL AND "batches"."shelf_life_unit" IS NULL) OR ("batches"."shelf_life_value" IS NOT NULL AND "batches"."shelf_life_unit" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "ck_batch_shelf_life_positive_value" CHECK ("batches"."shelf_life_value" IS NULL OR "batches"."shelf_life_value" > 0);