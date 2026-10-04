import { boolean, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const storeSettingsTable = pgTable("store_settings", {
  id: integer("id").primaryKey().default(1),
  storeName: text("store_name").notNull().default("Brisbane Cookie Co."),
  primaryColor: text("primary_color").notNull().default("#bd4c32"),
  heroAnnouncement: text("hero_announcement").notNull().default("Baked fresh in Brisbane, every day"),
  storeOpen: boolean("store_open").notNull().default(true),
  closureMessage: text("closure_message").notNull().default("The kitchen is closed for today. Please check back soon."),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});