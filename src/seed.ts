import { prisma } from './db/client';

const PRODUCTS = [
  { sku: 'ALU-SLIDE-3M', name: 'Aluminium Sliding Door 3m', category: 'Pintu', stock: 25, price: 2500000 },
  { sku: 'ALU-SLIDE-2M', name: 'Aluminium Sliding Door 2m', category: 'Pintu', stock: 18, price: 1800000 },
  { sku: 'ALU-WIN-120', name: 'Aluminium Window 120cm', category: 'Jendela', stock: 40, price: 950000 },
  { sku: 'ALU-WIN-90', name: 'Aluminium Window 90cm', category: 'Jendela', stock: 32, price: 750000 },
  { sku: 'ALU-ARC-150', name: 'Kusen Lengkung 150cm', category: 'Kusen', stock: 8, price: 1400000 },
  { sku: 'HNDL-SET-SLV', name: 'Handle Set Silver', category: 'Aksesoris', stock: 120, price: 85000 },
  { sku: 'ROLR-4INC', name: 'Roller Bearing 4 inch', category: 'Aksesoris', stock: 6, price: 45000 },
  { sku: 'SEAL-RBR-5M', name: 'Karet Seal 5m', category: 'Aksesoris', stock: 55, price: 75000 },
];

const BUYERS = ['Pak Andi', 'Bu Dewi', 'Toko Jaya', 'CV Maju', 'Bu Sari', 'Pak Budi', 'Toko Sinar', 'Pak Joko'];
const PLATFORMS = ['Shopee', 'TikTok', 'Tokopedia', 'Offline', 'WhatsApp'];
const STATUSES = ['to_ship', 'to_ship', 'shipped', 'completed', 'completed', 'cancelled'];

function rand<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

async function main() {
  console.log('Seeding Alucurv ERP...');

  await prisma.order.deleteMany();
  await prisma.product.deleteMany();

  await prisma.product.createMany({ data: PRODUCTS });
  console.log(`  ${PRODUCTS.length} products`);

  let orderCount = 0;
  for (let dayOffset = 13; dayOffset >= 0; dayOffset--) {
    const ordersPerDay = randInt(2, 8);
    for (let i = 0; i < ordersPerDay; i++) {
      const product = rand(PRODUCTS);
      const qty = randInt(1, 4);
      const platform = rand(PLATFORMS);
      const orderedAt = new Date(Date.now() - dayOffset * 86400000 - randInt(0, 86400) * 1000);
      orderCount++;
      await prisma.order.create({
        data: {
          orderNo: `INV-${String(orderCount).padStart(4, '0')}`,
          orderedAt,
          platform,
          buyer: rand(BUYERS),
          sku: product.sku,
          productName: product.name,
          quantity: qty,
          price: product.price,
          total: product.price * qty,
          status: rand(STATUSES),
        },
      });
    }
  }
  console.log(`  ${orderCount} orders across 14 days`);
  console.log('Seed done.');
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
