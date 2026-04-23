import { Router } from 'express';
import { prisma } from '../db/client';

export const dashboardRouter = Router();

dashboardRouter.get('/', async (req, res) => {
  const days = Math.min(Number(req.query.range ?? 7), 90);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [totals, byStatus, byPlatform, recentOrders, lowStock, productCount] = await Promise.all([
    prisma.order.aggregate({
      where: { orderedAt: { gte: since } },
      _count: { _all: true },
      _sum: { total: true, quantity: true },
    }),
    prisma.order.groupBy({
      by: ['status'],
      where: { orderedAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.order.groupBy({
      by: ['platform'],
      where: { orderedAt: { gte: since } },
      _count: { _all: true },
      _sum: { total: true },
    }),
    prisma.order.findMany({
      where: { orderedAt: { gte: since } },
      select: { orderedAt: true, total: true, platform: true },
    }),
    prisma.product.findMany({
      where: { stock: { lte: 10 } },
      orderBy: { stock: 'asc' },
      take: 10,
    }),
    prisma.product.count(),
  ]);

  // Bucket revenue by day (JS-side so it works on any DB)
  const dailyMap = new Map<string, { day: string; orders: number; revenue: number }>();
  for (const o of recentOrders) {
    const day = new Date(o.orderedAt).toISOString().slice(0, 10);
    const cur = dailyMap.get(day) ?? { day, orders: 0, revenue: 0 };
    cur.orders += 1;
    cur.revenue += Number(o.total);
    dailyMap.set(day, cur);
  }
  const daily = Array.from(dailyMap.values()).sort((a, b) => a.day.localeCompare(b.day));

  res.json({
    range_days: days,
    total_orders: totals._count._all,
    gross_revenue: Number(totals._sum.total ?? 0),
    total_quantity: Number(totals._sum.quantity ?? 0),
    total_products: productCount,
    low_stock_count: lowStock.length,
    low_stock: lowStock,
    by_status: byStatus.map((s) => ({ status: s.status, orders: s._count._all })),
    by_platform: byPlatform.map((p) => ({
      platform: p.platform ?? '(none)',
      orders: p._count._all,
      revenue: Number(p._sum.total ?? 0),
    })),
    daily,
  });
});
