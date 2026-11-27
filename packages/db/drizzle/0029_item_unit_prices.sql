CREATE TABLE "item_unit_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"unit_id" uuid NOT NULL,
	"cost_price" numeric(18, 6),
	"selling_price" numeric(18, 6),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ux_item_unit_price" UNIQUE("item_id","unit_id"),
	CONSTRAINT "ck_item_unit_price_non_negative" CHECK (("item_unit_prices"."cost_price" is null or "item_unit_prices"."cost_price" >= 0) and ("item_unit_prices"."selling_price" is null or "item_unit_prices"."selling_price" >= 0)),
	CONSTRAINT "ck_item_unit_price_any" CHECK ("item_unit_prices"."cost_price" is not null or "item_unit_prices"."selling_price" is not null)
);
--> statement-breakpoint
ALTER TABLE "item_unit_prices" ADD CONSTRAINT "item_unit_prices_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_unit_prices" ADD CONSTRAINT "item_unit_prices_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_unit_prices" ADD CONSTRAINT "fk_item_unit_price_item" FOREIGN KEY ("org_id","item_id") REFERENCES "public"."items"("org_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_item_unit_price_unit" ON "item_unit_prices" USING btree ("unit_id");