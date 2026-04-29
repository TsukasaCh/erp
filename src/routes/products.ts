import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client';
import { requirePermission } from '../middleware/auth';

export const productsRouter = Router();

const productInput = z.object({
  id: z.string().optional(),
  sku: z.string().min(1),
  name: z.string().min(1),
  categoryId: z.string().nullable().optional(),
  stock: z.coerce.number().int().min(0).default(0),
  price: z.coerce.number().min(0).default(0),
  note: z.string().nullable().optional(),
});

const batchSchema = z.object({
  upserts: z.array(productInput).default([]),
  deletes: z.array(z.string()).default([]),
});

productsRouter.get('/', requirePermission('products:view'), async (_req, res) => {
  const products = await prisma.product.findMany({
    orderBy: { updatedAt: 'desc' },
    include: {
      category: { select: { id: true, name: true } },
    },
  });
  res.json(products);
});

productsRouter.post('/batch', requirePermission('products:write'), async (req, res) => {
  const parsed = batchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { upserts, deletes } = parsed.data;

  const saved = [];
  for (const p of upserts) {
    const { id, ...data } = p;
    if (id && id.length > 0) {
      try {
        const updated = await prisma.product.update({ where: { id }, data });
        saved.push(updated);
      } catch {
        // row may have been deleted elsewhere; fall back to create
        const created = await prisma.product.create({ data });
        saved.push(created);
      }
    } else {
      // upsert by SKU so duplicates don't break the save
      const created = await prisma.product.upsert({
        where: { sku: data.sku },
        update: data,
        create: data,
      });
      saved.push(created);
    }
  }

  let deletedCount = 0;
  if (deletes.length > 0) {
    const result = await prisma.product.deleteMany({ where: { id: { in: deletes } } });
    deletedCount = result.count;
  }

  res.json({ saved, deleted: deletedCount });
});

productsRouter.post('/', requirePermission('products:write'), async (req, res) => {
  const parsed = productInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { id: _id, ...data } = parsed.data;
  const product = await prisma.product.upsert({
    where: { sku: data.sku },
    create: data,
    update: data,
  });
  res.json(product);
});

productsRouter.delete('/:id', requirePermission('products:write'), async (req, res) => {
  await prisma.product.delete({ where: { id: String(req.params.id) } });
  res.json({ ok: true });
});
