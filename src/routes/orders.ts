import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client';

export const ordersRouter = Router();

const orderInput = z.object({
  id: z.string().optional(),
  orderNo: z.string().nullable().optional(),
  orderedAt: z.coerce.date().optional(),
  platform: z.string().nullable().optional(),
  buyer: z.string().nullable().optional(),
  sku: z.string().nullable().optional(),
  productName: z.string().nullable().optional(),
  quantity: z.coerce.number().int().min(0).default(1),
  price: z.coerce.number().min(0).default(0),
  total: z.coerce.number().min(0).default(0),
  status: z.string().default('to_ship'),
  note: z.string().nullable().optional(),
});

const batchSchema = z.object({
  upserts: z.array(orderInput).default([]),
  deletes: z.array(z.string()).default([]),
});

const querySchema = z.object({
  status: z.string().default('all'),
  platform: z.string().default('all'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(100),
});

ordersRouter.get('/', async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { status, platform, page, pageSize } = parsed.data;

  const where: Record<string, unknown> = {};
  if (status !== 'all') where.status = status;
  if (platform !== 'all') where.platform = platform;

  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { orderedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count({ where }),
  ]);

  res.json({ page, pageSize, total, items });
});

ordersRouter.post('/batch', async (req, res) => {
  const parsed = batchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { upserts, deletes } = parsed.data;

  const saved = [];
  for (const o of upserts) {
    const { id, ...data } = o;
    // auto-compute total if not supplied properly
    if (!data.total || data.total === 0) {
      data.total = (data.quantity ?? 0) * (data.price ?? 0);
    }
    if (id && id.length > 0) {
      try {
        const updated = await prisma.order.update({ where: { id }, data });
        saved.push(updated);
      } catch {
        const created = await prisma.order.create({ data });
        saved.push(created);
      }
    } else {
      const created = await prisma.order.create({ data });
      saved.push(created);
    }
  }

  let deletedCount = 0;
  if (deletes.length > 0) {
    const result = await prisma.order.deleteMany({ where: { id: { in: deletes } } });
    deletedCount = result.count;
  }

  res.json({ saved, deleted: deletedCount });
});

ordersRouter.delete('/:id', async (req, res) => {
  await prisma.order.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});
