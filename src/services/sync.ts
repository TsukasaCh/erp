import { prisma } from '../db/client';
import { shopee, ShopeeOrder } from './shopee';
import { tiktok, TiktokOrder } from './tiktok';
import { mapShopeeStatus, mapTiktokStatus } from '../utils/statusMapper';

const LOOKBACK_SECONDS = 60 * 60 * 24; // last 24h on first run

async function getLastSyncedAt(platform: string): Promise<number> {
  const last = await prisma.order.findFirst({
    where: { platform },
    orderBy: { orderedAt: 'desc' },
    select: { orderedAt: true },
  });
  if (!last) return Math.floor(Date.now() / 1000) - LOOKBACK_SECONDS;
  return Math.floor(last.orderedAt.getTime() / 1000);
}

async function resolveProductIdBySku(platform: string, externalSku: string) {
  const map = await prisma.platformSku.findUnique({
    where: { platform_externalSku: { platform, externalSku } },
    select: { productId: true },
  });
  if (map) return map.productId;
  const direct = await prisma.product.findUnique({ where: { sku: externalSku }, select: { id: true } });
  return direct?.id ?? null;
}

async function upsertOrder(args: {
  platform: 'shopee' | 'tiktok';
  externalOrderId: string;
  status: string;
  buyerName: string | null;
  totalAmount: number;
  orderedAt: Date;
  raw: unknown;
  items: Array<{ sku: string; quantity: number; price: number }>;
}) {
  const itemsWithProduct = await Promise.all(
    args.items.map(async (it) => ({
      ...it,
      productId: await resolveProductIdBySku(args.platform, it.sku),
    })),
  );

  await prisma.$transaction(async (tx) => {
    const existing = await tx.order.findUnique({
      where: { platform_externalOrderId: { platform: args.platform, externalOrderId: args.externalOrderId } },
      select: { id: true, status: true },
    });

    const order = await tx.order.upsert({
      where: { platform_externalOrderId: { platform: args.platform, externalOrderId: args.externalOrderId } },
      create: {
        platform: args.platform,
        externalOrderId: args.externalOrderId,
        status: args.status,
        buyerName: args.buyerName,
        totalAmount: args.totalAmount,
        orderedAt: args.orderedAt,
        rawPayload: JSON.stringify(args.raw),
        items: { create: itemsWithProduct.map((it) => ({
          sku: it.sku, quantity: it.quantity, price: it.price, productId: it.productId,
        })) },
      },
      update: {
        status: args.status,
        rawPayload: JSON.stringify(args.raw),
        syncedAt: new Date(),
      },
    });

    // Decrement stock only on first insert
    if (!existing) {
      for (const it of itemsWithProduct) {
        if (!it.productId) continue;
        await tx.product.update({
          where: { id: it.productId },
          data: { stock: { decrement: it.quantity } },
        });
      }
    }
    return order;
  });
}

async function logSync(platform: string, type: string, status: 'success' | 'failed', message?: string) {
  await prisma.syncLog.create({ data: { platform, type, status, message } });
}

export async function syncShopeeOrders() {
  try {
    const since = await getLastSyncedAt('shopee');
    const orders: ShopeeOrder[] = await shopee.listOrdersSince(since);
    for (const o of orders) {
      await upsertOrder({
        platform: 'shopee',
        externalOrderId: o.order_sn,
        status: mapShopeeStatus(o.order_status),
        buyerName: o.buyer_username ?? null,
        totalAmount: Number(o.total_amount),
        orderedAt: new Date(o.create_time * 1000),
        raw: o,
        items: (o.item_list ?? []).map((i) => ({
          sku: i.item_sku,
          quantity: i.model_quantity_purchased,
          price: Number(i.model_discounted_price),
        })),
      });
    }
    await logSync('shopee', 'order_pull', 'success', `${orders.length} orders`);
  } catch (e: any) {
    await logSync('shopee', 'order_pull', 'failed', e?.message ?? String(e));
    throw e;
  }
}

export async function syncTiktokOrders() {
  try {
    const since = await getLastSyncedAt('tiktok');
    const orders: TiktokOrder[] = await tiktok.listOrdersSince(since);
    for (const o of orders) {
      await upsertOrder({
        platform: 'tiktok',
        externalOrderId: o.order_id,
        status: mapTiktokStatus(o.order_status),
        buyerName: o.buyer_email ?? null,
        totalAmount: Number(o.payment_info?.total_amount ?? 0),
        orderedAt: new Date(o.create_time * 1000),
        raw: o,
        items: (o.line_items ?? []).map((i) => ({
          sku: i.seller_sku,
          quantity: i.quantity,
          price: Number(i.sale_price),
        })),
      });
    }
    await logSync('tiktok', 'order_pull', 'success', `${orders.length} orders`);
  } catch (e: any) {
    await logSync('tiktok', 'order_pull', 'failed', e?.message ?? String(e));
    throw e;
  }
}

export async function pushStockToBothPlatforms(productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { platformSkus: true },
  });
  if (!product) return;
  for (const m of product.platformSkus) {
    try {
      if (m.platform === 'shopee' && m.externalItemId) {
        await shopee.updateStock(m.externalItemId, product.stock);
      } else if (m.platform === 'tiktok' && m.externalItemId) {
        await tiktok.updateStock(m.externalItemId, m.externalSku, product.stock);
      }
      await logSync(m.platform, 'stock_push', 'success', `sku=${m.externalSku} stock=${product.stock}`);
    } catch (e: any) {
      await logSync(m.platform, 'stock_push', 'failed', e?.message ?? String(e));
    }
  }
}
