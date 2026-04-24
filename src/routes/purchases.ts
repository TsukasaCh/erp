import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client';
import { requirePermission } from '../middleware/auth';

export const purchasesRouter = Router();

const purchaseInput = z.object({
  id: z.string().optional(),
  poNo: z.string().nullable().optional(),
  orderedAt: z.coerce.date().optional(),
  supplier: z.string().nullable().optional(),
  materialCode: z.string().nullable().optional(),
  materialName: z.string().nullable().optional(),
  quantity: z.coerce.number().min(0).default(1),
  unit: z.string().nullable().optional(),
  price: z.coerce.number().min(0).default(0),
  total: z.coerce.number().min(0).default(0),
  status: z.string().default('pending'),
  expectedAt: z.coerce.date().nullable().optional(),
  note: z.string().nullable().optional(),
});

const batchSchema = z.object({
  upserts: z.array(purchaseInput).default([]),
  deletes: z.array(z.string()).default([]),
});

const querySchema = z.object({
  status: z.string().default('all'),
  supplier: z.string().default('all'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(200),
});

purchasesRouter.get('/', requirePermission('purchases:view'), async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { status, supplier, page, pageSize } = parsed.data;

  const where: Record<string, unknown> = {};
  if (status !== 'all') where.status = status;
  if (supplier !== 'all') where.supplier = supplier;

  const [items, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      orderBy: { orderedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.purchaseOrder.count({ where }),
  ]);

  res.json({ page, pageSize, total, items });
});

purchasesRouter.post('/batch', requirePermission('purchases:write'), async (req, res) => {
  const parsed = batchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { upserts, deletes } = parsed.data;

  const saved = [];
  for (const p of upserts) {
    const { id, ...data } = p;
    if (!data.total || data.total === 0) {
      data.total = (data.quantity ?? 0) * (data.price ?? 0);
    }
    if (id && id.length > 0) {
      try {
        const updated = await prisma.purchaseOrder.update({ where: { id }, data });
        saved.push(updated);
      } catch {
        const created = await prisma.purchaseOrder.create({ data });
        saved.push(created);
      }
    } else {
      const created = await prisma.purchaseOrder.create({ data });
      saved.push(created);
    }
  }

  let deletedCount = 0;
  if (deletes.length > 0) {
    const result = await prisma.purchaseOrder.deleteMany({ where: { id: { in: deletes } } });
    deletedCount = result.count;
  }

  res.json({ saved, deleted: deletedCount });
});

purchasesRouter.delete('/:id', requirePermission('purchases:write'), async (req, res) => {
  await prisma.purchaseOrder.delete({ where: { id: String(req.params.id) } });
  res.json({ ok: true });
});
