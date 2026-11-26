ALTER TABLE "purchase_orders" DROP CONSTRAINT "ck_purchase_order_amount_max";--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD COLUMN "discount_rate_bps" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD COLUMN "tax_rate_bps" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD COLUMN "tax_amount" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD COLUMN "line_total_amount" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "tax_amount" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "ck_purchase_order_line_rate_bps" CHECK ("purchase_order_lines"."discount_rate_bps" between 0 and 10000 and "purchase_order_lines"."tax_rate_bps" between 0 and 10000);--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "ck_purchase_order_line_tax_amount" CHECK ("purchase_order_lines"."tax_amount" between 0 and 999999999999999 and "purchase_order_lines"."line_total_amount" between 0 and 999999999999999);--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "ck_purchase_order_amount_max" CHECK ("purchase_orders"."subtotal_amount" between 0 and 999999999999999 and "purchase_orders"."discount_amount" between 0 and 999999999999999 and "purchase_orders"."tax_amount" between 0 and 999999999999999 and "purchase_orders"."total_amount" between 0 and 999999999999999);