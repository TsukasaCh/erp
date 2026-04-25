import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client';
import { requirePermission } from '../middleware/auth';

export const employeesRouter = Router();

const employeeInput = z.object({
  id: z.string().optional(),
  nik: z.string().min(1),
  fullName: z.string().min(1),
  position: z.string().nullable().optional(),
  department: z.string().nullable().optional(),
  status: z.string().default('aktif'),
  joinedAt: z.coerce.date().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  baseSalary: z.coerce.number().min(0).default(0),
  allowance: z.coerce.number().min(0).default(0),
  overtimeRate: z.coerce.number().min(0).default(0),
  note: z.string().nullable().optional(),
});

const batchSchema = z.object({
  upserts: z.array(employeeInput).default([]),
  deletes: z.array(z.string()).default([]),
});

employeesRouter.get('/', requirePermission('hrd:view'), async (_req, res) => {
  const items = await prisma.employee.findMany({ orderBy: { fullName: 'asc' } });
  res.json(items);
});

employeesRouter.post('/', requirePermission('hrd:write'), async (req, res) => {
  const parsed = employeeInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { id: _id, ...data } = parsed.data;
  try {
    const created = await prisma.employee.create({ data });
    res.json(created);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'create_failed';
    res.status(400).json({ error: msg });
  }
});

employeesRouter.patch('/:id', requirePermission('hrd:write'), async (req, res) => {
  const parsed = employeeInput.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { id: _id, ...data } = parsed.data;
  try {
    const updated = await prisma.employee.update({ where: { id: String(req.params.id) }, data });
    res.json(updated);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'update_failed';
    res.status(400).json({ error: msg });
  }
});

employeesRouter.post('/batch', requirePermission('hrd:write'), async (req, res) => {
  const parsed = batchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { upserts, deletes } = parsed.data;

  const saved = [];
  for (const e of upserts) {
    const { id, ...data } = e;
    if (id && id.length > 0) {
      try {
        const updated = await prisma.employee.update({ where: { id }, data });
        saved.push(updated);
      } catch {
        const created = await prisma.employee.create({ data });
        saved.push(created);
      }
    } else {
      const created = await prisma.employee.upsert({
        where: { nik: data.nik },
        update: data,
        create: data,
      });
      saved.push(created);
    }
  }

  let deletedCount = 0;
  if (deletes.length > 0) {
    const result = await prisma.employee.deleteMany({ where: { id: { in: deletes } } });
    deletedCount = result.count;
  }
  res.json({ saved, deleted: deletedCount });
});

employeesRouter.delete('/:id', requirePermission('hrd:write'), async (req, res) => {
  await prisma.employee.delete({ where: { id: String(req.params.id) } });
  res.json({ ok: true });
});
