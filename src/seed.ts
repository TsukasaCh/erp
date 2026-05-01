import { prisma } from './db/client';
import { hashPassword } from './services/auth';

// ---------------------------------------------------------------------------
// FINISHED PRODUCTS — barang jadi yang dijual ke customer.
// Contoh: Jendela siap pasang, Pintu siap pasang, Kusen jadi.
// Ini yang muncul di Penjualan / Inventory Product.
// ---------------------------------------------------------------------------
const PRODUCT_CATEGORIES = ['Jendela', 'Pintu', 'Kusen', 'Partisi', 'Aksesoris', 'Jasa'];

const PRODUCTS = [
  { sku: 'JDL-CSMT-120', name: 'Jendela Casement 120x80',     categoryName: 'Jendela',  stock: 12, price: 1850000 },
  { sku: 'JDL-CSMT-150', name: 'Jendela Casement 150x100',    categoryName: 'Jendela',  stock: 8,  price: 2400000 },
  { sku: 'JDL-SLID-150', name: 'Jendela Sliding 150x100',     categoryName: 'Jendela',  stock: 15, price: 2100000 },
  { sku: 'PTU-SLID-2D',  name: 'Pintu Sliding 2 Daun 240cm',  categoryName: 'Pintu',    stock: 6,  price: 4800000 },
  { sku: 'PTU-FLDG-4D',  name: 'Pintu Folding 4 Daun 320cm',  categoryName: 'Pintu',    stock: 4,  price: 7500000 },
  { sku: 'PTU-SWNG-90',  name: 'Pintu Swing Aluminium 90cm',  categoryName: 'Pintu',    stock: 10, price: 2200000 },
  { sku: 'KSN-ALU-6CM',  name: 'Kusen Aluminium Profil 6cm',  categoryName: 'Kusen',    stock: 20, price: 380000  },
  { sku: 'KSN-LKNG-150', name: 'Kusen Lengkung 150cm',        categoryName: 'Kusen',    stock: 5,  price: 1400000 },
  { sku: 'PRT-OFC-3M',   name: 'Partisi Kantor 3m',           categoryName: 'Partisi',  stock: 3,  price: 5200000 },
  { sku: 'JASA-INSTAL',  name: 'Jasa Pemasangan / m²',        categoryName: 'Jasa',     stock: 9999, price: 75000 },
];

// ---------------------------------------------------------------------------
// RAW MATERIALS — bahan baku untuk produksi.
// Contoh: profil aluminium, kaca, handle, sekrup. Ini yang muncul di
// Master Data Bahan / Inventory Bahan.
// ---------------------------------------------------------------------------
const MATERIALS = [
  { code: 'ALU-SLIDE-3M',  name: 'Profil Aluminium Sliding 3m',     category: 'Aluminium',   unit: 'batang', stock: 50,  price: 350000, supplier: 'Sumber Logam Jaya' },
  { code: 'ALU-SLIDE-6M',  name: 'Profil Aluminium Sliding 6m',     category: 'Aluminium',   unit: 'batang', stock: 30,  price: 680000, supplier: 'Sumber Logam Jaya' },
  { code: 'ALU-CSMT-6M',   name: 'Profil Aluminium Casement 6m',    category: 'Aluminium',   unit: 'batang', stock: 25,  price: 720000, supplier: 'Sumber Logam Jaya' },
  { code: 'ALU-KSN-6M',    name: 'Profil Aluminium Kusen 6m',       category: 'Aluminium',   unit: 'batang', stock: 40,  price: 540000, supplier: 'Aluminium Mas Sentosa' },
  { code: 'KCA-RBN-5MM',   name: 'Kaca Riben 5mm',                  category: 'Kaca',        unit: 'm²',     stock: 80,  price: 165000, supplier: 'Sentosa Kaca' },
  { code: 'KCA-BNG-5MM',   name: 'Kaca Bening 5mm',                 category: 'Kaca',        unit: 'm²',     stock: 100, price: 145000, supplier: 'Sentosa Kaca' },
  { code: 'KCA-TMP-8MM',   name: 'Kaca Tempered 8mm',               category: 'Kaca',        unit: 'm²',     stock: 35,  price: 420000, supplier: 'Sentosa Kaca' },
  { code: 'HDL-SLV-30',    name: 'Handle Pintu Silver 30cm',        category: 'Handle',      unit: 'pcs',    stock: 60,  price: 85000,  supplier: 'Mitra Hardware' },
  { code: 'HDL-BLK-30',    name: 'Handle Pintu Black 30cm',         category: 'Handle',      unit: 'pcs',    stock: 45,  price: 95000,  supplier: 'Mitra Hardware' },
  { code: 'ROL-4INC',      name: 'Roller Bearing 4 inch',           category: 'Roller',      unit: 'pcs',    stock: 6,   price: 45000,  supplier: 'Mitra Hardware' },
  { code: 'ROL-6INC',      name: 'Roller Bearing 6 inch',           category: 'Roller',      unit: 'pcs',    stock: 25,  price: 65000,  supplier: 'Mitra Hardware' },
  { code: 'ENG-PRM-4',     name: 'Engsel Premium 4 inch',           category: 'Engsel',      unit: 'pcs',    stock: 80,  price: 32000,  supplier: 'Mitra Hardware' },
  { code: 'SLR-RBR-5M',    name: 'Karet Seal Hitam 5m',             category: 'Karet Seal',  unit: 'roll',   stock: 18,  price: 75000,  supplier: 'Mitra Hardware' },
  { code: 'SCR-GLV-25',    name: 'Sekrup Galvanis 2.5cm',           category: 'Sekrup',      unit: 'box',    stock: 35,  price: 45000,  supplier: 'Mitra Hardware' },
];

