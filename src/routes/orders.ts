import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client';

export const ordersRouter = Router();

const querySchema = z.object({
  status: z.enum(['to_ship', 'shipped', 'completed', 'cancelled', 'all']).default('all'),
  platform: z.enum(['shopee', 'tiktok', 'all']).default('all'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

ordersRouter.get('/', async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { status, platform, page, pageSize } = parsed.data;

  const where = {
    ...(status !== 'all' && { status }),
    ...(platform !== 'all' && { platform }),
  };

  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { orderedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { items: true },
    }),
    prisma.order.count({ where }),
  ]);

  res.json({ page, pageSize, total, items });
});

ordersRouter.get('/:id', async (req, res) => {
  const order = await prisma.order.findUnique({
    where: { id: req.params.id },
    include: { items: { include: { product: true } } },
  });
  if (!order) return res.status(404).json({ error: 'Not found' });
  res.json(order);
});
