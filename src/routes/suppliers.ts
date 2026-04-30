import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client';
import { requirePermission } from '../middleware/auth';

export const suppliersRouter = Router();

const supplierInput = z.object({
  id: z.string().optional(),
  storeName: z.string().min(1),
  picName: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
});

const batchSchema = z.object({
  upserts: z.array(supplierInput).default([]),
  deletes: z.array(z.string()).default([]),
});

suppliersRouter.get('/', requirePermission('suppliers:view'), async (_req, res) => {
  const items = await prisma.supplier.findMany({ orderBy: { storeName: 'asc' } });
  res.json(items);
});

suppliersRouter.post('/batch', requirePermission('suppliers:write'), async (req, res) => {
  const parsed = batchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { upserts, deletes } = parsed.data;

  const saved = [];
  for (const s of upserts) {
    const { id, ...data } = s;
    if (id && id.length > 0) {
      try {
        const updated = await prisma.supplier.update({ where: { id }, data });
        saved.push(updated);
      } catch {
        const created = await prisma.supplier.upsert({
          where: { storeName: data.storeName },
          update: data,
          create: data,
        });
        saved.push(created);
      }
    } else {
      const created = await prisma.supplier.upsert({
        where: { storeName: data.storeName },
        update: data,
        create: data,
      });
      saved.push(created);
    }
  }

  let deletedCount = 0;
  if (deletes.length > 0) {
    const result = await prisma.supplier.deleteMany({ where: { id: { in: deletes } } });
    deletedCount = result.count;
  }
  res.json({ saved, deleted: deletedCount });
});

suppliersRouter.delete('/:id', requirePermission('suppliers:write'), async (req, res) => {
  await prisma.supplier.delete({ where: { id: String(req.params.id) } });
  res.json({ ok: true });
});
