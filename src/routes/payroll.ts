import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client';
import { requirePermission } from '../middleware/auth';

export const payrollRouter = Router();

const payrollInput = z.object({
  id: z.string().optional(),
  employeeId: z.string().min(1),
  period: z.string().regex(/^\d{4}-\d{2}$/),
  baseSalary: z.coerce.number().min(0).default(0),
  allowance: z.coerce.number().min(0).default(0),
  overtimePay: z.coerce.number().min(0).default(0),
  deduction: z.coerce.number().min(0).default(0),
  netSalary: z.coerce.number().min(0).default(0),
  status: z.string().default('draft'),
  paidAt: z.coerce.date().nullable().optional(),
  note: z.string().nullable().optional(),
});

const querySchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  status: z.string().default('all'),
});

const generateSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/),
});

payrollRouter.get('/', requirePermission('hrd:view'), async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { period, status } = parsed.data;

  const where: Record<string, unknown> = {};
  if (period) where.period = period;
  if (status !== 'all') where.status = status;

  const items = await prisma.payroll.findMany({
    where,
    include: { employee: { select: { id: true, nik: true, fullName: true, department: true } } },
    orderBy: [{ period: 'desc' }, { createdAt: 'desc' }],
  });
  res.json(items);
});

payrollRouter.get('/stats', requirePermission('hrd:view'), async (req, res) => {
  const period = typeof req.query.period === 'string'
    ? req.query.period
    : new Date().toISOString().slice(0, 7);

  const [allEmployees, payrolls] = await Promise.all([
    prisma.employee.count({ where: { status: { not: 'resign' } } }),
    prisma.payroll.findMany({ where: { period } }),
  ]);

  const total = payrolls.reduce((s, p) => s + p.netSalary, 0);
  const paid = payrolls.filter((p) => p.status === 'paid').length;

  res.json({
    period,
    totalNet: total,
    paidCount: paid,
    pendingCount: Math.max(0, allEmployees - paid),
  });
});

// Generate payroll drafts for a period — pulls baseSalary/allowance from Employee
// and overtime from Attendance for that month.
payrollRouter.post('/generate', requirePermission('hrd:write'), async (req, res) => {
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { period } = parsed.data;

  const [year, month] = period.split('-').map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  const employees = await prisma.employee.findMany({ where: { status: { not: 'resign' } } });
  const created: unknown[] = [];

  for (const emp of employees) {
    const ot = await prisma.attendance.aggregate({
      where: { employeeId: emp.id, date: { gte: start, lt: end } },
      _sum: { overtimeHours: true },
    });
    const overtimeHours = ot._sum.overtimeHours ?? 0;
    const overtimePay = overtimeHours * emp.overtimeRate;
    const netSalary = emp.baseSalary + emp.allowance + overtimePay;

    const row = await prisma.payroll.upsert({
      where: { employeeId_period: { employeeId: emp.id, period } },
      update: {
        baseSalary: emp.baseSalary,
        allowance: emp.allowance,
        overtimePay,
        netSalary,
      },
      create: {
        employeeId: emp.id,
        period,
        baseSalary: emp.baseSalary,
        allowance: emp.allowance,
        overtimePay,
        deduction: 0,
        netSalary,
        status: 'draft',
      },
    });
    created.push(row);
  }

  res.json({ generated: created.length, items: created });
});

payrollRouter.patch('/:id', requirePermission('hrd:write'), async (req, res) => {
  const parsed = payrollInput.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { id: _id, ...data } = parsed.data;

  // recalc netSalary if components changed
  if (
    data.baseSalary !== undefined ||
    data.allowance !== undefined ||
    data.overtimePay !== undefined ||
    data.deduction !== undefined
  ) {
    const current = await prisma.payroll.findUnique({ where: { id: String(req.params.id) } });
    if (current) {
      const base = data.baseSalary ?? current.baseSalary;
      const allow = data.allowance ?? current.allowance;
      const ot = data.overtimePay ?? current.overtimePay;
      const ded = data.deduction ?? current.deduction;
      data.netSalary = base + allow + ot - ded;
    }
  }

  try {
    const updated = await prisma.payroll.update({ where: { id: String(req.params.id) }, data });
    res.json(updated);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'update_failed';
    res.status(400).json({ error: msg });
  }
});

payrollRouter.post('/:id/pay', requirePermission('hrd:write'), async (req, res) => {
  try {
    const updated = await prisma.payroll.update({
      where: { id: String(req.params.id) },
      data: { status: 'paid', paidAt: new Date() },
    });
    res.json(updated);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'update_failed';
    res.status(400).json({ error: msg });
  }
});

payrollRouter.delete('/:id', requirePermission('hrd:write'), async (req, res) => {
  await prisma.payroll.delete({ where: { id: String(req.params.id) } });
  res.json({ ok: true });
});
