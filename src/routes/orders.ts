import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client';
import { requirePermission } from '../middleware/auth';

export const ordersRouter = Router();

const orderInput = z.object({
  id: z.string().optional(),
  orderNo: z.string().nullable().optional(),
  orderedAt: z.coerce.date().optional(),
  platform: z.string().nullable().optional(),
  buyer: z.string().nullable().optional(),
  productId: z.string().nullable().optional(),
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

ordersRouter.get('/', requirePermission('orders:view'), async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { status, platform, page, pageSize } = parsed.data;

  const where: Record<string, unknown> = {};
  if (status !== 'all') where.status = status;
  if (platform !== 'all') where.platform = platform;

  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        product: {
          select: { id: true, sku: true, name: true, stock: true, price: true },
        },
      },
      orderBy: { orderedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count({ where }),
  ]);

  res.json({ page, pageSize, total, items });
});

ordersRouter.post('/batch', requirePermission('orders:write'), async (req, res) => {
  const parsed = batchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { upserts, deletes } = parsed.data;

  const saved = [];
  const errors: string[] = [];

  for (const o of upserts) {
    const { id, ...data } = o;
    // auto-compute total if not supplied properly
    if (!data.total || data.total === 0) {
      data.total = (data.quantity ?? 0) * (data.price ?? 0);
    }

    // If productId is set, auto-fill sku/productName from product and validate stock
    if (data.productId) {
      const product = await prisma.product.findUnique({ where: { id: data.productId } });
      if (product) {
        data.sku = product.sku;
        data.productName = product.name;
        if (!data.price || data.price === 0) data.price = product.price;
        data.total = (data.quantity ?? 0) * data.price;
      }
    }

    if (id && id.length > 0) {
      // UPDATE: get the existing order to calculate stock difference
      try {
        const existing = await prisma.order.findUnique({ where: { id } });
        const updated = await prisma.order.update({ where: { id }, data });

        // Adjust stock: restore old qty, deduct new qty (only for active orders)
        if (data.productId && existing) {
          const oldQty = (existing.status !== 'cancelled') ? existing.quantity : 0;
          const newQty = (data.status !== 'cancelled') ? (data.quantity ?? 0) : 0;
          const diff = newQty - oldQty;
          if (diff !== 0) {
            // Check stock for increases
            if (diff > 0) {
              const product = await prisma.product.findUnique({ where: { id: data.productId } });
              if (product && product.stock < diff) {
                errors.push(`Stok ${product.name} tidak cukup (sisa: ${product.stock}, butuh tambahan: ${diff})`);
                saved.push(updated);
                continue;
              }
            }
            await prisma.product.update({
              where: { id: data.productId },
              data: { stock: { decrement: diff } },
            });
          }
        }

        saved.push(updated);
      } catch (err) {
        // Fallback: id stale (record sudah ke-hapus) → create as new.
        // Tetap validasi stok dengan ketat seperti CREATE path (no over-sell).
        if (data.productId && data.status !== 'cancelled') {
          const product = await prisma.product.findUnique({ where: { id: data.productId } });
          if (!product) {
            errors.push(`Produk tidak ditemukan untuk order ${data.orderNo ?? '(baru)'}`);
            continue;
          }
          const qty = data.quantity ?? 0;
          if (product.stock < qty) {
            errors.push(
              `Stok ${product.name} tidak cukup (sisa: ${product.stock}, dibutuhkan: ${qty}). Order tidak dibuat.`,
            );
            continue;
          }
          await prisma.product.update({
            where: { id: data.productId },
            data: { stock: { decrement: qty } },
          });
        }
        const created = await prisma.order.create({ data });
        saved.push(created);
      }
    } else {
      // CREATE: validate stock first; reject row entirely kalau tidak cukup.
      // BUG #3 fix: sebelumnya kode push error tapi tetap create order qty
      // penuh + zero out stock → over-sell. Sekarang kalau stok kurang,
      // skip row (tidak create order, tidak touch stock).
      if (data.productId && data.status !== 'cancelled') {
        const product = await prisma.product.findUnique({ where: { id: data.productId } });
        if (!product) {
          errors.push(`Produk tidak ditemukan untuk order ${data.orderNo ?? '(baru)'}`);
          continue;
        }
        const qty = data.quantity ?? 0;
        if (product.stock < qty) {
          errors.push(
            `Stok ${product.name} tidak cukup (sisa: ${product.stock}, dibutuhkan: ${qty}). Order tidak dibuat.`,
          );
          continue;
        }
        await prisma.product.update({
          where: { id: data.productId },
          data: { stock: { decrement: qty } },
        });
      }
      const created = await prisma.order.create({ data });
      saved.push(created);
    }
  }

  // Handle deletes: restore stock for non-cancelled orders
  let deletedCount = 0;
  if (deletes.length > 0) {
    // Get orders before deleting to restore stock
    const ordersToDelete = await prisma.order.findMany({
      where: { id: { in: deletes } },
    });
    for (const order of ordersToDelete) {
      if (order.productId && order.status !== 'cancelled') {
        await prisma.product.update({
          where: { id: order.productId },
          data: { stock: { increment: order.quantity } },
        });
      }
    }
    const result = await prisma.order.deleteMany({ where: { id: { in: deletes } } });
    deletedCount = result.count;
  }

  res.json({ saved, deleted: deletedCount, errors: errors.length > 0 ? errors : undefined });
});

ordersRouter.delete('/:id', requirePermission('orders:write'), async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: String(req.params.id) } });
  if (order && order.productId && order.status !== 'cancelled') {
    await prisma.product.update({
      where: { id: order.productId },
      data: { stock: { increment: order.quantity } },
    });
  }
  await prisma.order.delete({ where: { id: String(req.params.id) } });
  res.json({ ok: true });
});
