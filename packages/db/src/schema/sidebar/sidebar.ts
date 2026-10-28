import { relations } from "drizzle-orm";
import {
  boolean,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

// Enums (keep in sync with @avuny/contracts -> sidebar/constants.ts)

export const sidebarHeadingTypeEnum = pgEnum("sidebar_heading_type", [
  "users",
  "purchases",
  "sales",
  "inventory",
]);

export const sidebarOptionNameEnum = pgEnum("sidebar_option_name", [
  "user",
  "role",
  "item",
  "unit",
  "unitCollection",
  "invoice",
  "customer",
  "supplier",
  "purchaseOrder",
  "salesOrder",
  "warehouse",
  "organization",
  "organizationUser",
  "report",
  "receipt",
]);

// Sidebar headings

export const sidebarHeadings = pgTable("sidebar_headings", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  name: sidebarHeadingTypeEnum("name").notNull().unique(),

  icon: text("icon").notNull(),

  isActive: boolean("isActive").notNull().default(true),

  createdAt: timestamp("createdAt", { precision: 3 })
    .notNull()
    .defaultNow(),

  updatedAt: timestamp("updatedAt", { precision: 3 })
    .notNull()
    .$onUpdate(() => new Date()),
});

// Sidebar options

export const sidebarOptions = pgTable("sidebar_options", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  name: sidebarOptionNameEnum("name").notNull().unique(),

  icon: text("icon"),

  path: text("path").notNull(),

  sidebarHeadingId: text("sidebarHeadingId")
    .notNull()
    .references(() => sidebarHeadings.id, {
      onDelete: "cascade",
    }),

  isActive: boolean("isActive").notNull().default(true),

  createdAt: timestamp("createdAt", { precision: 3 })
    .notNull()
    .defaultNow(),

  updatedAt: timestamp("updatedAt", { precision: 3 })
    .notNull()
    .$onUpdate(() => new Date()),
});

// Relations

export const sidebarHeadingsRelations = relations(
  sidebarHeadings,
  ({ many }) => ({
    sidebarOptions: many(sidebarOptions),
  }),
);

export const sidebarOptionsRelations = relations(
  sidebarOptions,
  ({ one }) => ({
    sidebarHeading: one(sidebarHeadings, {
      fields: [sidebarOptions.sidebarHeadingId],
      references: [sidebarHeadings.id],
    }),
  }),
);

// Inferred types

export type SidebarHeading = typeof sidebarHeadings.$inferSelect;
export type NewSidebarHeading = typeof sidebarHeadings.$inferInsert;

export type SidebarOption = typeof sidebarOptions.$inferSelect;
export type NewSidebarOption = typeof sidebarOptions.$inferInsert;
