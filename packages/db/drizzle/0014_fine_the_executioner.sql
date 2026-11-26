ALTER TABLE "batches" ADD COLUMN "cost" numeric(18, 6);--> statement-breakpoint
ALTER TABLE "batches" ADD COLUMN "quantity" numeric(18, 6);--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "ck_batch_cost_non_negative" CHECK ("batches"."cost" IS NULL OR "batches"."cost" >= 0);--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "ck_batch_quantity_non_negative" CHECK ("batches"."quantity" IS NULL OR "batches"."quantity" >= 0);