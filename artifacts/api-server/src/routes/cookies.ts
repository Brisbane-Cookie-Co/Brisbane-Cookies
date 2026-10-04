import { Router, type IRouter } from "express";
import { ListCookiesResponse } from "@workspace/api-zod";
import { cookiesTable, db } from "@workspace/db";

const router: IRouter = Router();

router.get("/cookies", async (_req, res): Promise<void> => {
  const cookies = await db
    .select({
      id: cookiesTable.id,
      name: cookiesTable.name,
      slug: cookiesTable.slug,
      description: cookiesTable.description,
      priceCents: cookiesTable.priceCents,
      stock: cookiesTable.stock,
      tags: cookiesTable.tags,
      imageUrl: cookiesTable.imageUrl,
      featured: cookiesTable.featured,
    })
    .from(cookiesTable)
    .orderBy(cookiesTable.id);

  res.json(ListCookiesResponse.parse(cookies));
});

export default router;