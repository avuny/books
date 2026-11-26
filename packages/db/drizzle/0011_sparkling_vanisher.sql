CREATE TYPE "public"."warehouse_location_purpose" AS ENUM('storage', 'receiving', 'picking', 'shipping', 'staging', 'quarantine', 'in_transit', 'production');--> statement-breakpoint
CREATE TYPE "public"."warehouse_location_type" AS ENUM('zone', 'area', 'dock', 'aisle', 'rack', 'bay', 'level', 'shelf', 'bin', 'virtual_bin');--> statement-breakpoint
CREATE TYPE "public"."warehouse_type" AS ENUM('physical', 'virtual');--> statement-breakpoint
CREATE TABLE "warehouse_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"parent_id" uuid,
	"code" text NOT NULL,
	"full_code" text NOT NULL,
	"name" text NOT NULL,
	"type" "warehouse_location_type" NOT NULL,
	"purpose" "warehouse_location_purpose" DEFAULT 'storage' NOT NULL,
	"path_ids" uuid[] NOT NULL,
	"tree_depth" smallint NOT NULL,
	"barcode" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_stockable" boolean DEFAULT false NOT NULL,
	"is_pickable" boolean DEFAULT false NOT NULL,
	"is_receivable" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_blocked" boolean DEFAULT false NOT NULL,
	"blocked_reason" text,
	"blocked_at" timestamp with time zone,
	"max_weight" numeric(14, 3),
	"max_volume" numeric(14, 4),
	"width" numeric(10, 2),
	"height" numeric(10, 2),
	"depth" numeric(10, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_warehouse_location_org_id" UNIQUE("org_id","id"),
	CONSTRAINT "ux_warehouse_location_org_warehouse_id" UNIQUE("org_id","warehouse_id","id"),
	CONSTRAINT "ck_warehouse_location_code_len" CHECK (char_length("warehouse_locations"."code") BETWEEN 1 AND 32),
	CONSTRAINT "ck_warehouse_location_code_fmt" CHECK ("warehouse_locations"."code" = upper("warehouse_locations"."code") and position('/' in "warehouse_locations"."code") = 0),
	CONSTRAINT "ck_warehouse_location_full_code_len" CHECK (char_length("warehouse_locations"."full_code") between 1 and 255),
	CONSTRAINT "ck_warehouse_location_name_len" CHECK (char_length("warehouse_locations"."name") BETWEEN 1 AND 120),
	CONSTRAINT "ck_warehouse_location_barcode_len" CHECK ("warehouse_locations"."barcode" is null or char_length("warehouse_locations"."barcode") between 1 and 64),
	CONSTRAINT "ck_warehouse_location_block_reason_len" CHECK ("warehouse_locations"."blocked_reason" is null or char_length("warehouse_locations"."blocked_reason") <= 255),
	CONSTRAINT "ck_warehouse_location_stockable_type" CHECK (not "warehouse_locations"."is_stockable" or "warehouse_locations"."type" in ('area', 'dock', 'level', 'shelf', 'bin', 'virtual_bin')),
	CONSTRAINT "ck_warehouse_location_flags" CHECK ("warehouse_locations"."is_stockable" or (not "warehouse_locations"."is_pickable" and not "warehouse_locations"."is_receivable")),
	CONSTRAINT "ck_warehouse_location_block" CHECK (("warehouse_locations"."is_blocked" and "warehouse_locations"."blocked_reason" is not null and "warehouse_locations"."blocked_at" is not null)
                or (not "warehouse_locations"."is_blocked" and "warehouse_locations"."blocked_reason" is null and "warehouse_locations"."blocked_at" is null)),
	CONSTRAINT "ck_warehouse_location_tree_depth" CHECK ("warehouse_locations"."tree_depth" between 0 and 6
                and "warehouse_locations"."tree_depth" = cardinality("warehouse_locations"."path_ids") - 1),
	CONSTRAINT "ck_warehouse_location_path" CHECK ("warehouse_locations"."path_ids"[cardinality("warehouse_locations"."path_ids")] = "warehouse_locations"."id"),
	CONSTRAINT "ck_warehouse_location_measures" CHECK (("warehouse_locations"."max_weight" is null or "warehouse_locations"."max_weight" > 0) and ("warehouse_locations"."max_volume" is null or "warehouse_locations"."max_volume" > 0)
                and ("warehouse_locations"."width" is null or "warehouse_locations"."width" > 0) and ("warehouse_locations"."height" is null or "warehouse_locations"."height" > 0)
                and ("warehouse_locations"."depth" is null or "warehouse_locations"."depth" > 0))
);
--> statement-breakpoint
CREATE TABLE "warehouses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" "warehouse_type" NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"address_line" text,
	"city" text,
	"region" text,
	"postal_code" text,
	"country_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_warehouse_org_id" UNIQUE("org_id","id"),
	CONSTRAINT "ck_warehouse_code_len" CHECK (char_length("warehouses"."code") BETWEEN 1 AND 32),
	CONSTRAINT "ck_warehouse_code_fmt" CHECK ("warehouses"."code" = upper("warehouses"."code") and position('/' in "warehouses"."code") = 0),
	CONSTRAINT "ck_warehouse_name_len" CHECK (char_length("warehouses"."name") BETWEEN 1 AND 120),
	CONSTRAINT "ck_warehouse_description_len" CHECK ("warehouses"."description" is null or char_length("warehouses"."description") <= 500),
	CONSTRAINT "ck_warehouse_address_len" CHECK (("warehouses"."address_line" is null or char_length("warehouses"."address_line") <= 200)
                and ("warehouses"."city" is null or char_length("warehouses"."city") <= 100)
                and ("warehouses"."region" is null or char_length("warehouses"."region") <= 100)
                and ("warehouses"."postal_code" is null or char_length("warehouses"."postal_code") <= 20)),
	CONSTRAINT "ck_warehouse_country_code" CHECK ("warehouses"."country_code" is null or char_length("warehouses"."country_code") = 2),
	CONSTRAINT "ck_warehouse_default" CHECK (not "warehouses"."is_default" or ("warehouses"."is_active" and not "warehouses"."is_system" and "warehouses"."type" = 'physical')),
	CONSTRAINT "ck_warehouse_system_virtual" CHECK (not "warehouses"."is_system" or "warehouses"."type" = 'virtual'),
	CONSTRAINT "ck_warehouse_virtual_no_address" CHECK ("warehouses"."type" = 'physical'
                or ("warehouses"."address_line" is null and "warehouses"."city" is null and "warehouses"."region" is null
                    and "warehouses"."postal_code" is null and "warehouses"."country_code" is null))
);
--> statement-breakpoint
ALTER TABLE "warehouse_locations" ADD CONSTRAINT "warehouse_locations_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_locations" ADD CONSTRAINT "fk_warehouse_location_warehouse" FOREIGN KEY ("org_id","warehouse_id") REFERENCES "public"."warehouses"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouse_locations" ADD CONSTRAINT "fk_warehouse_location_parent" FOREIGN KEY ("org_id","warehouse_id","parent_id") REFERENCES "public"."warehouse_locations"("org_id","warehouse_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ux_warehouse_location_root_code" ON "warehouse_locations" USING btree ("org_id","warehouse_id",lower("code")) WHERE "warehouse_locations"."parent_id" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "ux_warehouse_location_child_code" ON "warehouse_locations" USING btree ("org_id","parent_id",lower("code")) WHERE "warehouse_locations"."parent_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "ux_warehouse_location_full_code" ON "warehouse_locations" USING btree ("org_id","warehouse_id",lower("full_code"));--> statement-breakpoint
CREATE UNIQUE INDEX "ux_warehouse_location_org_barcode" ON "warehouse_locations" USING btree ("org_id",lower("barcode")) WHERE "warehouse_locations"."barcode" is not null;--> statement-breakpoint
CREATE INDEX "ix_warehouse_location_tree" ON "warehouse_locations" USING btree ("org_id","warehouse_id","parent_id","sort_order","code");--> statement-breakpoint
CREATE INDEX "ix_warehouse_location_stockable" ON "warehouse_locations" USING btree ("org_id","warehouse_id") WHERE "warehouse_locations"."is_stockable";--> statement-breakpoint
CREATE INDEX "ix_warehouse_location_path" ON "warehouse_locations" USING gin ("path_ids");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_warehouse_org_code" ON "warehouses" USING btree ("org_id",lower("code"));--> statement-breakpoint
CREATE UNIQUE INDEX "ux_warehouse_org_default" ON "warehouses" USING btree ("org_id") WHERE "warehouses"."is_default";