ALTER TABLE "items" ADD COLUMN "cost_price" numeric(18, 6);--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "selling_price" numeric(18, 6);--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "ck_item_prices_non_negative" CHECK (("items"."cost_price" is null or "items"."cost_price" >= 0) and ("items"."selling_price" is null or "items"."selling_price" >= 0));