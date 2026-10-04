import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import { integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { cookiesTable } from "./cookies";

export type OrderItemSelection = { name: string; value: string };

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  customerName: text("customer_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  suburb: text("suburb").notNull(),
  streetAddress: text("street_address").notNull().default(""),
  fulfillment: text("fulfillment").notNull(),
  speed: text("speed").notNull().default("standard"),
  status: text("status").notNull().default("received"),
  boxSize: integer("box_size"),
  giftNote: text("gift_note").notNull().default(""),
  subtotalCents: integer("subtotal_cents").notNull(),
  gstCents: integer("gst_cents").notNull(),
  deliveryFeeCents: integer("delivery_fee_cents").notNull(),
  totalCents: integer("total_cents").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orderItemsTable = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => ordersTable.id, { onDelete: "cascade" }),
  cookieId: integer("cookie_id")
    .notNull()
    .references(() => cookiesTable.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  quantity: integer("quantity").notNull(),
  unitPriceCents: integer("unit_price_cents").notNull(),
  selections: jsonb("selections").$type<OrderItemSelection[]>().notNull().default(sql`'[]'::jsonb`),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({
  id: true,
  createdAt: true,
});
export const insertOrderItemSchema = createInsertSchema(orderItemsTable).omit({
  id: true,
});
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type Order = typeof ordersTable.$inferSelect;
export type OrderItem = typeof orderItemsTable.$inferSelect;