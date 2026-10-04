import { Router, type IRouter } from "express";
import {
  CheckDeliveryZoneQueryParams,
  CheckDeliveryZoneResponse,
  ListDeliveryZonesResponse,
} from "@workspace/api-zod";
import { db, deliveryZonesTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/delivery-zones", async (_req, res): Promise<void> => {
  const zones = await db
    .select()
    .from(deliveryZonesTable)
    .orderBy(deliveryZonesTable.suburb);
  res.json(ListDeliveryZonesResponse.parse(zones));
});

router.get("/delivery-zones/check", async (req, res): Promise<void> => {
  const parsed = CheckDeliveryZoneQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const zones = await db.select().from(deliveryZonesTable);
  const suburb = parsed.data.suburb.trim();
  const zone =
    zones.find(
      (candidate) => candidate.suburb.toLowerCase() === suburb.toLowerCase(),
    ) ?? null;

  res.json(
    CheckDeliveryZoneResponse.parse({
      serviceable: zone !== null,
      suburb: zone?.suburb ?? suburb,
      zone,
    }),
  );
});

export default router;