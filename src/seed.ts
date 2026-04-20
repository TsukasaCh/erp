import { prisma } from './db/client';

const PRODUCTS = [
  { sku: 'KAOS-HITAM-M', name: 'Kaos Polos Hitam Size M', stock: 120, price: 75000 },
  { sku: 'KAOS-HITAM-L', name: 'Kaos Polos Hitam Size L', stock: 85, price: 75000 },
  { sku: 'CELANA-JEANS-32', name: 'Celana Jeans Slim Fit 32', stock: 45, price: 250000 },
  { sku: 'TAS-RANSEL-NAVY', name: 'Tas Ransel Kanvas Navy', stock: 28, price: 180000 },
  { sku: 'SEPATU-SNK-42', name: 'Sepatu Sneakers Putih 42', stock: 12, price: 320000 },
  { sku: 'TOPI-BLACK', name: 'Topi Baseball Hitam', stock: 200, price: 55000 },
];

const BUYERS = ['Andi', 'Budi', 'Citra', 'Dewi', 'Eko', 'Fani', 'Gilang', 'Hana', 'Ivan', 'Joko'];
const STATUSES = ['to_ship', 'to_ship', 'to_ship', 'shipped', 'shipped', 'completed', 'completed', 'completed', 'cancelled'];

function rand<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

async function main() {
  console.log('🌱 Seeding...');

  // Clean
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.platformSku.deleteMany();
  await prisma.product.deleteMany();
  await prisma.syncLog.deleteMany();

  // Products + platform mappings
  const created = [];
  for (const p of PRODUCTS) {
    const product = await prisma.product.create({
      data: {
        ...p,
        platformSkus: {
          create: [
            { platform: 'shopee', externalSku: `SH-${p.sku}`, externalItemId: String(randInt(100000, 999999)) },
            { platform: 'tiktok', externalSku: `TT-${p.sku}`, externalItemId: String(randInt(100000, 999999)) },
          ],
        },
      },
    });
    created.push(product);
  }
  console.log(`✓ ${created.length} products`);

  // Generate orders for last 14 days
  let orderCount = 0;
  for (let dayOffset = 13; dayOffset >= 0; dayOffset--) {
    const ordersPerDay = randInt(3, 12);
    for (let i = 0; i < ordersPerDay; i++) {
      const platform = Math.random() > 0.5 ? 'shopee' : 'tiktok';
      const status = rand(STATUSES);
      const orderedAt = new Date(Date.now() - dayOffset * 24 * 60 * 60 * 1000 - randInt(0, 86400) * 1000);

      const itemCount = randInt(1, 3);
      const items = [];
      let total = 0;
      const usedSkus = new Set<string>();
      for (let j = 0; j < itemCount; j++) {
        let prod = rand(created);
        while (usedSkus.has(prod.sku)) prod = rand(created);
        usedSkus.add(prod.sku);
        const qty = randInt(1, 3);
        items.push({ productId: prod.id, sku: prod.sku, quantity: qty, price: prod.price });
        total += prod.price * qty;
      }

      await prisma.order.create({
        data: {
          platform,
          externalOrderId: `${platform.toUpperCase()}-${Date.now()}-${orderCount}`,
          status,
          buyerName: rand(BUYERS),
          totalAmount: total,
          shippingStatus: status === 'shipped' ? 'IN_TRANSIT' : null,
          orderedAt,
          rawPayload: JSON.stringify({ seeded: true }),
          items: { create: items },
        },
      });
      orderCount++;
    }
  }
  console.log(`✓ ${orderCount} orders across 14 days`);

  // Sample sync logs
  await prisma.syncLog.createMany({
    data: [
      { platform: 'shopee', type: 'order_pull', status: 'success', message: '12 orders' },
      { platform: 'tiktok', type: 'order_pull', status: 'success', message: '8 orders' },
      { platform: 'shopee', type: 'stock_push', status: 'success', message: 'sku=SH-KAOS-HITAM-M stock=120' },
    ],
  });

  console.log('✅ Seed done');
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
