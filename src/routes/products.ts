import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client';
import { pushStockToBothPlatforms } from '../services/sync';

export const productsRouter = Router();

const upsertSchema = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  stock: z.number().int().min(0),
  price: z.number().min(0),
  platformSkus: z
    .array(
      z.object({
        platform: z.enum(['shopee', 'tiktok']),
        externalSku: z.string().min(1),
        externalItemId: z.string().optional(),
      }),
    )
    .optional(),
});

productsRouter.get('/', async (_req, res) => {
  const products = await prisma.product.findMany({
    include: { platformSkus: true },
    orderBy: { updatedAt: 'desc' },
  });
  res.json(products);
});

productsRouter.post('/', async (req, res) => {
  const parsed = upsertSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { platformSkus, ...rest } = parsed.data;

  const product = await prisma.product.upsert({
    where: { sku: rest.sku },
    create: {
      ...rest,
      platformSkus: platformSkus ? { create: platformSkus } : undefined,
    },
    update: rest,
    include: { platformSkus: true },
  });
  res.json(product);
});

productsRouter.patch('/:id/stock', async (req, res) => {
  const schema = z.object({ stock: z.number().int().min(0) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const product = await prisma.product.update({
    where: { id: req.params.id },
    data: { stock: parsed.data.stock },
  });
  // fire-and-forget push to marketplaces
  pushStockToBothPlatforms(product.id).catch((e) => console.error('stock push failed', e));
  res.json(product);
});
