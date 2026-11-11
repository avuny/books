DROP INDEX "ux_unit_symbol";--> statement-breakpoint
DROP INDEX "ux_unit_name";--> statement-breakpoint
ALTER TABLE "units" ADD COLUMN "org_id" uuid;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ux_unit_system_symbol" ON "units" USING btree ("symbol") WHERE "units"."org_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "ux_unit_system_name" ON "units" USING btree (lower("name")) WHERE "units"."org_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "ux_unit_org_symbol" ON "units" USING btree ("org_id","symbol") WHERE "units"."org_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "ux_unit_org_name" ON "units" USING btree ("org_id",lower("name")) WHERE "units"."org_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "ix_unit_org_id" ON "units" USING btree ("org_id");