import { prisma } from './db/client';
import { hashPassword } from './services/auth';

const PRODUCT_CATEGORIES = ['Pintu', 'Jendela', 'Kusen', 'Aksesoris', 'Material', 'Jasa'];

const PRODUCTS = [
  { sku: 'ALU-SLIDE-3M', name: 'Aluminium Sliding Door 3m', categoryName: 'Pintu', stock: 25, price: 2500000 },
  { sku: 'ALU-SLIDE-2M', name: 'Aluminium Sliding Door 2m', categoryName: 'Pintu', stock: 18, price: 1800000 },
  { sku: 'ALU-WIN-120',  name: 'Aluminium Window 120cm',    categoryName: 'Jendela', stock: 40, price: 950000 },
  { sku: 'ALU-WIN-90',   name: 'Aluminium Window 90cm',     categoryName: 'Jendela', stock: 32, price: 750000 },
  { sku: 'ALU-ARC-150',  name: 'Kusen Lengkung 150cm',      categoryName: 'Kusen',   stock: 8,  price: 1400000 },
  { sku: 'HNDL-SET-SLV', name: 'Handle Set Silver',          categoryName: 'Aksesoris', stock: 120, price: 85000 },
  { sku: 'ROLR-4INC',    name: 'Roller Bearing 4 inch',      categoryName: 'Aksesoris', stock: 6,   price: 45000 },
  { sku: 'SEAL-RBR-5M',  name: 'Karet Seal 5m',              categoryName: 'Aksesoris', stock: 55,  price: 75000 },
];

const BUYERS = ['Pak Andi', 'Bu Dewi', 'Toko Jaya', 'CV Maju', 'Bu Sari', 'Pak Budi', 'Toko Sinar', 'Pak Joko'];
const PLATFORMS = ['Shopee', 'TikTok', 'Tokopedia', 'Offline', 'WhatsApp'];
const STATUSES = ['to_ship', 'to_ship', 'shipped', 'completed', 'completed', 'cancelled'];

// Default roles
const ROLES = [
  {
    name: 'Administrator',
    description: 'Akses penuh termasuk kelola user',
    permissions: [
      'dashboard:view',
      'orders:view', 'orders:write',
      'purchases:view', 'purchases:write',
      'products:view', 'products:write',
      'materials:view', 'materials:write',
      'suppliers:view', 'suppliers:write',
      'production:view', 'production:write',
      'hpp:view',
      'hrd:view', 'hrd:write',
      'users:manage',
    ],
  },
  {
    name: 'Operator',
    description: 'Edit semua data operasional, tanpa IAM',
    permissions: [
      'dashboard:view',
      'orders:view', 'orders:write',
      'purchases:view', 'purchases:write',
      'products:view', 'products:write',
      'materials:view', 'materials:write',
      'suppliers:view', 'suppliers:write',
      'production:view', 'production:write',
      'hpp:view',
      'hrd:view', 'hrd:write',
    ],
  },
  {
    name: 'Viewer',
    description: 'Hanya lihat, tidak bisa edit',
    permissions: [
      'dashboard:view',
      'orders:view',
      'purchases:view',
      'products:view',
      'materials:view',
      'suppliers:view',
      'production:view',
      'hpp:view',
      'hrd:view',
    ],
  },
];

function rand<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

async function ensureRolesAndAdmin() {
  for (const r of ROLES) {
    await prisma.role.upsert({
      where: { name: r.name },
      create: {
        name: r.name,
        description: r.description,
        permissions: JSON.stringify(r.permissions),
      },
      update: {
        description: r.description,
        permissions: JSON.stringify(r.permissions),
      },
    });
  }
  console.log(`  ${ROLES.length} roles ready`);

  const adminRole = await prisma.role.findUnique({ where: { name: 'Administrator' } });
  const existing = await prisma.user.findUnique({ where: { username: 'admin' } });
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        passwordHash: await hashPassword('Tanggor25@'),
        isSuperAdmin: true,
        active: true,
        roleId: adminRole?.id ?? null,
      },
    });
    console.log('  admin user reset (password: Tanggor25@)');
  } else {
    await prisma.user.create({
      data: {
        username: 'admin',
        passwordHash: await hashPassword('Tanggor25@'),
        fullName: 'Administrator',
        isSuperAdmin: true,
        active: true,
        roleId: adminRole?.id ?? null,
      },
    });
    console.log('  admin user created (username: admin, password: Tanggor25@)');
  }
}

async function seedDemoData() {
  const existingProducts = await prisma.product.count();
  if (existingProducts > 0) {
    console.log('  products already exist, skipping product/order seed');
    return;
  }

  // Create product categories
  const categoryMap = new Map<string, string>();
  for (const cat of PRODUCT_CATEGORIES) {
    const created = await prisma.productCategory.upsert({
      where: { name: cat },
      create: { name: cat },
      update: {},
    });
    categoryMap.set(cat, created.id);
  }
  console.log(`  ${PRODUCT_CATEGORIES.length} product categories`);

  // Create products with category relations
  const createdProducts = [];
  for (const p of PRODUCTS) {
    const { categoryName, ...data } = p;
    const product = await prisma.product.upsert({
      where: { sku: data.sku },
      create: { ...data, categoryId: categoryMap.get(categoryName) ?? null },
      update: { ...data, categoryId: categoryMap.get(categoryName) ?? null },
    });
    createdProducts.push(product);
  }
  console.log(`  ${PRODUCTS.length} products`);

  // Create demo orders linked to products
  let orderCount = 0;
  for (let dayOffset = 13; dayOffset >= 0; dayOffset--) {
    const ordersPerDay = randInt(2, 8);
    for (let i = 0; i < ordersPerDay; i++) {
      const product = rand(createdProducts);
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
          productId: product.id,
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
}

async function main() {
  console.log('Seeding Alucurv ERP...');
  await ensureRolesAndAdmin();
  await seedDemoData();
  console.log('Seed done.');
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