// ---------------------------------------------------------------------------
// SUPPLIERS — toko/vendor sumber bahan baku.
// ---------------------------------------------------------------------------
const SUPPLIERS = [
  { storeName: 'Sumber Logam Jaya',     picName: 'Pak Hendra', phone: '081234567890', address: 'Jl. Industri Raya No. 12, Tangerang' },
  { storeName: 'Aluminium Mas Sentosa', picName: 'Bu Linda',   phone: '081298765432', address: 'Jl. Kapuk No. 88, Jakarta Utara' },
  { storeName: 'Sentosa Kaca',          picName: 'Pak Budi',   phone: '081377889900', address: 'Jl. Daan Mogot KM 12, Jakarta Barat' },
  { storeName: 'Mitra Hardware',        picName: 'Pak Aris',   phone: '081345678910', address: 'Pasar Pagi Mangga Dua Blok C-15' },
];

const BUYERS = ['Pak Andi', 'Bu Dewi', 'Toko Jaya', 'CV Maju', 'Bu Sari', 'Pak Budi', 'Toko Sinar', 'Pak Joko'];
const PLATFORMS = ['Shopee', 'TikTok', 'Tokopedia', 'Offline', 'WhatsApp'];
const ORDER_STATUSES = ['to_ship', 'to_ship', 'shipped', 'completed', 'completed', 'cancelled'];

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
    // Idempotent: jangan reset password admin yang sudah ada di production.
    // Hanya pastikan role + status aktif benar.
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        isSuperAdmin: true,
        active: true,
        roleId: adminRole?.id ?? null,
      },
    });
    console.log('  admin user OK (password tidak diubah)');
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

async function seedSuppliers() {
  const existing = await prisma.supplier.count();
  if (existing > 0) {
    console.log(`  suppliers sudah ada (${existing}), skip`);
    return;
  }
  for (const s of SUPPLIERS) {
    await prisma.supplier.upsert({
      where: { storeName: s.storeName },
      create: s,
      update: s,
    });
  }
  console.log(`  ${SUPPLIERS.length} suppliers`);
}

async function seedMaterials() {
  const existing = await prisma.material.count();
  if (existing > 0) {
    console.log(`  materials sudah ada (${existing}), skip`);
    return;
  }
  for (const m of MATERIALS) {
    await prisma.material.upsert({
      where: { code: m.code },
      create: m,
      update: m,
    });
  }
  console.log(`  ${MATERIALS.length} materials (bahan baku)`);
}

async function seedProductsAndOrders() {
  const existingProducts = await prisma.product.count();
  if (existingProducts > 0) {
    console.log(`  products sudah ada (${existingProducts}), skip seed product+order`);
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
  console.log(`  ${PRODUCTS.length} products (finished goods)`);

  // Create demo orders linked to finished products (last 14 days)
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
          status: rand(ORDER_STATUSES),
        },
      });
    }
  }
  console.log(`  ${orderCount} orders across 14 days`);
}

async function main() {
  console.log('Seeding Alucurv ERP...');
  await ensureRolesAndAdmin();
  await seedSuppliers();
  await seedMaterials();
  await seedProductsAndOrders();
  console.log('Seed done.');
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
