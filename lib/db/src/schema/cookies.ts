import { createInsertSchema } from "drizzle-zod";
import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const cookiesTable = pgTable("cookies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull(),
  priceCents: integer("price_cents").notNull(),
  stock: integer("stock").notNull().default(0),
  tags: text("tags").array().notNull(),
  imageUrl: text("image_url").notNull(),
  featured: boolean("featured").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCookieSchema = createInsertSchema(cookiesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertCookie = z.infer<typeof insertCookieSchema>;
export type Cookie = typeof cookiesTable.$inferSelect;