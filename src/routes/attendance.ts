import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client';
import { requirePermission } from '../middleware/auth';

export const attendanceRouter = Router();

const attendanceInput = z.object({
  id: z.string().optional(),
  employeeId: z.string().min(1),
  date: z.coerce.date(),
  checkIn: z.string().nullable().optional(),
  checkOut: z.string().nullable().optional(),
  status: z.string().default('hadir'),
  overtimeHours: z.coerce.number().min(0).default(0),
  note: z.string().nullable().optional(),
});

const querySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  employeeId: z.string().optional(),
});

const batchSchema = z.object({
  upserts: z.array(attendanceInput).default([]),
  deletes: z.array(z.string()).default([]),
});

attendanceRouter.get('/', requirePermission('hrd:view'), async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { from, to, employeeId } = parsed.data;

  const where: Record<string, unknown> = {};
  if (employeeId) where.employeeId = employeeId;
  if (from || to) {
    const range: Record<string, Date> = {};
    if (from) range.gte = from;
    if (to) range.lte = to;
    where.date = range;
  }

  const items = await prisma.attendance.findMany({
    where,
    include: { employee: { select: { id: true, nik: true, fullName: true, department: true } } },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
  });
  res.json(items);
});

attendanceRouter.get('/stats', requirePermission('hrd:view'), async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const startOfNextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

  const [todays, monthOvertime] = await Promise.all([
    prisma.attendance.findMany({
      where: { date: { gte: today, lt: tomorrow } },
      select: { status: true },
    }),
    prisma.attendance.aggregate({
      where: { date: { gte: startOfMonth, lt: startOfNextMonth } },
      _sum: { overtimeHours: true },
    }),
  ]);

  const present = todays.filter((a) => a.status === 'hadir').length;
  const leave = todays.filter((a) => a.status === 'izin' || a.status === 'sakit' || a.status === 'cuti').length;

  res.json({
    presentToday: present,
    leaveToday: leave,
    overtimeMonth: monthOvertime._sum.overtimeHours ?? 0,
  });
});

attendanceRouter.post('/', requirePermission('hrd:write'), async (req, res) => {
  const parsed = attendanceInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { id: _id, ...data } = parsed.data;
  try {
    const created = await prisma.attendance.upsert({
      where: { employeeId_date: { employeeId: data.employeeId, date: data.date } },
      update: data,
      create: data,
    });
    res.json(created);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'create_failed';
    res.status(400).json({ error: msg });
  }
});

attendanceRouter.patch('/:id', requirePermission('hrd:write'), async (req, res) => {
  const parsed = attendanceInput.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { id: _id, ...data } = parsed.data;
  try {
    const updated = await prisma.attendance.update({ where: { id: String(req.params.id) }, data });
    res.json(updated);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'update_failed';
    res.status(400).json({ error: msg });
  }
});

attendanceRouter.post('/batch', requirePermission('hrd:write'), async (req, res) => {
  const parsed = batchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { upserts, deletes } = parsed.data;

  const saved = [];
  for (const a of upserts) {
    const { id, ...data } = a;
    if (id && id.length > 0) {
      try {
        const updated = await prisma.attendance.update({ where: { id }, data });
        saved.push(updated);
      } catch {
        const created = await prisma.attendance.upsert({
          where: { employeeId_date: { employeeId: data.employeeId, date: data.date } },
          update: data,
          create: data,
        });
        saved.push(created);
      }
    } else {
      const created = await prisma.attendance.upsert({
        where: { employeeId_date: { employeeId: data.employeeId, date: data.date } },
        update: data,
        create: data,
      });
      saved.push(created);
    }
  }

  let deletedCount = 0;
  if (deletes.length > 0) {
    const result = await prisma.attendance.deleteMany({ where: { id: { in: deletes } } });
    deletedCount = result.count;
  }
  res.json({ saved, deleted: deletedCount });
});

attendanceRouter.delete('/:id', requirePermission('hrd:write'), async (req, res) => {
  await prisma.attendance.delete({ where: { id: String(req.params.id) } });
  res.json({ ok: true });
});
