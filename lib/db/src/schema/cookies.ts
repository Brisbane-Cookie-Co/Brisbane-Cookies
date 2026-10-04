import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import { boolean, integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export type ProductOption = {
  name: string;
  choices: string[];
  required: boolean;
};

export const cookiesTable = pgTable("cookies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull(),
  category: text("category").notNull().default("cookies"),
  priceCents: integer("price_cents").notNull(),
  stock: integer("stock").notNull().default(0),
  tags: text("tags").array().notNull(),
  imageUrl: text("image_url").notNull(),
  featured: boolean("featured").notNull().default(false),
  active: boolean("active").notNull().default(true),
  options: jsonb("options").$type<ProductOption[]>().notNull().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCookieSchema = createInsertSchema(cookiesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertCookie = z.infer<typeof insertCookieSchema>;
export type Cookie = typeof cookiesTable.$inferSelect;