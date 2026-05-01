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
  materialId: z.string().nullable().optional(),
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
      include: {
        material: {
          select: { id: true, code: true, name: true, unit: true, stock: true },
        },
      },
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

    // Auto-fill material details if materialId is set
    if (data.materialId) {
      const material = await prisma.material.findUnique({ where: { id: data.materialId } });
      if (material) {
        data.materialCode = material.code;
        data.materialName = material.name;
        if (!data.unit) data.unit = material.unit;
        if (!data.supplier) data.supplier = material.supplier;
        if (!data.price || data.price === 0) data.price = material.price;
        data.total = (data.quantity ?? 0) * data.price;
      }
    }

    if (id && id.length > 0) {
      try {
        const existing = await prisma.purchaseOrder.findUnique({ where: { id } });
        const updated = await prisma.purchaseOrder.update({ where: { id }, data });

        // Handle stock adjustment when status changes to/from received,
        // OR when quantity / materialId changes on an already-received PO.
        if (existing) {
          const wasReceived = existing.status === 'received' && existing.stockAdjusted;
          const isReceived = data.status === 'received';
          const newQty = Number(data.quantity ?? 0);
          const oldQty = Number(existing.quantity);
          const oldMaterialId = existing.materialId;
          const newMaterialId = data.materialId ?? oldMaterialId;

          if (!wasReceived && isReceived && newMaterialId) {
            // Transition: pending/cancelled → received. Tambah stok material baru.
            await prisma.material.update({
              where: { id: newMaterialId },
              data: { stock: { increment: newQty } },
            });
            await prisma.purchaseOrder.update({
              where: { id },
              data: { stockAdjusted: true },
            });
          } else if (wasReceived && !isReceived && oldMaterialId) {
            // Transition: received → pending/cancelled. Tarik balik stok lama.
            await prisma.material.update({
              where: { id: oldMaterialId },
              data: { stock: { decrement: oldQty } },
            });
            await prisma.purchaseOrder.update({
              where: { id },
              data: { stockAdjusted: false },
            });
          } else if (wasReceived && isReceived) {
            // BUG #2 fix: PO sudah received, ada koreksi qty / ganti material.
            // Tarik balik stok lama dari material lama, lalu tambah stok baru
            // ke material baru. Ini menangani:
            // - qty diubah (10 → 12)         → stok material += diff
            // - material diganti (A → B)     → stok A -= oldQty, stok B += newQty
            const qtyChanged = oldQty !== newQty;
            const materialChanged = oldMaterialId !== newMaterialId;
            if (qtyChanged || materialChanged) {
              if (oldMaterialId) {
                await prisma.material.update({
                  where: { id: oldMaterialId },
                  data: { stock: { decrement: oldQty } },
                });
              }
              if (newMaterialId) {
                await prisma.material.update({
                  where: { id: newMaterialId },
                  data: { stock: { increment: newQty } },
                });
              }
            }
          }
        }

        saved.push(updated);
      } catch {
        const created = await prisma.purchaseOrder.create({ data });
        // If created as received, add stock
        if (data.materialId && data.status === 'received') {
          await prisma.material.update({
            where: { id: data.materialId },
            data: { stock: { increment: data.quantity ?? 0 } },
          });
          await prisma.purchaseOrder.update({
            where: { id: created.id },
            data: { stockAdjusted: true },
          });
        }
        saved.push(created);
      }
    } else {
      const created = await prisma.purchaseOrder.create({ data });
      // If created as received, add stock
      if (data.materialId && data.status === 'received') {
        await prisma.material.update({
          where: { id: data.materialId },
          data: { stock: { increment: data.quantity ?? 0 } },
        });
        await prisma.purchaseOrder.update({
          where: { id: created.id },
          data: { stockAdjusted: true },
        });
      }
      saved.push(created);
    }
  }

  // Handle deletes: restore stock for received POs
  let deletedCount = 0;
  if (deletes.length > 0) {
    const posToDelete = await prisma.purchaseOrder.findMany({
      where: { id: { in: deletes } },
    });
    for (const po of posToDelete) {
      if (po.materialId && po.stockAdjusted) {
        await prisma.material.update({
          where: { id: po.materialId },
          data: { stock: { decrement: po.quantity } },
        });
      }
    }
    const result = await prisma.purchaseOrder.deleteMany({ where: { id: { in: deletes } } });
    deletedCount = result.count;
  }

  res.json({ saved, deleted: deletedCount });
});

purchasesRouter.delete('/:id', requirePermission('purchases:write'), async (req, res) => {
  const po = await prisma.purchaseOrder.findUnique({ where: { id: String(req.params.id) } });
  if (po && po.materialId && po.stockAdjusted) {
    await prisma.material.update({
      where: { id: po.materialId },
      data: { stock: { decrement: po.quantity } },
    });
  }
  await prisma.purchaseOrder.delete({ where: { id: String(req.params.id) } });
  res.json({ ok: true });
});
