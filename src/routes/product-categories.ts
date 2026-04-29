import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client';
import { requirePermission } from '../middleware/auth';

export const productCategoriesRouter = Router();

const categoryInput = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
});

const batchSchema = z.object({
  upserts: z.array(categoryInput).default([]),
  deletes: z.array(z.string()).default([]),
});

productCategoriesRouter.get('/', requirePermission('products:view'), async (_req, res) => {
  const items = await prisma.productCategory.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { products: true } } },
  });
  res.json(items);
});

productCategoriesRouter.post('/batch', requirePermission('products:write'), async (req, res) => {
  const parsed = batchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { upserts, deletes } = parsed.data;

  const saved = [];
  for (const c of upserts) {
    const { id, ...data } = c;
    if (id && id.length > 0) {
      try {
        const updated = await prisma.productCategory.update({ where: { id }, data });
        saved.push(updated);
      } catch {
        const created = await prisma.productCategory.create({ data });
        saved.push(created);
      }
    } else {
      const created = await prisma.productCategory.upsert({
        where: { name: data.name },
        update: data,
        create: data,
      });
      saved.push(created);
    }
  }

  let deletedCount = 0;
  if (deletes.length > 0) {
    const result = await prisma.productCategory.deleteMany({ where: { id: { in: deletes } } });
    deletedCount = result.count;
  }

  res.json({ saved, deleted: deletedCount });
});

productCategoriesRouter.delete('/:id', requirePermission('products:write'), async (req, res) => {
  await prisma.productCategory.delete({ where: { id: String(req.params.id) } });
  res.json({ ok: true });
});
