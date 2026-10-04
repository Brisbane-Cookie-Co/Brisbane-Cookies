import { createInsertSchema } from "drizzle-zod";
import { boolean, integer, pgTable, serial, text } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const deliveryZonesTable = pgTable("delivery_zones", {
  id: serial("id").primaryKey(),
  suburb: text("suburb").notNull().unique(),
  postcode: text("postcode").notNull(),
  standardFeeCents: integer("standard_fee_cents").notNull(),
  expressFeeCents: integer("express_fee_cents").notNull(),
  minimumOrderCents: integer("minimum_order_cents").notNull().default(0),
  pickupAvailable: boolean("pickup_available").notNull().default(true),
});

export const insertDeliveryZoneSchema = createInsertSchema(deliveryZonesTable).omit({
  id: true,
});
export type InsertDeliveryZone = z.infer<typeof insertDeliveryZoneSchema>;
export type DeliveryZone = typeof deliveryZonesTable.$inferSelect;