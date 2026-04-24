import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client';
import { requirePermission } from '../middleware/auth';

export const productionRouter = Router();

const scheduleInput = z.object({
  id: z.string().optional(),
  scheduledAt: z.coerce.date(),
  productSku: z.string().nullable().optional(),
  productName: z.string().min(1),
  quantity: z.coerce.number().int().min(1).default(1),
  status: z.string().default('planned'),
  assignedTo: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
});

const batchSchema = z.object({
  upserts: z.array(scheduleInput).default([]),
  deletes: z.array(z.string()).default([]),
});

const querySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  status: z.string().default('all'),
});

productionRouter.get('/', requirePermission('production:view'), async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { from, to, status } = parsed.data;

  const where: Record<string, unknown> = {};
  if (status !== 'all') where.status = status;
  if (from || to) {
    const range: Record<string, Date> = {};
    if (from) range.gte = from;
    if (to) range.lte = to;
    where.scheduledAt = range;
  }

  const items = await prisma.productionSchedule.findMany({
    where,
    orderBy: { scheduledAt: 'asc' },
  });
  res.json({ items });
});

productionRouter.post('/batch', requirePermission('production:write'), async (req, res) => {
  const parsed = batchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { upserts, deletes } = parsed.data;

  const saved = [];
  for (const s of upserts) {
    const { id, ...data } = s;
    if (id && id.length > 0) {
      try {
        const updated = await prisma.productionSchedule.update({ where: { id }, data });
        saved.push(updated);
      } catch {
        const created = await prisma.productionSchedule.create({ data });
        saved.push(created);
      }
    } else {
      const created = await prisma.productionSchedule.create({ data });
      saved.push(created);
    }
  }

  let deletedCount = 0;
  if (deletes.length > 0) {
    const result = await prisma.productionSchedule.deleteMany({ where: { id: { in: deletes } } });
    deletedCount = result.count;
  }

  res.json({ saved, deleted: deletedCount });
});

productionRouter.delete('/:id', requirePermission('production:write'), async (req, res) => {
  await prisma.productionSchedule.delete({ where: { id: String(req.params.id) } });
  res.json({ ok: true });
});
