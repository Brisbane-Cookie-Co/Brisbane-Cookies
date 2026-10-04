import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  CreateOrderBody,
  CreateOrderResponse,
  GetOrderParams,
  GetOrderResponse,
} from "@workspace/api-zod";
import {
  cookiesTable,
  db,
  deliveryZonesTable,
  orderItemsTable,
  ordersTable,
} from "@workspace/db";

const router: IRouter = Router();
type OrderStatus = "received" | "baking" | "out_for_delivery" | "delivered";

function getProgressStatus(
  createdAt: Date,
  speed: string,
  now = Date.now(),
): OrderStatus {
  const elapsedSeconds = (now - createdAt.getTime()) / 1000;
  const milestones = speed === "express" ? [8, 25, 60] : [15, 45, 90];
  if (elapsedSeconds >= milestones[2]) return "delivered";
  if (elapsedSeconds >= milestones[1]) return "out_for_delivery";
  if (elapsedSeconds >= milestones[0]) return "baking";
  return "received";
}

async function loadOrder(orderNumber: string) {
  const [order] = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.orderNumber, orderNumber))
    .limit(1);
  if (!order) return null;

  const status = getProgressStatus(order.createdAt, order.speed);
  if (status !== order.status) {
    await db
      .update(ordersTable)
      .set({ status })
      .where(eq(ordersTable.id, order.id));
  }

  const items = await db
    .select({
      cookieId: orderItemsTable.cookieId,
      name: orderItemsTable.name,
      quantity: orderItemsTable.quantity,
      unitPriceCents: orderItemsTable.unitPriceCents,
    })
    .from(orderItemsTable)
    .where(eq(orderItemsTable.orderId, order.id));

  return { ...order, status, items };
}

router.post("/orders", async (req, res): Promise<void> => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid order");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const input = parsed.data;
  const requestedQuantities = new Map<number, number>();
  for (const item of input.items) {
    requestedQuantities.set(
      item.cookieId,
      (requestedQuantities.get(item.cookieId) ?? 0) + item.quantity,
    );
  }

  const totalCookies = [...requestedQuantities.values()].reduce(
    (total, quantity) => total + quantity,
    0,
  );
  if (input.boxSize !== null && input.boxSize !== undefined && totalCookies !== input.boxSize) {
    res.status(400).json({
      error: `This box needs ${input.boxSize} cookies, but ${totalCookies} were selected.`,
    });
    return;
  }

  const [zone] = await db
    .select()
    .from(deliveryZonesTable)
    .where(sql`lower(${deliveryZonesTable.suburb}) = ${input.suburb.trim().toLowerCase()}`)
    .limit(1);
  if (!zone) {
    res.status(404).json({ error: "That suburb is outside the Brisbane service area." });
    return;
  }
  if (input.fulfillment === "pickup" && !zone.pickupAvailable) {
    res.status(400).json({ error: "Pickup is not available for that suburb." });
    return;
  }

  const cookieIds = [...requestedQuantities.keys()];
  const cookies = await db
    .select()
    .from(cookiesTable)
    .where(inArray(cookiesTable.id, cookieIds));
  if (cookies.length !== cookieIds.length) {
    res.status(404).json({ error: "One or more cookies are no longer on the menu." });
    return;
  }

  for (const cookie of cookies) {
    const requested = requestedQuantities.get(cookie.id) ?? 0;
    if (requested > cookie.stock) {
      res.status(400).json({
        error: `Only ${cookie.stock} ${cookie.name} cookies are left.`,
      });
      return;
    }
  }

  const speed = input.fulfillment === "delivery" ? input.speed : "standard";
  const deliveryFeeCents =
    input.fulfillment === "pickup"
      ? 0
      : speed === "express"
        ? zone.expressFeeCents
        : zone.standardFeeCents;
  const subtotalCents = cookies.reduce(
    (total, cookie) =>
      total + cookie.priceCents * (requestedQuantities.get(cookie.id) ?? 0),
    0,
  );
  // Displayed menu and delivery prices include GST; 1/11 is the GST portion.
  const gstCents = Math.round((subtotalCents + deliveryFeeCents) / 11);
  const totalCents = subtotalCents + deliveryFeeCents;
  const orderNumber = `BCC-${randomUUID().slice(0, 8).toUpperCase()}`;

  try {
    const created = await db.transaction(async (tx) => {
      const lockedCookies = await tx
        .select()
        .from(cookiesTable)
        .where(inArray(cookiesTable.id, cookieIds))
        .for("update");

      for (const cookie of lockedCookies) {
        const requested = requestedQuantities.get(cookie.id) ?? 0;
        if (requested > cookie.stock) {
          throw new Error(`Only ${cookie.stock} ${cookie.name} cookies are left.`);
        }
      }

      const [order] = await tx
        .insert(ordersTable)
        .values({
          orderNumber,
          customerName: input.customerName.trim(),
          email: input.email.trim().toLowerCase(),
          phone: input.phone.trim(),
          suburb: zone.suburb,
          streetAddress: input.streetAddress?.trim() ?? "",
          fulfillment: input.fulfillment,
          speed,
          status: "received",
          boxSize: input.boxSize ?? null,
          giftNote: input.giftNote?.trim() ?? "",
          subtotalCents,
          gstCents,
          deliveryFeeCents,
          totalCents,
        })
        .returning();

      await tx.insert(orderItemsTable).values(
        cookies.map((cookie) => ({
          orderId: order.id,
          cookieId: cookie.id,
          name: cookie.name,
          quantity: requestedQuantities.get(cookie.id) ?? 0,
          unitPriceCents: cookie.priceCents,
        })),
      );

      for (const [cookieId, quantity] of requestedQuantities) {
        await tx
          .update(cookiesTable)
          .set({ stock: sql`${cookiesTable.stock} - ${quantity}` })
          .where(
            and(
              eq(cookiesTable.id, cookieId),
              sql`${cookiesTable.stock} >= ${quantity}`,
            ),
          );
      }

      return { ...order, items: cookies.map((cookie) => ({
        cookieId: cookie.id,
        name: cookie.name,
        quantity: requestedQuantities.get(cookie.id) ?? 0,
        unitPriceCents: cookie.priceCents,
      })) };
    });

    res.status(201).json(CreateOrderResponse.parse(created));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to place this order.";
    req.log.warn({ err: error }, "Order could not be placed");
    res.status(400).json({ error: message });
  }
});

router.get("/orders/:orderNumber", async (req, res): Promise<void> => {
  const params = GetOrderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const order = await loadOrder(params.data.orderNumber);
  if (!order) {
    res.status(404).json({ error: "Order not found." });
    return;
  }

  res.json(GetOrderResponse.parse(order));
});

export default router;