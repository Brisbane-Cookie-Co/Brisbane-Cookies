import { pgTable, serial, text } from "drizzle-orm/pg-core";

export const productCategoriesTable = pgTable("product_categories", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull().unique(),
});