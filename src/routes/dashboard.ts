import { Router } from 'express';
import { prisma } from '../db/client';

export const dashboardRouter = Router();

dashboardRouter.get('/', async (req, res) => {
  const days = Math.min(Number(req.query.range ?? 7), 90);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [totals, byPlatform, byStatus, allOrders] = await Promise.all([
    prisma.order.aggregate({
      where: { orderedAt: { gte: since } },
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),
    prisma.order.groupBy({
      by: ['platform'],
      where: { orderedAt: { gte: since } },
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),
    prisma.order.groupBy({
      by: ['status'],
      where: { orderedAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.order.findMany({
      where: { orderedAt: { gte: since } },
      select: { orderedAt: true, platform: true, totalAmount: true },
    }),
  ]);

  // Bucket by day in app code (works on both Postgres and SQLite)
  const dailyMap = new Map<string, { day: string; platform: string; orders: number; revenue: number }>();
  for (const o of allOrders) {
    const day = new Date(o.orderedAt).toISOString().slice(0, 10);
    const key = `${day}|${o.platform}`;
    const cur = dailyMap.get(key) ?? { day, platform: o.platform, orders: 0, revenue: 0 };
    cur.orders += 1;
    cur.revenue += Number(o.totalAmount);
    dailyMap.set(key, cur);
  }
  const daily = Array.from(dailyMap.values()).sort((a, b) => a.day.localeCompare(b.day));

  res.json({
    range_days: days,
    total_orders: totals._count._all,
    gross_revenue: Number(totals._sum.totalAmount ?? 0),
    by_platform: byPlatform.map((p) => ({
      platform: p.platform,
      orders: p._count._all,
      revenue: Number(p._sum.totalAmount ?? 0),
    })),
    by_status: byStatus.map((s) => ({ status: s.status, orders: s._count._all })),
    daily,
  });
});
