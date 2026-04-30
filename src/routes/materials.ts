import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client';
import { requirePermission } from '../middleware/auth';

export const materialsRouter = Router();

const materialInput = z.object({
  id: z.string().optional(),
  code: z.string().min(1),
  name: z.string().min(1),
  category: z.string().nullable().optional(),
  unit: z.string().min(1).default('pcs'),
  stock: z.coerce.number().min(0).default(0),
  price: z.coerce.number().min(0).default(0),
  supplier: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
});

const batchSchema = z.object({
  upserts: z.array(materialInput).default([]),
  deletes: z.array(z.string()).default([]),
});

materialsRouter.get('/', requirePermission('materials:view'), async (_req, res) => {
  const items = await prisma.material.findMany({ orderBy: { updatedAt: 'desc' } });
  res.json(items);
});

materialsRouter.post('/batch', requirePermission('materials:write'), async (req, res) => {
  const parsed = batchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { upserts, deletes } = parsed.data;

  const saved = [];
  for (const m of upserts) {
    const { id, ...data } = m;
    if (id && id.length > 0) {
      try {
        const updated = await prisma.material.update({ where: { id }, data });
        saved.push(updated);
      } catch {
        const created = await prisma.material.create({ data });
        saved.push(created);
      }
    } else {
      const created = await prisma.material.upsert({
        where: { code: data.code },
        update: data,
        create: data,
      });
      saved.push(created);
    }
  }

  let deletedCount = 0;
  if (deletes.length > 0) {
    const result = await prisma.material.deleteMany({ where: { id: { in: deletes } } });
    deletedCount = result.count;
  }
  res.json({ saved, deleted: deletedCount });
});

materialsRouter.delete('/:id', requirePermission('materials:write'), async (req, res) => {
  await prisma.material.delete({ where: { id: String(req.params.id) } });
  res.json({ ok: true });
});

// Stock-only adjustment (Penyesuaian Stok). Used by Inventory page for
// opening balance or manual corrections. Reason is captured in body and
// logged via the global audit middleware.
const stockAdjustSchema = z.object({
  stock: z.coerce.number().min(0),
  reason: z.string().min(1).max(200).optional(),
});

materialsRouter.patch('/:id/stock', requirePermission('materials:write'), async (req, res) => {
  const parsed = stockAdjustSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const id = String(req.params.id);
  const existing = await prisma.material.findUnique({ where: { id } });
  if (!existing) return res.status(404).json({ error: 'not_found' });

  const updated = await prisma.material.update({
    where: { id },
    data: { stock: parsed.data.stock },
  });
  res.json({
    ...updated,
    _delta: parsed.data.stock - existing.stock,
    _reason: parsed.data.reason ?? null,
  });
});
