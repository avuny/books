import { relations } from "drizzle-orm";
import {
  boolean,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import type { SidebarHeadingType, SidebarOptionName } from "@avuny/contracts";

// `name` is plain text typed from the module registry (@avuny/contracts,
// modules/registry.ts) on purpose: adding, renaming or removing a sidebar option or
// heading is a registry edit plus a seed run, never a migration.

// Sidebar headings

export const sidebarHeadings = pgTable("sidebar_headings", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  name: text("name").$type<SidebarHeadingType>().notNull().unique(),

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

  name: text("name").$type<SidebarOptionName>().notNull().unique(),

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
