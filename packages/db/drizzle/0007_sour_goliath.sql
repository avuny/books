CREATE TYPE "public"."unit_type" AS ENUM('count', 'weight', 'length', 'area', 'volume');--> statement-breakpoint
CREATE TYPE "public"."inventory_valuation_method" AS ENUM('fifo', 'weighted_average');--> statement-breakpoint
CREATE TABLE "unit_collection_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_collection_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"conversion_factor" numeric(24, 12) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_unit_collection_unit" UNIQUE("unit_collection_id","unit_id"),
	CONSTRAINT "ck_unit_collection_unit_factor" CHECK ("unit_collection_units"."conversion_factor" > 0)
);
--> statement-breakpoint
CREATE TABLE "unit_collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"base_unit_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_unit_collection_org_id_base_unit" UNIQUE("org_id","id","base_unit_id"),
	CONSTRAINT "ck_unit_collection_name_len" CHECK (char_length("unit_collections"."name") BETWEEN 1 AND 120)
);
--> statement-breakpoint
CREATE TABLE "units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"symbol" text NOT NULL,
	"type" "unit_type" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ck_unit_name_len" CHECK (char_length("units"."name") BETWEEN 1 AND 60),
	CONSTRAINT "ck_unit_symbol_len" CHECK (char_length("units"."symbol") BETWEEN 1 AND 16)
);
--> statement-breakpoint
CREATE TABLE "item_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"parent_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_item_category_org_id" UNIQUE("org_id","id"),
	CONSTRAINT "ck_item_category_name_len" CHECK (char_length("item_categories"."name") BETWEEN 1 AND 100),
	CONSTRAINT "ck_item_category_not_own_parent" CHECK ("item_categories"."parent_id" IS NULL OR "item_categories"."parent_id" <> "item_categories"."id")
);
--> statement-breakpoint
CREATE TABLE "item_inventory_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"reorder_point" numeric(18, 6),
	"allow_negative_stock" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_item_inventory_settings_item" UNIQUE("item_id"),
	CONSTRAINT "ck_item_inventory_settings_reorder_point" CHECK ("item_inventory_settings"."reorder_point" IS NULL OR "item_inventory_settings"."reorder_point" >= 0)
);
--> statement-breakpoint
CREATE TABLE "item_warehouse_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"reorder_point" numeric(18, 6),
	"reorder_quantity" numeric(18, 6),
	"minimum_stock" numeric(18, 6),
	"maximum_stock" numeric(18, 6),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_item_warehouse_setting" UNIQUE("item_id","warehouse_id"),
	CONSTRAINT "ck_item_warehouse_setting_non_negative" CHECK (COALESCE("item_warehouse_settings"."reorder_point", 0) >= 0
                AND COALESCE("item_warehouse_settings"."reorder_quantity", 0) >= 0
                AND COALESCE("item_warehouse_settings"."minimum_stock", 0) >= 0
                AND COALESCE("item_warehouse_settings"."maximum_stock", 0) >= 0),
	CONSTRAINT "ck_item_warehouse_setting_stock_range" CHECK ("item_warehouse_settings"."minimum_stock" IS NULL OR "item_warehouse_settings"."maximum_stock" IS NULL
                OR "item_warehouse_settings"."minimum_stock" <= "item_warehouse_settings"."maximum_stock")
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"base_unit_id" uuid NOT NULL,
	"unit_collection_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"can_assembled" boolean DEFAULT false NOT NULL,
	"is_returnable" boolean DEFAULT true NOT NULL,
	"is_inventory_tracked" boolean DEFAULT true NOT NULL,
	"is_batch_tracked" boolean DEFAULT false NOT NULL,
	"inventory_valuation_method" "inventory_valuation_method" DEFAULT 'fifo' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_item_org_id" UNIQUE("org_id","id"),
	CONSTRAINT "ck_item_name_len" CHECK (char_length("items"."name") BETWEEN 1 AND 200),
	CONSTRAINT "ck_item_batch_requires_tracking" CHECK (NOT "items"."is_batch_tracked" OR "items"."is_inventory_tracked")
);
--> statement-breakpoint
ALTER TABLE "unit_collection_units" ADD CONSTRAINT "unit_collection_units_unit_collection_id_unit_collections_id_fk" FOREIGN KEY ("unit_collection_id") REFERENCES "public"."unit_collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_collection_units" ADD CONSTRAINT "unit_collection_units_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_collections" ADD CONSTRAINT "unit_collections_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unit_collections" ADD CONSTRAINT "unit_collections_base_unit_id_units_id_fk" FOREIGN KEY ("base_unit_id") REFERENCES "public"."units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_categories" ADD CONSTRAINT "item_categories_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_categories" ADD CONSTRAINT "fk_item_category_parent" FOREIGN KEY ("org_id","parent_id") REFERENCES "public"."item_categories"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_inventory_settings" ADD CONSTRAINT "item_inventory_settings_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_inventory_settings" ADD CONSTRAINT "fk_item_inventory_settings_item" FOREIGN KEY ("org_id","item_id") REFERENCES "public"."items"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_warehouse_settings" ADD CONSTRAINT "item_warehouse_settings_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_warehouse_settings" ADD CONSTRAINT "fk_item_warehouse_setting_item" FOREIGN KEY ("org_id","item_id") REFERENCES "public"."items"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "fk_item_unit_collection" FOREIGN KEY ("org_id","unit_collection_id","base_unit_id") REFERENCES "public"."unit_collections"("org_id","id","base_unit_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "fk_item_category" FOREIGN KEY ("org_id","category_id") REFERENCES "public"."item_categories"("org_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_unit_collection_unit_unit" ON "unit_collection_units" USING btree ("unit_id");--> statement-breakpoint
CREATE INDEX "ix_unit_collection_base_unit" ON "unit_collections" USING btree ("base_unit_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_unit_symbol" ON "units" USING btree ("symbol");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_unit_name" ON "units" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "ux_item_category_root_name" ON "item_categories" USING btree ("org_id",lower("name")) WHERE "item_categories"."parent_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "ux_item_category_sibling_name" ON "item_categories" USING btree ("org_id","parent_id",lower("name")) WHERE "item_categories"."parent_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "ix_item_category_parent" ON "item_categories" USING btree ("org_id","parent_id");--> statement-breakpoint
CREATE INDEX "ix_item_warehouse_setting_warehouse" ON "item_warehouse_settings" USING btree ("warehouse_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_item_org_name" ON "items" USING btree ("org_id",lower("name"));--> statement-breakpoint
CREATE INDEX "ix_item_org_category" ON "items" USING btree ("org_id","category_id");--> statement-breakpoint
CREATE INDEX "ix_item_unit_collection" ON "items" USING btree ("unit_collection_id");