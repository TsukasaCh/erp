import { Router } from 'express';
import { prisma } from '../db/client';
import { requirePermission } from '../middleware/auth';

export const dashboardRouter = Router();

dashboardRouter.get('/', requirePermission('dashboard:view'), async (req, res) => {
  // range=0 means "all time" (no date filter). default 30 days.
  const rawRange = Number(req.query.range ?? 30);
  const days = Number.isFinite(rawRange) && rawRange >= 0 ? Math.min(rawRange, 365) : 30;
  const allTime = days === 0;

  // Floor to start-of-day so "last N days" buckets are clean.
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (days - 1)); // include today + (days-1) prior days

  const orderWhere = allTime ? {} : { orderedAt: { gte: since } };
  const poWhere    = allTime ? {} : { orderedAt: { gte: since } };

  // Production: "today" and "next 7 days"
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);
  const weekEnd = new Date(todayStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const [
    totals,
    byStatus,
    byPlatform,
    recentOrders,
    lowStockProducts,
    productCount,
    poTotals,
    poByStatus,
    poBySupplier,
    lowStockMaterials,
    materialCount,
    supplierCount,
    productionToday,
    productionWeek,
    productionByStatus,
  ] = await Promise.all([
    prisma.order.aggregate({
      where: orderWhere,
      _count: { _all: true },
      _sum: { total: true, quantity: true },
    }),
    prisma.order.groupBy({
      by: ['status'],
      where: orderWhere,
      _count: { _all: true },
    }),
    prisma.order.groupBy({
      by: ['platform'],
      where: orderWhere,
      _count: { _all: true },
      _sum: { total: true },
    }),
    prisma.order.findMany({
      where: orderWhere,
      select: { orderedAt: true, total: true, platform: true, status: true },
    }),
    prisma.product.findMany({
      where: { stock: { lte: 10 } },
      orderBy: { stock: 'asc' },
      take: 10,
    }),
    prisma.product.count(),
    prisma.purchaseOrder.aggregate({
      where: poWhere,
      _count: { _all: true },
      _sum: { total: true },
    }),
    prisma.purchaseOrder.groupBy({
      by: ['status'],
      where: poWhere,
      _count: { _all: true },
      _sum: { total: true },
    }),
    prisma.purchaseOrder.groupBy({
      by: ['supplier'],
      where: poWhere,
      _count: { _all: true },
      _sum: { total: true },
    }),
    prisma.material.findMany({
      where: { stock: { lte: 10 } },
      orderBy: { stock: 'asc' },
      take: 10,
    }),
    prisma.material.count(),
    prisma.supplier.count(),
    prisma.productionSchedule.count({
      where: { scheduledAt: { gte: todayStart, lt: todayEnd } },
    }),
    prisma.productionSchedule.findMany({
      where: { scheduledAt: { gte: todayStart, lt: weekEnd } },
      orderBy: { scheduledAt: 'asc' },
      take: 20,
    }),
    prisma.productionSchedule.groupBy({
      by: ['status'],
      where: { scheduledAt: { gte: todayStart, lt: weekEnd } },
      _count: { _all: true },
    }),
  ]);

  // Bucket orders by day (JS-side so it works on any DB)
  const dailyMap = new Map<string, { day: string; orders: number; revenue: number; byPlatform: Record<string, number> }>();
  const platformSet = new Set<string>();
  for (const o of recentOrders) {
    const day = new Date(o.orderedAt).toISOString().slice(0, 10);
    const platform = o.platform ?? '(none)';
    platformSet.add(platform);
    const cur = dailyMap.get(day) ?? { day, orders: 0, revenue: 0, byPlatform: {} };
    cur.orders += 1;
    cur.revenue += Number(o.total);
    cur.byPlatform[platform] = (cur.byPlatform[platform] ?? 0) + 1;
    dailyMap.set(day, cur);
  }
  const daily = Array.from(dailyMap.values()).sort((a, b) => a.day.localeCompare(b.day));
  const platforms = Array.from(platformSet).sort();

  res.json({
    range_days: days,
    all_time: allTime,

    // Orders
    total_orders: totals._count._all,
    gross_revenue: Number(totals._sum.total ?? 0),
    total_quantity: Number(totals._sum.quantity ?? 0),
    by_status: byStatus.map((s) => ({ status: s.status, orders: s._count._all })),
    by_platform: byPlatform.map((p) => ({
      platform: p.platform ?? '(none)',
      orders: p._count._all,
      revenue: Number(p._sum.total ?? 0),
    })),
    daily,
    platforms,

    // Inventory
    total_products: productCount,
    low_stock_count: lowStockProducts.length,
    low_stock: lowStockProducts,

    // Bahan Baku
    total_materials: materialCount,
    low_stock_materials_count: lowStockMaterials.length,
    low_stock_materials: lowStockMaterials,
    total_suppliers: supplierCount,

    // Pembelian PO
    po_total_count: poTotals._count._all,
    po_total_value: Number(poTotals._sum.total ?? 0),
    po_by_status: poByStatus.map((p) => ({
      status: p.status,
      orders: p._count._all,
      value: Number(p._sum.total ?? 0),
    })),
    po_by_supplier: poBySupplier
      .map((p) => ({
        supplier: p.supplier ?? '(lainnya)',
        orders: p._count._all,
        value: Number(p._sum.total ?? 0),
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5),

    // Produksi
    production_today: productionToday,
    production_week: productionWeek,
    production_by_status: productionByStatus.map((p) => ({
      status: p.status,
      count: p._count._all,
    })),
  });
});
