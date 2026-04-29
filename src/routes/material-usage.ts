import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client';
import { requirePermission } from '../middleware/auth';

export const materialUsageRouter = Router();

const usageInput = z.object({
  id: z.string().optional(),
  materialId: z.string().min(1),
  quantity: z.coerce.number().min(0.01),
  usageDate: z.coerce.date().optional(),
  purpose: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
});

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(100),
  materialId: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

// GET - list all material usages
materialUsageRouter.get('/', requirePermission('materials:view'), async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { page, pageSize, materialId, from, to } = parsed.data;

  const where: Record<string, unknown> = {};
  if (materialId) where.materialId = materialId;
  if (from || to) {
    const range: Record<string, Date> = {};
    if (from) range.gte = from;
    if (to) range.lte = to;
    where.usageDate = range;
  }

  const [items, total] = await Promise.all([
    prisma.materialUsage.findMany({
      where,
      include: {
        material: {
          select: { id: true, code: true, name: true, unit: true, stock: true },
        },
      },
      orderBy: { usageDate: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.materialUsage.count({ where }),
  ]);

  res.json({ page, pageSize, total, items });
});

// POST - create a new material usage and deduct stock
materialUsageRouter.post('/', requirePermission('materials:write'), async (req, res) => {
  const parsed = usageInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { materialId, quantity, usageDate, purpose, note } = parsed.data;

  // Check if material exists and has enough stock
  const material = await prisma.material.findUnique({ where: { id: materialId } });
  if (!material) return res.status(404).json({ error: 'Bahan tidak ditemukan' });
  if (material.stock < quantity) {
    return res.status(400).json({
      error: `Stok tidak cukup. Stok saat ini: ${material.stock} ${material.unit}, dibutuhkan: ${quantity} ${material.unit}`,
    });
  }

  // Create usage record and deduct stock in a transaction
  const [usage] = await prisma.$transaction([
    prisma.materialUsage.create({
      data: {
        materialId,
        quantity,
        usageDate: usageDate ?? new Date(),
        purpose,
        note,
      },
      include: {
        material: {
          select: { id: true, code: true, name: true, unit: true, stock: true },
        },
      },
    }),
    prisma.material.update({
      where: { id: materialId },
      data: { stock: { decrement: quantity } },
    }),
  ]);

  res.json(usage);
});

// DELETE - remove a usage record and restore stock
materialUsageRouter.delete('/:id', requirePermission('materials:write'), async (req, res) => {
  const usage = await prisma.materialUsage.findUnique({ where: { id: String(req.params.id) } });
  if (!usage) return res.status(404).json({ error: 'Record tidak ditemukan' });

  await prisma.$transaction([
    prisma.materialUsage.delete({ where: { id: usage.id } }),
    prisma.material.update({
      where: { id: usage.materialId },
      data: { stock: { increment: usage.quantity } },
    }),
  ]);

  res.json({ ok: true });
});
